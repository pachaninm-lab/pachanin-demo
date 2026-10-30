#!/usr/bin/env python3
"""Executable negative tests; no production/network/database access."""
import copy
import importlib.util
import json
import os
import sqlite3
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest
from unittest.mock import patch

PATH = Path(__file__).with_name('production-market-release-preflight.py')
spec = importlib.util.spec_from_file_location('market_preflight', PATH)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SHA = 'a' * 40


def web():
    return {'Id': '1' * 64, 'Image': 'sha256:'+ 'f'*64, 'State': {'Running':True, 'StartedAt':'2026-09-16T00:00:00Z'}, 'Config': {'Env': ['NODE_ENV=production', 'API_URL=http://api:3001/api', 'SECRET=do-not-print'],
            'Labels': {'com.docker.compose.project': 'private-project', 'org.opencontainers.image.revision': SHA}},
            'HostConfig': {'NetworkMode': 'private'},
            'NetworkSettings': {'Ports': {'3000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '3000'}]},
                                'Networks': {'private': {'IPAddress': '172.20.0.3'}}}}


def api():
    w = web()
    w['Id'] = '2' * 64
    w['Config']['Env'] = ['TRUST_PROXY_MODE=cidr', 'TRUSTED_PROXY_CIDRS=172.20.0.3/32']
    return w


def caddy(host=m.DOMAIN, target='127.0.0.1:3000'):
    return {'apps': {'http': {'servers': {'edge': {'routes': [
        {'match': [{'host': [host]}], 'handle': [{'handler': 'reverse_proxy', 'upstreams': [{'dial': target}]}]}
    ]}}}}}


def migrations():
    return {'read_only': True, 'restricted_role': True,
            'rows': [{'migration_name': '20260913143000_public_market_lot_projection', 'checksum': 'b' * 64, 'finished': True, 'rolled_back': False}],
            'schema': {'projection_present': True, 'reader_present': True}}


class Topology(unittest.TestCase):
    def test_loopback_ingress(self): self.assertEqual(m.ingress(web()), 'NO_PUBLIC_DOCKER_BINDING')
    def test_container_only_ingress(self):
        w=web(); w['NetworkSettings']['Ports']={'3000/tcp': None}
        self.assertEqual(m.ingress(w), 'NO_PUBLIC_DOCKER_BINDING')
    def test_any_public_binding_denied(self):
        w=web(); w['NetworkSettings']['Ports']['other']=[{'HostIp':'0.0.0.0'}]
        self.assertEqual(m.ingress(w), 'PUBLIC_BINDING')
    def test_ipv6_public_binding_denied(self):
        w=web(); w['NetworkSettings']['Ports']['3000/tcp'][0]['HostIp']='::'
        self.assertEqual(m.ingress(w), 'PUBLIC_BINDING')
    def test_missing_bindings_unknown(self): self.assertEqual(m.ingress({}), 'NOT_PROVEN')
    def test_host_network_unknown(self):
        w=web(); w['HostConfig']['NetworkMode']='host'
        self.assertEqual(m.ingress(w), 'NOT_PROVEN')
    def test_invalid_binding_unknown(self):
        w=web(); w['NetworkSettings']['Ports']['3000/tcp'][0]['HostIp']='secret-value'
        self.assertEqual(m.ingress(w), 'NOT_PROVEN')
    def test_canonical_origin(self): self.assertEqual(m.origin(web()), 'CANONICAL')
    def test_default_origin(self):
        w=web(); w['Config']['Env']=['NODE_ENV=production']
        self.assertEqual(m.origin(w), 'CANONICAL')
    def test_external_origin_rejected(self):
        w=web(); w['Config']['Env']=['API_URL=https://external.invalid/api']
        self.assertEqual(m.origin(w), 'NOT_CANONICAL')
    def test_duplicate_environment_rejected(self):
        w=web(); w['Config']['Env'].append('API_URL=http://api:3001/api')
        self.assertEqual(m.origin(w), 'NOT_CANONICAL')
    def test_missing_origin_environment_rejected(self): self.assertEqual(m.origin({}), 'NOT_CANONICAL')
    def test_trusted_peer(self): self.assertEqual(m.trust(web(), api()), 'OBSERVED_WEB_PEERS_TRUSTED')
    def test_untrusted_peer(self):
        a=api(); a['Config']['Env'][1]='TRUSTED_PROXY_CIDRS=172.20.0.4/32'
        self.assertEqual(m.trust(web(), a), 'WEB_PEER_NOT_TRUSTED')
    def test_direct_mode_rejected(self):
        a=api(); a['Config']['Env'][0]='TRUST_PROXY_MODE=direct'
        self.assertEqual(m.trust(web(), a), 'CIDR_MODE_NOT_PROVEN')
    def test_trust_all_rejected(self):
        for cidr in ('0.0.0.0/0','::/0',''):
            with self.subTest(cidr=cidr):
                a=api(); a['Config']['Env'][1]='TRUSTED_PROXY_CIDRS='+cidr
                self.assertEqual(m.trust(web(), a), 'UNSAFE_OR_MISSING_CIDRS')
    def test_malformed_cidr_rejected(self):
        a=api(); a['Config']['Env'][1]='TRUSTED_PROXY_CIDRS=bad'
        self.assertEqual(m.trust(web(), a), 'NOT_PROVEN')
    def test_no_shared_network_rejected(self):
        a=api(); a['NetworkSettings']['Networks']={}
        self.assertEqual(m.trust(web(), a), 'WEB_PEER_NOT_OBSERVED')
    def test_ipv6_peer(self):
        w=web(); a=api(); w['NetworkSettings']['Networks']['private']={'GlobalIPv6Address':'fd00::3'}
        a['Config']['Env'][1]='TRUSTED_PROXY_CIDRS=fd00::3/128'
        self.assertEqual(m.trust(w,a), 'OBSERVED_WEB_PEERS_TRUSTED')


class Caddy(unittest.TestCase):
    def test_direct_route(self): self.assertEqual(m.caddy_assessment(caddy(), web()), 'CANONICAL_WEB_ROUTE_OBSERVED')
    def test_missing_configuration(self): self.assertEqual(m.caddy_assessment(None, web()), 'NOT_OBSERVED')
    def test_wrong_host(self): self.assertEqual(m.caddy_assessment(caddy('other.invalid'), web()), 'CANONICAL_WEB_ROUTE_NOT_PROVEN')
    def test_wrong_upstream(self): self.assertEqual(m.caddy_assessment(caddy(target='other:3000'), web()), 'CANONICAL_WEB_ROUTE_NOT_PROVEN')
    def test_overwrite_requires_review(self):
        c=caddy(); c['apps']['http']['servers']['edge']['routes'][0]['handle'][0]['headers']={'request':{'set':{'X-Forwarded-For':['untrusted']}}}
        self.assertEqual(m.caddy_assessment(c,web()), 'HEADER_OR_PROXY_OVERRIDE_REQUIRES_REVIEW')
    def test_trusted_proxies_requires_review(self):
        c=caddy(); c['apps']['http']['servers']['edge']['trusted_proxies']={'source':'static','ranges':['0.0.0.0/0']}
        self.assertEqual(m.caddy_assessment(c,web()), 'HEADER_OR_PROXY_OVERRIDE_REQUIRES_REVIEW')
    def test_unreachable_nested_host_not_accepted(self):
        c=caddy('other.invalid'); r=c['apps']['http']['servers']['edge']['routes'][0]
        r['handle']=[{'handler':'subroute','routes':caddy()['apps']['http']['servers']['edge']['routes']}]
        self.assertEqual(m.caddy_assessment(c,web()), 'CANONICAL_WEB_ROUTE_NOT_PROVEN')
    def test_nested_inherited_host(self):
        c=caddy(); r=c['apps']['http']['servers']['edge']['routes'][0]; h=r['handle']
        r['handle']=[{'handler':'subroute','routes':[{'handle':h}]}]
        self.assertEqual(m.caddy_assessment(c,web()), 'CANONICAL_WEB_ROUTE_OBSERVED')
    def test_header_delete_requires_review(self):
        c=caddy(); c['apps']['http']['servers']['edge']['routes'][0]['handle'][0]['headers']={'request':{'delete':['X-Forwarded-For']}}
        self.assertEqual(m.caddy_assessment(c,web()), 'HEADER_OR_PROXY_OVERRIDE_REQUIRES_REVIEW')
    def test_redirects_are_not_followed(self):
        self.assertIsNone(m.NoRedirect().redirect_request(None,None,302,'',{},'https://external.invalid'))


class Metadata(unittest.TestCase):
    def test_metadata_only(self):
        v=migrations(); v['secret']='do-not-print'; v['rows'][0]['password']='do-not-print'
        r=m.migration_metadata(json.dumps(v))
        self.assertEqual(r['status'],'OBSERVED_READ_ONLY'); self.assertNotIn('do-not-print',json.dumps(r))
    def test_read_only_required(self):
        v=migrations(); v['read_only']=False
        self.assertEqual(m.migration_metadata(json.dumps(v)),{'status':'NOT_PROVEN'})
    def test_malformed_types_fail_closed(self):
        for key,value in (('restricted_role',1),('rows','invalid'),('schema',None)):
            with self.subTest(key=key):
                v=migrations(); v[key]=value
                self.assertEqual(m.migration_metadata(json.dumps(v)),{'status':'NOT_PROVEN'})
    def test_numeric_checksum_rejected(self):
        v=migrations(); v['rows'][0]['checksum']=int('1'*64)
        self.assertEqual(m.migration_metadata(json.dumps(v)),{'status':'NOT_PROVEN'})
    def test_failed_and_rolled_back_separated(self):
        v=migrations(); v['rows'][0]['finished']=False
        self.assertEqual(m.migration_metadata(json.dumps(v))['failed_unresolved'],1)
        v['rows'][0]['rolled_back']=True
        self.assertEqual(m.migration_metadata(json.dumps(v))['failed_unresolved'],0)
    def test_bad_row_not_dropped(self):
        for key,value in (('migration_name','secret\ntext'),('checksum','wrong'),('finished',1)):
            with self.subTest(key=key):
                v=migrations(); v['rows'][0][key]=value
                self.assertEqual(m.migration_metadata(json.dumps(v)),{'status':'NOT_PROVEN'})
    def test_missing_or_invalid_json(self):
        for value in (None,'null','[]','bad'):
            self.assertEqual(m.migration_metadata(value),{'status':'NOT_PROVEN'})
    def test_inventory_bounded(self):
        v=migrations(); v['rows']*=5001
        self.assertEqual(m.migration_metadata(json.dumps(v)),{'status':'NOT_PROVEN'})
    def test_sql_read_only_before_queries(self):
        self.assertLess(m.DB_PROGRAM.index('SET TRANSACTION READ ONLY'),m.DB_PROGRAM.index('tx.$queryRawUnsafe'))
        for forbidden in ('INSERT INTO','DELETE FROM','ALTER TABLE','DROP TABLE','UPDATE auth.'):
            self.assertNotIn(forbidden,m.DB_PROGRAM)
        self.assertIn('statement_timeout',m.DB_PROGRAM)


class Boundary(unittest.TestCase):
    def test_timeout_does_not_expose_details(self):
        # Accelerate the real command deadline without slowing the suite by 18s.
        with patch.object(m.time,'monotonic',side_effect=[0,19]):
            self.assertIsNone(m.run([sys.executable,'-c','import time; time.sleep(30)']))
    def test_nonzero_does_not_expose_output(self):
        self.assertIsNone(m.run([sys.executable,'-c','print("SECRET"); raise SystemExit(1)']))
    def test_oversize_output_rejected(self):
        self.assertIsNone(m.run([sys.executable,'-c',f'print("x"*{m.MAX_BYTES+1})']))
    def test_small_stdin_and_stdout(self):
        self.assertEqual(m.run([sys.executable,'-c','import sys; print(len(sys.stdin.read()))'], 'hello'), '5\n')
    def test_no_child_for_large_stdin(self):
        with patch.object(m.subprocess,'Popen') as popen:
            self.assertIsNone(m.run(['not-executed'],'x'*4097)); popen.assert_not_called()
    def test_invalid_utf8_rejected(self):
        self.assertIsNone(m.run([sys.executable,'-c','import sys; sys.stdout.buffer.write(bytes([255]))']))
    def test_backup_presence_not_restore(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'example.backup'; p.write_text('not-a-dump'); p.chmod(0o600)
            with patch.object(m.shutil,'which',return_value=None):
                r=m.backups(Path(td))
            self.assertEqual(r['artifact'],'PRESENT'); self.assertEqual(r['restore_verification'],'NOT_PROVEN')
            self.assertNotIn(td,json.dumps(r)); self.assertNotIn('not-a-dump',json.dumps(r))
    def test_backup_symlink_ignored(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td); (p/'file').write_text('private'); (p/'alias.backup').symlink_to(p/'file')
            self.assertEqual(m.backups(p)['artifact'],'NOT_OBSERVED')
    def test_collection_has_no_release_authority_or_raw_env(self):
        with patch.object(m,'containers',side_effect=lambda s,*args:[web() if s=='web' else api()]), \
             patch.object(m,'caddy_config',return_value=caddy()), \
             patch.object(m,'run',return_value=json.dumps(migrations())), \
             patch.object(m,'backups',return_value={'restore_verification':'NOT_PROVEN'}):
            r=m.collect(SHA)
        self.assertFalse(r['deployment_authorized']); self.assertEqual(r['production_mutation'],'NONE')
        self.assertEqual(r['running_web_revision'],SHA)
        for marker in ('do-not-print','private-project','172.20.0.3','API_URL','TRUSTED_PROXY_CIDRS'):
            self.assertNotIn(marker,json.dumps(r))
    def test_invalid_target_stops_before_any_command(self):
        with patch.object(m,'containers') as c:
            with self.assertRaises(ValueError): m.collect('invalid; command')
            c.assert_not_called()



def report():
    with patch.object(m,'containers',side_effect=lambda s,*args:[web() if s=='web' else api()]), \
         patch.object(m,'caddy_config',return_value=caddy()), \
         patch.object(m,'run',return_value=json.dumps(migrations())), \
         patch.object(m,'backups',return_value={'artifact':'NOT_OBSERVED','archive_catalog':'NOT_CHECKED','restore_verification':'NOT_PROVEN'}):
        return m.collect(SHA)


class Evidence(unittest.TestCase):
    def test_valid_report(self):
        r=report(); self.assertEqual(m.validate_report(r,SHA),r)
        self.assertEqual(r['checks']['runtime_configuration_stability'],'UNCHANGED')
    def test_unknown_cpu_is_omitted_not_fabricated(self):
        with patch.object(m.os,'cpu_count',return_value=None) as cpu:
            r=report()
        cpu.assert_called_once()
        self.assertNotIn('cpu_count',r['capacity'])
        self.assertEqual(m.validate_report(r,SHA),r)
    def test_invalid_cpu_is_omitted(self):
        with patch.object(m.os,'cpu_count',return_value=True): r=report()
        self.assertNotIn('cpu_count',r['capacity'])
    def test_unknown_top_level_rejected(self):
        r=report(); r['secret']='not-for-artifact'
        with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_wrong_sha_rejected(self):
        with self.assertRaises(ValueError): m.validate_report(report(),'b'*40)
    def test_deployment_boolean_must_be_false(self):
        for value in (0, True, 'false'):
            r=report(); r['deployment_authorized']=value
            with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_stale_report_rejected(self):
        r=report(); r['observed_at_utc']='2000-01-01T00:00:00+00:00'
        with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_invalid_nested_check_not_published(self):
        r=report(); r['checks']['web_ingress']='private-secret-path'
        with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_extra_capacity_not_published(self):
        r=report(); r['capacity']['secret']='private'
        with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_wrong_db_count_rejected(self):
        r=report(); r['migration_inventory']['failed_unresolved']=True
        with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_bad_db_count_rejected(self):
        r=report(); r['migration_inventory']['failed_unresolved']=2
        with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_db_extra_row_field_rejected(self):
        r=report(); r['migration_inventory']['rows'][0]['secret']='private'
        with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_no_restore_claim(self):
        r=report(); r['backup']['restore_verification']='PASS'
        with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_missing_backup_cannot_claim_catalog(self):
        r=report(); r['backup']['archive_catalog']='READABLE'
        with self.assertRaises(ValueError): m.validate_report(r,SHA)
    def test_failed_collection_not_admitted(self):
        with self.assertRaises(ValueError): m.validate_report({'schema':'pc-crop.market-release-preflight.v1'},SHA)
    def test_runtime_change_detected(self):
        changed=web(); changed['Id']='3'*64
        with patch.object(m,'containers',side_effect=[[web()],[api()],[changed],[api()]]), \
             patch.object(m,'caddy_config',return_value=caddy()), \
             patch.object(m,'run',return_value=None), \
             patch.object(m,'backups',return_value={}):
            r=m.collect(SHA)
        self.assertEqual(r['checks']['runtime_configuration_stability'],'NOT_PROVEN')
    def test_stopped_runtime_not_stable(self):
        w=web(); w['State']['Running']=False
        self.assertIsNone(m.runtime_identity(w))
    def test_malformed_runtime_identity_not_stable(self):
        self.assertIsNone(m.runtime_identity({}))
    def test_migration_source_comparison(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); d=root/'20260916000000_example'; d.mkdir(); (d/'migration.sql').write_text('SELECT 1;')
            inventory=m.migration_metadata(json.dumps(migrations()))
            r=m.source_lineage(inventory,root)
            self.assertEqual(r['pending'],['20260916000000_example'])
            self.assertEqual(r['applied_unknown_to_source'],['20260913143000_public_market_lot_projection'])
            self.assertEqual(r['status'],'COMPARED_NOT_MIGRATED')
    def test_migration_checksum_mismatch(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); d=root/migrations()['rows'][0]['migration_name']; d.mkdir(); (d/'migration.sql').write_text('SELECT 1;')
            inventory=m.migration_metadata(json.dumps(migrations()))
            self.assertEqual(m.source_lineage(inventory,root)['checksum_mismatch'],[d.name])
    def test_missing_inventory_no_source_claim(self):
        self.assertEqual(m.source_lineage({'status':'NOT_PROVEN'},Path('.')),{'status':'NOT_PROVEN'})



class WorkflowContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow_path=PATH.parents[1]/'.github/workflows/production-p0-runtime-revision-parity-diagnostic.yml'
        cls.workflow=cls.workflow_path.read_text(encoding='utf-8')
        cls.source=PATH.read_bytes()
        cls.contract=textwrap.dedent(cls.workflow.split("python3 - <<'PY'\n",1)[1].split("\n          PY",1)[0])

    def enforce(self, source, workflow=None):
        wf=self.workflow if workflow is None else workflow
        with patch.object(Path,'read_text',return_value=wf), patch.object(Path,'read_bytes',return_value=source):
            exec(compile(self.contract,'read-only-contract','exec'),{})

    def test_actual_transport_source_and_workflow_pass(self): self.enforce(self.source)
    def test_script_only_mutations_fail_contract(self):
        for mutation in (b"\nrun(['docker', 'stop', 'api'])\n", b"\n# changed script version\n", b"\n# INSERT INTO forbidden\n"):
            with self.subTest(mutation=mutation[:20]):
                with self.assertRaisesRegex(SystemExit,'TRANSPORTED_SCRIPT_DIGEST_MISMATCH'):
                    self.enforce(self.source+mutation)
    def test_removed_transport_path_rejected(self):
        with self.assertRaisesRegex(SystemExit,'TRANSPORTED_SCRIPT_PATH_MISSING'):
            self.enforce(self.source,self.workflow.replace(str(Path('scripts/production-market-release-preflight.py')),'other-script.py'))
    def test_sql_read_only_change_rejected(self):
        with self.assertRaisesRegex(SystemExit,'TRANSPORTED_SCRIPT_DIGEST_MISMATCH'):
            self.enforce(self.source.replace(b'SET TRANSACTION READ ONLY',b'SET TRANSACTION READ WRITE'))
    def test_collection_after_legacy_transport_rejected(self):
        marker='          # Collect bounded evidence before legacy parity; collection never grants release.'
        changed=self.workflow.replace(marker, '')
        changed=changed.replace('          ssh -i "$key" -p "$port"', marker+'\n          ssh -i "$key" -p "$port"',1)
        with self.assertRaisesRegex(SystemExit,'READ_ONLY_COLLECTION_MUST_PRECEDE_LEGACY_PARITY'):
            # Move the marker behind the legacy transport, preserving every other guard.
            changed=changed.replace(marker+'\n', '',1)
            changed=changed.replace('          REMOTE\n','          REMOTE\n'+marker+'\n',1)
            self.enforce(self.source,changed)
    def test_success_only_artifact_retention_rejected(self):
        with self.assertRaisesRegex(SystemExit,'VALIDATED_EVIDENCE_MUST_SURVIVE_LEGACY_FAILURE'):
            self.enforce(self.source,self.workflow.replace('        if: ${{ always() }}\n',''))
    def test_status_functions_are_not_evaluated_inside_native_contract(self):
        # GitHub permits status functions in step.if, not step.run. A Python
        # quoted string inside run does not protect a contiguous expression.
        self.assertIsNone(m.re.search(r'\$\{\{\s*(?:always|cancelled|success|failure)\s*\(',self.contract))
        rendered=m.re.sub(r'\$\{\{\s*always\(\)\s*\}\}','true',self.contract)
        with patch.object(Path,'read_text',return_value=self.workflow), patch.object(Path,'read_bytes',return_value=self.source):
            exec(compile(rendered,'rendered-native-contract','exec'),{})
    def test_quoted_status_expression_is_not_a_template_escape(self):
        # Reproduce the original error against actual checked-out YAML; this
        # substitution is a local engine-boundary model, not a hosted result.
        broken=self.contract.replace("'        if: ' + '$' + '{{ always() }}\\n'", "'        if: ${{ always() }}\\n'")
        self.assertNotEqual(broken,self.contract)
        rendered=m.re.sub(r'\$\{\{\s*always\(\)\s*\}\}','true',broken)
        with patch.object(Path,'read_text',return_value=self.workflow), patch.object(Path,'read_bytes',return_value=self.source):
            with self.assertRaisesRegex(SystemExit,'VALIDATED_EVIDENCE_MUST_SURVIVE_LEGACY_FAILURE'):
                exec(compile(rendered,'quoted-expression-regression','exec'),{})
    def test_sanitized_transport_error_keeps_original_exit(self):
        start=self.workflow.index('          if (( preflight_status != 0 )); then')
        end=self.workflow.index('          fi',start)+len('          fi')
        block=textwrap.dedent(self.workflow[start:end])
        classes={124:'TRANSPORT_DEADLINE',255:'SSH_TRANSPORT_OR_AUTHORITY',127:'REMOTE_INTERPRETER_UNAVAILABLE',1:'REMOTE_COLLECTION_NOT_PROVEN',23:'READ_ONLY_COLLECTION_FAILED'}
        for code,classification in classes.items():
            with self.subTest(code=code):
                result=subprocess.run(['bash','-c','preflight_status="$1";\n'+block,'bounded-test',str(code)],capture_output=True,text=True,timeout=5)
                self.assertEqual(result.returncode,code)
                self.assertEqual(result.stdout,'')
                self.assertEqual(result.stderr,'MARKET_PREFLIGHT_FAILURE='+classification+'\n')


class PreflightFailureEvidence(unittest.TestCase):
    """Execute the real shell order/validator with local synthetic SSH responses."""
    def execute(self, payload, preflight_exit=0, legacy_exit=0):
        workflow=(PATH.parents[1]/'.github/workflows/production-p0-runtime-revision-parity-diagnostic.yml').read_text()
        marker='          # Collect bounded evidence before legacy parity; collection never grants release.'
        command=textwrap.dedent(workflow.split(marker,1)[1].split('\n      - name: Preserve validated read-only market observations',1)[0])
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); binaries=root/'bin';binaries.mkdir()
            (root/'response.json').write_text(json.dumps(payload))
            (binaries/'gh').write_text('#!/bin/sh\nprintf "%s\\n" "$TARGET_SHA"\n')
            (binaries/'ssh').write_text('''#!/usr/bin/env python3
import os,sys
from pathlib import Path
root=Path(os.environ['SYNTHETIC_FIXTURE'])
sys.stdin.buffer.read()
if sys.argv[-1].startswith("python3 - '"):
    (root/'preflight-called').touch()
    print('synthetic-secret-stderr',file=sys.stderr)
    print((root/'response.json').read_text())
    raise SystemExit(int(os.environ['SYNTHETIC_PREFLIGHT_EXIT']))
(root/'legacy-called').touch()
print('synthetic-secret-stderr',file=sys.stderr)
if int(os.environ['SYNTHETIC_LEGACY_EXIT']):
    raise SystemExit(int(os.environ['SYNTHETIC_LEGACY_EXIT']))
for key,value in {'API_REVISION':'a'*40,'WEB_REVISION':'b'*40,
                  'AUTH_MAIL_WORKER_REVISION':'a'*40,'AUTH_MAIL_WORKER_STATE':'running',
                  'AUTH_MAIL_WORKER_HEALTH':'healthy','RUNTIME_STABILITY':'PASS',
                  'PRODUCTION_MUTATION':'NONE'}.items(): print(key+'='+value)
print('REVIEWER_LOGIN_READINESS|pc_staff_runtime|1|1|1|1|1|1')
''')
            for f in binaries.iterdir():f.chmod(0o700)
            env=dict(os.environ,PATH=str(binaries)+os.pathsep+os.environ['PATH'],
                     TARGET_SHA=SHA,RUNNER_TEMP=directory,GITHUB_STEP_SUMMARY=str(root/'summary'),
                     GITHUB_REPOSITORY='synthetic/fixture',SYNTHETIC_FIXTURE=directory,
                     SYNTHETIC_PREFLIGHT_EXIT=str(preflight_exit),SYNTHETIC_LEGACY_EXIT=str(legacy_exit),
                     key='fixture-key',port='22',known='fixture-known',user='fixture',host='fixture',
                     preflight_raw=str(root/'untrusted.json'),raw=str(root/'legacy.raw'))
            result=subprocess.run(['bash','-c','set -Eeuo pipefail\n'+command],cwd=PATH.parents[1],
                                  env=env,capture_output=True,text=True,timeout=15)
            output=root/'market-preflight.json'
            return result,json.loads(output.read_text()) if output.exists() else None,(root/'legacy-called').exists()

    def test_validated_report_survives_actual_split_revision_failure(self):
        payload=report();payload['running_web_revision']='b'*40
        result,evidence,legacy=self.execute(payload)
        self.assertEqual(result.returncode,1)
        self.assertTrue(legacy)
        self.assertEqual(evidence['running_web_revision'],'b'*40)
        self.assertIs(evidence['deployment_authorized'],False)
        self.assertEqual(evidence['live_acceptance'],'NOT_PERFORMED')
        self.assertIn('MARKET_PREFLIGHT_COLLECTION=VALIDATED_READ_ONLY',result.stdout)
        self.assertNotIn('REVISION_PARITY=PASS',result.stdout)
        self.assertNotIn('synthetic-secret',result.stdout+result.stderr)

    def test_validated_report_survives_later_ssh_failure(self):
        result,evidence,legacy=self.execute(report(),legacy_exit=23)
        self.assertEqual(result.returncode,23)
        self.assertTrue(legacy)
        self.assertIs(evidence['deployment_authorized'],False)
        self.assertNotIn('synthetic-secret',result.stdout+result.stderr)

    def test_failed_preflight_transport_admits_nothing_and_stops(self):
        result,evidence,legacy=self.execute(report(),preflight_exit=255)
        self.assertEqual(result.returncode,255)
        self.assertIsNone(evidence)
        self.assertFalse(legacy)
        self.assertEqual(result.stderr,'MARKET_PREFLIGHT_FAILURE=SSH_TRANSPORT_OR_AUTHORITY\n')

    def test_invalid_or_wrong_source_report_admits_nothing_and_stops(self):
        for change in ({'secret':'synthetic-secret'},{'target_sha':'c'*40},{'deployment_authorized':True}):
            with self.subTest(change=change):
                payload=report();payload.update(change)
                result,evidence,legacy=self.execute(payload)
                self.assertEqual(result.returncode,1)
                self.assertIsNone(evidence)
                self.assertFalse(legacy)
                self.assertNotIn('synthetic-secret',result.stdout+result.stderr)


def outbox_fixture():
    a = api()
    a['Config']['Labels']['com.docker.compose.service'] = 'api'
    a['Config']['Image'] = 'ghcr.io/pachaninm-lab/grainflow-api@sha256:' + 'a'*64
    a['NetworkSettings']['Networks']['private']['NetworkID'] = 'network-private'
    w = copy.deepcopy(a)
    w['Id'] = '3'*64; w['Image'] = 'sha256:'+'c'*64
    w['Config'].update(Image=m.OUTBOX_REPOSITORY+'@sha256:'+'b'*64,
                       Cmd=['dist-outbox-worker/outbox-worker.js'], Entrypoint=['/nodejs/bin/node'], WorkingDir='/app')
    w['Config']['Env'] = ['NODE_ENV=production', 'RUNTIME_COMPONENT=outbox-worker', 'OUTBOX_WORKER_ENABLED=true',
                         'KAFKA_REQUIRED=true', 'KAFKA_BROKERS=broker-private:9092', 'DATABASE_URL=SYNTHETIC_PRIVATE_DATABASE_URL']
    w['Config']['Labels']['com.docker.compose.service'] = 'unexpected-service-name'
    w['State']['Health'] = {'Status': 'healthy'}
    broker = copy.deepcopy(a); broker['Id']='4'*64
    broker['Config']['Labels']['com.docker.compose.service'] = 'unexpected-broker-name'
    broker['NetworkSettings']['Networks']['private']['Aliases'] = ['broker-private']
    broker['NetworkSettings']['Networks']['private']['IPAddress'] = '172.20.0.8'
    identity = {'name': 'SYNTHETIC_PRIVATE_DB_NAME', 'address': '172.22.0.4', 'port': 5432}
    principal = {'read_only': True, 'identity': identity, 'row': {key: True for key in m.PRINCIPAL_TRUE} | {key: False for key in m.PRINCIPAL_FALSE}}
    catalog = {'read_only': True, 'identity': identity, 'row': {
        'table_present': True, 'rls_enabled': True, 'rls_forced': True, 'durable_columns_present': True,
        'fence_body': '\nBEGIN\n RETURN NEW;\nEND\n', 'fence_security_definer': False, 'fence_language': 'plpgsql',
        'triggers': [{'enabled':'O','type':19,'function_matches':True,'no_when':True,'columns':['leaseToken','status']}],
    }}
    images = {
        a['Image']: [{'Id': a['Image'], 'RepoDigests': [a['Config']['Image']], 'Config': {'Labels': {'org.opencontainers.image.revision': SHA}}}],
        w['Image']: [{'Id': w['Image'], 'RepoDigests': [w['Config']['Image']], 'Config': {'Labels': {'org.opencontainers.image.revision': SHA}}}],
    }
    return a, w, broker, principal, catalog, images


class OutboxTopology(unittest.TestCase):
    def inspect(self, mutate=None):
        a,w,b,p,c,images = outbox_fixture()
        rows=[a,w,b]
        if mutate: mutate(a,w,b,p,c,images,rows)
        calls=[]
        def command(argv, source=None):
            calls.append((argv,source))
            self.assertEqual(argv[0],'docker')
            if argv[1:3] == ['ps','-aq']:
                self.assertEqual(argv[3:5],['--no-trunc','--filter'])
                return '\n'.join(row['Id'] for row in rows)
            if argv[1]=='inspect': return json.dumps(rows)
            if argv[1:3]==['image','inspect']: return json.dumps(images.get(argv[3],[]))
            if argv[1:3]==['exec','-i']:
                self.assertLessEqual(len(source.encode()),4096)
                self.assertIn('SET TRANSACTION READ ONLY',source)
                self.assertIn('statement_timeout',source)
                return json.dumps(c if argv[3]==a['Id'] else p)
            self.fail('unexpected mutation/command '+repr(argv))
        with patch.object(m,'run',side_effect=command):
            report=m.outbox_topology(a,'private-project')
        m.validate_outbox_topology(report)
        return report,calls

    def test_actual_collector_scopes_inventory_and_strips_all_private_values(self):
        value,calls=self.inspect()
        self.assertEqual(value['worker_candidates'],1)
        self.assertTrue(value['worker_configuration_matches'])
        self.assertTrue(value['principal']['boundary_matches'])
        self.assertTrue(value['principal']['same_database_as_api'])
        self.assertTrue(value['catalog']['trigger_shape_matches'])
        self.assertEqual(value['kafka']['same_project_peers'],1)
        self.assertEqual(value['kafka']['running_peers'],1)
        self.assertEqual(value['runtime_stability'],'UNCHANGED')
        for component in ['api_image','worker_image']:
            self.assertTrue(value[component]['container_image_binding'])
            self.assertTrue(value[component]['immutable_config_ref'])
            self.assertEqual(value[component]['revision'],SHA)
        for marker in ['SYNTHETIC_PRIVATE','private-project','172.20.0','172.22.0','broker-private','unexpected-service','unexpected-broker','/app']:
            self.assertNotIn(marker,json.dumps(value))
        self.assertEqual(value['rollback_compatibility'],'NOT_PROVEN')
        self.assertEqual(value['persisted_compose_model'],'NOT_INSPECTED')

    def test_missing_worker_is_inventory_absence_not_claimed_readiness(self):
        value,_=self.inspect(lambda a,w,b,p,c,i,r:r.remove(w))
        self.assertEqual(value['worker_candidates'],0)
        self.assertFalse(value['worker_configuration_matches'])
        self.assertEqual(value['principal'],{'status':'NOT_PROVEN'})

    def test_ambiguous_workers_do_not_select_first(self):
        def duplicate(a,w,b,p,c,i,r):
            other=copy.deepcopy(w);other['Id']='5'*64;r.append(other)
        value,_=self.inspect(duplicate)
        self.assertEqual(value['worker_candidates'],2)
        self.assertFalse(value['worker_configuration_matches'])
        self.assertEqual(value['principal'],{'status':'NOT_PROVEN'})

    def test_foreign_project_inspection_rejected(self):
        value,_=self.inspect(lambda a,w,b,p,c,i,r:w['Config']['Labels'].update({'com.docker.compose.project':'foreign-private'}))
        self.assertEqual(value,{'status':'NOT_PROVEN'})

    def test_override_entrypoint_workdir_and_duplicate_environment_not_canonical(self):
        for change in [lambda w:w['Config'].update(Entrypoint=['/bin/sh']),
                       lambda w:w['Config'].update(WorkingDir='/elsewhere'),
                       lambda w:w['Config']['Env'].append('OUTBOX_WORKER_ENABLED=false')]:
            value,_=self.inspect(lambda a,w,b,p,c,i,r:change(w))
            self.assertFalse(value['worker_configuration_matches'])

    def test_container_revision_label_does_not_override_image_revision(self):
        def mismatch(a,w,b,p,c,i,r):i[w['Image']][0]['Config']['Labels']['org.opencontainers.image.revision']='b'*40
        value,_=self.inspect(mismatch)
        self.assertEqual(value['worker_image']['revision'],'b'*40)

    def test_image_id_mismatch_and_foreign_repository_cannot_supply_digest(self):
        def wrong_id(a,w,b,p,c,i,r):i[w['Image']][0]['Id']='sha256:'+'9'*64
        value,_=self.inspect(wrong_id)
        self.assertFalse(value['worker_image']['container_image_binding'])
        def foreign(a,w,b,p,c,i,r):i[w['Image']][0]['RepoDigests']=['private.invalid/foreign@sha256:'+'b'*64]
        value,_=self.inspect(foreign)
        self.assertEqual(value['worker_image']['registry_digest'],'NOT_PROVEN')

    def test_containerd_manifest_id_equal_to_digest_is_valid(self):
        def equal(a,w,b,p,c,i,r):
            old=w['Image'];w['Image']='sha256:'+'b'*64;i[w['Image']]=i.pop(old);i[w['Image']][0]['Id']=w['Image']
        value,_=self.inspect(equal)
        self.assertTrue(value['worker_image']['container_image_binding'])
        self.assertTrue(value['worker_image']['immutable_config_ref'])

    def test_actual_principal_each_least_privilege_violation_is_observed(self):
        for key in m.PRINCIPAL_TRUE|m.PRINCIPAL_FALSE:
            with self.subTest(key=key):
                value,_=self.inspect(lambda a,w,b,p,c,i,r:p['row'].update({key:not p['row'][key]}))
                self.assertFalse(value['principal']['boundary_matches'])

    def test_pre_correction_principal_projection_is_not_sufficient(self):
        def old_projection(a,w,b,p,c,i,r):
            for key in ('session_is_app_outbox','createdb','createrole','replication','forbidden_updates','outbox_other_privileges'):p['row'].pop(key)
        value,_=self.inspect(old_projection)
        self.assertEqual(value['principal'],{'status':'NOT_PROVEN'})

    def test_actual_forbidden_update_predicate_rejects_table_and_extra_column_grants(self):
        # Execute the actual relational predicate with SQLite catalog/privilege
        # fixtures. Only the PostgreSQL current_user keyword needs substitution;
        # this is not a PostgreSQL server/integration test.
        start=m.PRINCIPAL_SQL.index("has_table_privilege(current_user,c.oid,'UPDATE')")
        predicate=m.PRINCIPAL_SQL[start:m.PRINCIPAL_SQL.index(' AS forbidden_updates',start)]
        predicate=predicate.replace('current_user',"'app_outbox'")
        allowed=('status','retryCount','nextRetryAt','lastError','lastErrorCode','lastErrorCategory',
                 'lastAttemptAt','manualReviewAt','sentAt','confirmedAt','failedAt','deadLetterAt',
                 'leaseOwner','leaseToken','leaseExpiresAt','heartbeatAt')
        columns=allowed+('id','type','payload','dealId','futurePayloadField')
        db=sqlite3.connect(':memory:')
        self.addCleanup(db.close)
        db.execute('CREATE TABLE pg_attribute(attrelid,attnum,attisdropped,attname)')
        db.executemany('INSERT INTO pg_attribute VALUES(1,?,false,?)',enumerate(columns,1))
        db.execute("INSERT INTO pg_attribute VALUES(1,99,true,'removedColumn')")
        db.execute("INSERT INTO pg_attribute VALUES(1,-1,false,'systemColumn')")
        db.execute("INSERT INTO pg_attribute VALUES(2,98,false,'foreignTableColumn')")
        grants=set(allowed); table_grant=False
        def table_privilege(role,oid,kind):
            self.assertEqual((role,oid,kind),('app_outbox',1,'UPDATE'))
            return table_grant
        def column_privilege(role,oid,number,kind):
            self.assertEqual((role,oid,kind),('app_outbox',1,'UPDATE'))
            name=db.execute('SELECT attname FROM pg_attribute WHERE attrelid=? AND attnum=?',(oid,number)).fetchone()[0]
            return table_grant or name in grants
        db.create_function('has_table_privilege',3,table_privilege)
        db.create_function('has_column_privilege',4,column_privilege)
        evaluate=lambda:bool(db.execute('SELECT '+predicate+' FROM (SELECT 1 AS oid) c').fetchone()[0])
        self.assertFalse(evaluate())
        for column in ('id','type','payload','dealId','futurePayloadField'):
            with self.subTest(column=column):
                grants.add(column);self.assertTrue(evaluate());grants.remove(column)
        table_grant=True;self.assertTrue(evaluate());table_grant=False
        grants.update(('removedColumn','systemColumn','foreignTableColumn'))
        self.assertFalse(evaluate())

    def test_actual_role_projection_observes_authenticated_session_and_admin_attributes(self):
        projection=m.PRINCIPAL_SQL.split('SELECT ',1)[1].split('EXISTS(',1)[0].strip().rstrip(',')
        db=sqlite3.connect(':memory:');self.addCleanup(db.close)
        db.row_factory=sqlite3.Row
        db.execute('CREATE TABLE role_fixture(rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolinherit)')
        db.execute('INSERT INTO role_fixture VALUES(false,false,false,false,false,false)')
        def project(session):
            return dict(db.execute('SELECT '+projection.replace('current_user',"'app_outbox'").replace('session_user',"'"+session+"'")+' FROM role_fixture r').fetchone())
        self.assertEqual(project('app_outbox'),{'is_app_outbox':1,'session_is_app_outbox':1,'superuser':0,'bypass_rls':0,'createdb':0,'createrole':0,'replication':0,'role_inherit':0})
        self.assertEqual(project('privileged_session')['session_is_app_outbox'],0)
        for attribute,flag in [('rolcreatedb','createdb'),('rolcreaterole','createrole'),('rolreplication','replication')]:
            db.execute('UPDATE role_fixture SET '+attribute+'=true')
            self.assertEqual(project('app_outbox')[flag],1)
            db.execute('UPDATE role_fixture SET '+attribute+'=false')

    def test_actual_other_privilege_predicates_observe_truncate_trigger_and_references(self):
        db=sqlite3.connect(':memory:');self.addCleanup(db.close)
        table_grants=set();column_grants=set()
        db.create_function('has_table_privilege',3,lambda role,oid,kinds:bool(table_grants.intersection(kinds.split(','))))
        db.create_function('has_any_column_privilege',3,lambda role,oid,kinds:bool(column_grants.intersection(kinds.split(','))))
        fields=[("has_table_privilege(current_user,c.oid,'TRUNCATE,REFERENCES,TRIGGER')",'outbox_other_privileges'),
                ("has_table_privilege(current_user,'public.deals'",'deal_privileges'),
                ("has_table_privilege(current_user,'public.outbox_redrive_events'",'redrive_privileges')]
        for start_text,name in fields:
            start=m.PRINCIPAL_SQL.index(start_text)
            predicate=m.PRINCIPAL_SQL[start:m.PRINCIPAL_SQL.index(' AS '+name,start)].replace('current_user',"'app_outbox'")
            evaluate=lambda:bool(db.execute('SELECT '+predicate+' FROM (SELECT 1 AS oid) c').fetchone()[0])
            with self.subTest(field=name):
                self.assertFalse(evaluate())
                for privilege in ('TRUNCATE','TRIGGER','REFERENCES'):
                    table_grants.add(privilege);self.assertTrue(evaluate());table_grants.clear()
                column_grants.add('REFERENCES');self.assertTrue(evaluate());column_grants.clear()

    def test_worker_other_database_not_bound_to_api_fence(self):
        def other(a,w,b,p,c,i,r):p['identity']=dict(p['identity'],name='OTHER_PRIVATE_DB')
        value,_=self.inspect(other)
        self.assertFalse(value['principal']['same_database_as_api'])
        self.assertNotIn('OTHER_PRIVATE_DB',json.dumps(value))

    def test_failed_read_only_transaction_cannot_supply_catalog_or_principal(self):
        value,_=self.inspect(lambda a,w,b,p,c,i,r:(p.update(read_only=False),c.update(read_only=False)))
        self.assertEqual(value['principal'],{'status':'NOT_PROVEN'})
        self.assertEqual(value['catalog'],{'status':'NOT_PROVEN'})

    def test_trigger_wrong_columns_when_function_or_type_not_accepted(self):
        for changes in [{'columns':['status']},{'no_when':False},{'type':17},{'function_matches':False}]:
            with self.subTest(changes=changes):
                value,_=self.inspect(lambda a,w,b,p,c,i,r:c['row']['triggers'][0].update(changes))
                self.assertFalse(value['catalog']['trigger_shape_matches'])

    def test_disabled_trigger_not_enabled(self):
        value,_=self.inspect(lambda a,w,b,p,c,i,r:c['row']['triggers'][0].update(enabled='D'))
        self.assertFalse(value['catalog']['trigger_enabled'])

    def test_kafka_external_or_ambiguous_alias_not_accepted_as_compose_peer(self):
        value,_=self.inspect(lambda a,w,b,p,c,i,r:w['Config']['Env'].__setitem__(4,'KAFKA_BROKERS=external.invalid:9092'))
        self.assertEqual(value['kafka']['status'],'NOT_PROVEN')
        def duplicate(a,w,b,p,c,i,r):
            duplicate=copy.deepcopy(b);duplicate['Id']='8'*64;r.append(duplicate)
        value,_=self.inspect(duplicate)
        self.assertEqual(value['kafka']['status'],'NOT_PROVEN')

    def test_kafka_same_network_name_different_id_not_shared_network(self):
        value,_=self.inspect(lambda a,w,b,p,c,i,r:b['NetworkSettings']['Networks']['private'].update(NetworkID='foreign-network'))
        self.assertEqual(value['kafka']['status'],'NOT_PROVEN')

    def test_stopped_kafka_peer_is_observed_but_not_running(self):
        value,_=self.inspect(lambda a,w,b,p,c,i,r:b['State'].update(Running=False))
        self.assertEqual(value['kafka']['same_project_peers'],1)
        self.assertEqual(value['kafka']['running_peers'],0)
        self.assertEqual(value['runtime_stability'],'UNCHANGED')

    def test_topology_schema_rejects_secret_fields_and_rollback_pass(self):
        value,_=self.inspect()
        for section in ['', 'worker_image', 'principal', 'catalog', 'kafka']:
            candidate=copy.deepcopy(value);target=candidate if not section else candidate[section];target['secret']='CANARY'
            with self.subTest(section=section):
                with self.assertRaises(ValueError):m.validate_outbox_topology(candidate)
        candidate=copy.deepcopy(value);candidate['rollback_compatibility']='PASS'
        with self.assertRaises(ValueError):m.validate_outbox_topology(candidate)

    def test_worker_principal_contradiction_rejected(self):
        value,_=self.inspect();value['principal']['superuser']=True
        with self.assertRaisesRegex(ValueError,'OUTBOX_PRINCIPAL_CONTRADICTION'):m.validate_outbox_topology(value)

    def test_trusted_source_fence_matching_and_rollback_boundaries(self):
        value,_=self.inspect()
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            self.assertEqual(m.outbox_source_comparison(value,root)['fence_definition'],'NOT_PROVEN')
            path=root/'20260912235500_canonical_durable_outbox';path.mkdir()
            migration=path/'migration.sql'
            migration.write_text('CREATE OR REPLACE FUNCTION public.outbox_expired_attempt_reclaim_guard()\nRETURNS trigger\nLANGUAGE plpgsql\nAS $guard$\nBEGIN\n RETURN NEW;\nEND\n$guard$;')
            r=m.outbox_source_comparison(value,root)
            self.assertEqual(r['fence_definition'],'MATCHES_TRUSTED_SOURCE')
            # Matching an arbitrary function body does not prove protocol-2 semantics.
            self.assertEqual(r['legacy_claim_rollback'],'NOT_PROVEN')
            self.assertEqual(r['rollback_compatibility'],'NOT_PROVEN')
            value['catalog']['trigger_enabled']=False
            self.assertEqual(m.outbox_source_comparison(value,root)['legacy_claim_rollback'],'NOT_PROVEN')
            migration.write_text(migration.read_text().replace('RETURN NEW','RETURN OLD'))
            self.assertEqual(m.outbox_source_comparison(value,root)['fence_definition'],'NOT_PROVEN')

    def test_malformed_duplicate_or_transport_failed_project_inventory_not_accepted(self):
        for raw in [None,'','bad','1'*64+'\n'+'1'*64]:
            with patch.object(m,'run',return_value=raw):self.assertIsNone(m.project_containers('private-project'))

    def test_api_configuration_race_before_topology_inventory_rejected(self):
        a,w,b,p,c,i=outbox_fixture();changed=copy.deepcopy(a);changed['Config']['Env'].append('SECRET=changed')
        with patch.object(m,'project_containers',return_value=[changed,w,b]):
            self.assertEqual(m.outbox_topology(a,'private-project'),{'status':'NOT_PROVEN'})

    def test_worker_restart_during_catalog_queries_not_stable(self):
        a,w,b,p,c,i=outbox_fixture();after=copy.deepcopy([a,w,b]);after[1]['State']['StartedAt']='2026-09-17T01:00:00Z'
        with patch.object(m,'project_containers',side_effect=[[a,w,b],after]), patch.object(m,'run',return_value=None):
            value=m.outbox_topology(a,'private-project')
        self.assertEqual(value['runtime_stability'],'NOT_PROVEN')

    def test_read_only_probe_actual_node_program_starts_read_only_and_has_bounded_sql(self):
        for sql in [m.PRINCIPAL_SQL,m.CATALOG_SQL]:
            program=m.read_only_program(sql)
            self.assertLessEqual(len(program.encode()),4096)
            with tempfile.TemporaryDirectory() as td:
                root=Path(td);module=root/'node_modules/@prisma/client';module.mkdir(parents=True)
                (module/'index.js').write_text('''exports.PrismaClient=class {
                  async $transaction(fn){let stage=0;return fn({
                    $executeRawUnsafe:async sql=>{if(stage++===0 && sql!=='SET TRANSACTION READ ONLY')throw Error('NOT_READ_ONLY');},
                    $queryRawUnsafe:async sql=>{if(stage!==2)throw Error('READ_BEFORE_READ_ONLY');
                      if(sql.includes("current_setting('transaction_read_only')"))return [{value:'on'}];
                      if(sql.includes('current_database()'))return [{name:'PRIVATE_NAME',address:'127.0.0.1',port:5432}];
                      if(!sql.trim().startsWith('SELECT'))throw Error('MUTATION');return [{observed:true}];}
                  });} async $disconnect(){}
                };''')
                executed=subprocess.run(['node','-'],input=program,cwd=root,capture_output=True,text=True,timeout=5)
                self.assertEqual(executed.returncode,0,executed.stderr)
                self.assertTrue(json.loads(executed.stdout)['read_only'])


class InitialTransportPrivacy(unittest.TestCase):
    def test_actual_first_ssh_command_suppresses_raw_stderr_and_preserves_failure(self):
        workflow=(PATH.parents[1]/'.github/workflows/production-p0-runtime-revision-parity-diagnostic.yml').read_text()
        start=workflow.index('          ssh -i "$key"')
        end=workflow.index('\n          REMOTE',start)+len('\n          REMOTE')
        command=textwrap.dedent(workflow[start:end])
        with tempfile.TemporaryDirectory() as td:
            for status in [0,23,255]:
                script='''set -Eeuo pipefail
                key=fixture; port=22; known=fixture; user=fixture; host=fixture
                raw="$1"
                ssh(){ cat >/dev/null; printf '%s' SYNTHETIC_PRIVATE_STDOUT; printf '%s' SYNTHETIC_PRIVATE_STDERR >&2; return "$2"; }
                '''
                # Function receives original ssh arguments; use a separate fixed status value.
                script=script.replace('return "$2"','return '+str(status))
                result=subprocess.run(['bash','-c',textwrap.dedent(script)+'\n'+command,'test',str(Path(td)/'raw')],capture_output=True,text=True,timeout=5)
                self.assertEqual(result.returncode,status)
                self.assertEqual(result.stdout,'');self.assertEqual(result.stderr,'')
                self.assertEqual((Path(td)/'raw').read_text(),'SYNTHETIC_PRIVATE_STDOUT')
            unsafe=command.replace(' 2>/dev/null','')
            negative=subprocess.run(['bash','-c',textwrap.dedent(script)+'\n'+unsafe,'test',str(Path(td)/'raw')],capture_output=True,text=True,timeout=5)
            self.assertIn('SYNTHETIC_PRIVATE_STDERR',negative.stderr)


class PersistedReleaseInventory(unittest.TestCase):
    def model(self):
        return {'name':'private-project','services':{
            'api':{'image':'api:old','environment':{'SECRET':'DO_NOT_PUBLISH','OUTBOX_WORKER_ENABLED':'true','KAFKA_BROKERS':'private:9092'}},
            'web':{'image':'web:old'},
            'bus':{'image':'registry.example/apache/kafka@sha256:'+'a'*64},
            'state':{'image':'postgres:16'}}}

    def test_compose_operation_is_derived_and_limited_to_render(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);f=root/'protected.yml';f.write_text('services: {}')
            w=web();labels=w['Config']['Labels']
            labels['com.docker.compose.project.working_dir']=str(root)
            labels['com.docker.compose.project.config_files']='protected.yml'
            command=m.compose_config_command(w,'private-project')
            self.assertEqual(command,['docker','compose','--project-directory',str(root),'--project-name','private-project','-f',str(f),'config','--format','json'])
            self.assertIsNone(m.compose_config_command(w,'other-project'))
            labels['com.docker.compose.project.config_files']='protected.yml,protected.yml'
            self.assertIsNone(m.compose_config_command(w,'private-project'))
            link=root/'link.yml';link.symlink_to(f)
            labels['com.docker.compose.project.config_files']='link.yml'
            self.assertIsNone(m.compose_config_command(w,'private-project'))

    def test_malformed_or_wrong_project_model_is_rejected(self):
        for model in [None,[],{'name':'other','services':self.model()['services']},{'name':'private-project','services':{'api':{}}}]:
            with patch.object(m,'compose_config_command',return_value=['docker','compose','config','--format','json']),patch.object(m,'run',return_value=json.dumps(model)):
                self.assertIsNone(m.rendered_compose(web(),'private-project'))

    def test_persisted_and_runtime_broker_inventory_does_not_require_worker(self):
        a=api();w=web();a['Config']['Image']='api:old';w['Config']['Image']='web:old'
        broker=api();broker['Config']['Image']='registry.example/apache/kafka@sha256:'+'a'*64
        with patch.object(m,'rendered_compose',return_value=self.model()),patch.object(m,'project_containers',return_value=[broker]),patch.object(m,'database_probe',return_value={'status':'PERMISSION_DENIED'}):
            result=m.release_inventory(w,a,'private-project')
        m.validate_release_inventory(result)
        self.assertEqual(result['compose']['worker_candidates'],0)
        self.assertEqual(result['compose']['broker_candidates'],1)
        self.assertEqual(result['runtime']['running_broker_candidates'],1)
        self.assertTrue(result['compose']['api_image_matches_runtime_config'])
        self.assertTrue(result['compose']['api_outbox_worker_enabled'])
        self.assertNotIn('DO_NOT_PUBLISH',json.dumps(result));self.assertNotIn('private',json.dumps(result))

    def test_changed_configuration_and_image_mismatch_are_not_accepted_as_stable(self):
        changed=self.model();changed['services']['api']['environment']['SECRET']='CHANGED_SECRET'
        with patch.object(m,'rendered_compose',side_effect=[self.model(),changed]),patch.object(m,'project_containers',return_value=None),patch.object(m,'database_probe',return_value={'status':'NOT_PROVEN'}):
            result=m.release_inventory(web(),api(),'private-project')
        self.assertEqual(result['compose']['configuration_stability'],'NOT_PROVEN')
        self.assertFalse(result['compose']['api_image_matches_runtime_config'])
        self.assertNotIn('CHANGED_SECRET',json.dumps(result))

    def test_fixed_schema_rejects_raw_secrets_counts_and_boolean_coercion(self):
        with patch.object(m,'rendered_compose',return_value=self.model()),patch.object(m,'project_containers',return_value=[]),patch.object(m,'database_probe',return_value={'status':'NOT_PROVEN'}):
            result=m.release_inventory(web(),api(),'private-project')
        for section,key,value in [('compose','raw','SECRET'),('compose','service_count',True),('compose','worker_candidates',65),('compose','api_brokers_configured',1),('runtime','running_broker_candidates',1),('database_probe','status','PRIVATE_ERROR')]:
            candidate=copy.deepcopy(result);candidate[section][key]=value
            with self.subTest(section=section,key=key),self.assertRaises(ValueError):m.validate_release_inventory(candidate)

    def test_broker_metadata_is_strict_and_never_connectivity_evidence(self):
        for image in ['apache/kafka:4','docker.io/bitnami/kafka:3','redpandadata/redpanda@sha256:'+'b'*64,'confluentinc/cp-kafka:7']:
            self.assertTrue(m.broker_image(image),image)
        for image in [None,'kafka-ui:latest','notkafka:3','apache/kafka malicious','apache/kafka@wrong','my-kafka-app:latest']:
            self.assertFalse(m.broker_image(image),image)

    def test_database_configuration_presence_is_not_connection_or_migration_authority(self):
        model=self.model()
        model['services']['api']['environment']['DATABASE_URL']='PRIVATE_API_URL'
        model['services']['db-migrate']={'image':'ghcr.io/pachaninm-lab/grainflow-migration:sha-1234567','environment':{'DATABASE_URL':'PRIVATE_MIGRATION_URL'}}
        for ambiguous in [False,True]:
            if ambiguous:model['services']['other-migration']=copy.deepcopy(model['services']['db-migrate'])
            with patch.object(m,'rendered_compose',return_value=model),patch.object(m,'project_containers',return_value=None),patch.object(m,'database_probe',return_value={'status':'CONNECTION_FAILED'}):
                result=m.release_inventory(web(),api(),'private-project')
            m.validate_release_inventory(result)
            self.assertTrue(result['compose']['api_database_configured'])
            self.assertEqual(result['compose']['migration_candidates'],2 if ambiguous else 1)
            self.assertEqual(result['compose']['migration_database_configured'],not ambiguous)
            self.assertEqual(result['database_probe']['status'],'CONNECTION_FAILED')
            self.assertNotIn('PRIVATE_',json.dumps(result))
            if ambiguous:
                result['compose']['migration_database_configured']=True
                with self.assertRaises(ValueError):m.validate_release_inventory(result)

    def test_database_probe_transport_failure_and_untrusted_output_remain_unknown(self):
        for raw in [None,'not-json',json.dumps({'status':'PERMISSION_DENIED','message':'PRIVATE'})]:
            with patch.object(m,'run',return_value=raw):
                self.assertEqual(m.database_probe(api()),{'status':'NOT_PROVEN'})

    def test_database_probe_program_enforces_read_only_and_sanitizes_errors(self):
        self.assertLessEqual(len(m.DB_PROBE_PROGRAM.encode()),4096)
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);module=root/'node_modules/@prisma/client';module.mkdir(parents=True)
            (module/'index.js').write_text('''
              const fail=()=>{const e=Error('PRIVATE_DATABASE_URL');const x=process.env.PROBE_CASE;
                if(x==='permission')e.meta={code:'42501'};if(x==='auth')e.code='P1000';throw e;};
              exports.PrismaClient=class {
                async $connect(){if(['connect','auth'].includes(process.env.PROBE_CASE))fail();}
                async $transaction(fn){let stage=0;return fn({
                  $executeRawUnsafe:async sql=>{if(stage++===0){if(sql!=='SET TRANSACTION READ ONLY')throw Error('NOT_READ_ONLY');if(process.env.PROBE_CASE==='readonly')fail();}},
                  $queryRawUnsafe:async sql=>{if(stage!==2)throw Error('READ_BEFORE_READ_ONLY');
                    if(sql.includes("current_setting('transaction_read_only')"))return [{value:'on'}];
                    if(!sql.trim().startsWith('SELECT'))throw Error('MUTATION');
                    if(['permission','unknown'].includes(process.env.PROBE_CASE))fail();
                    return [{api_is_app_deal:true,row_security_on:true,outbox_role_exists:true,outbox_role_unsafe:false,outbox_table_present:true,fence_function_present:false}];}
                });} async $disconnect(){}
              };''')
            for case,status in [('good','OBSERVED_READ_ONLY'),('connect','CONNECTION_FAILED'),('auth','AUTHENTICATION_FAILED'),('readonly','READ_ONLY_SETUP_FAILED'),('permission','PERMISSION_DENIED'),('unknown','QUERY_FAILED'),('missing','DEFAULT_DATABASE_URL_MISSING')]:
                env=dict(os.environ,PROBE_CASE=case,DATABASE_URL='' if case=='missing' else 'PRIVATE_DATABASE_URL')
                p=subprocess.run(['node','-'],input=m.DB_PROBE_PROGRAM,cwd=root,env=env,capture_output=True,text=True,timeout=5)
                with self.subTest(case=case):
                    self.assertEqual(p.returncode,0,p.stderr);self.assertEqual(p.stderr,'')
                    self.assertNotIn('PRIVATE_DATABASE_URL',p.stdout)
                    result=json.loads(p.stdout);m.validate_database_probe(result);self.assertEqual(result['status'],status)


class RegistrationPreconditions(unittest.TestCase):
    def fixture(self):
        a=api(); a['Mounts']=[]; a['HostConfig']['ReadonlyRootfs']=True
        a['Config']['Env'].append('AUTH_DATABASE_URL=private-do-not-publish')
        checks={**report()['checks'], 'caddy_configuration_stability':'UNCHANGED'}
        topology={'runtime_stability':'UNCHANGED','api_image':{
            'container_image_binding':True,'immutable_config_ref':True,
            'registry_digest':'sha256:'+'a'*64}}
        return a,checks,topology

    def test_positive_observations_never_execute_or_prove_binding(self):
        a,c,t=self.fixture()
        with patch.object(m,'run',side_effect=AssertionError('no new command permitted')):
            value=m.registration_preconditions(a,c,t)
        self.assertEqual(value['route_configuration'],'OBSERVED_CONFIGURATION_ONLY')
        self.assertEqual(value['local_image_binding'],'OBSERVED')
        self.assertEqual(value['immutable_reference'],'OBSERVED')
        self.assertIs(value['binding_proven'],False)
        self.assertEqual(value['helper_execution'],'NOT_PERFORMED')
        self.assertEqual(value['blocking_reasons'],['INSTALLED_CODE_PROOF_MISSING',
            'REGISTRATION_BINDING_NOT_PERFORMED','TRUSTED_IMAGE_PROOF_MISSING'])
        self.assertNotIn('private-do-not-publish',json.dumps(value))
        m.validate_registration_preconditions(value,c,t)

    def test_missing_caddy_and_runtime_never_infer_route(self):
        for field in ['caddy_configuration_stability','caddy_route_and_headers',
                      'runtime_configuration_stability','canonical_api_origin','api_web_peer_trust','web_ingress']:
            a,c,t=self.fixture(); c[field]='NOT_PROVEN'
            value=m.registration_preconditions(a,c,t)
            self.assertEqual(value['route_configuration'],'NOT_PROVEN')
            self.assertIn('ROUTE_CHAIN_NOT_PROVEN',value['blocking_reasons'])

    def test_changed_topology_invalidates_image_and_route_observations(self):
        a,c,t=self.fixture(); t['runtime_stability']='NOT_PROVEN'
        value=m.registration_preconditions(a,c,t)
        for key in ['runtime_stability','route_configuration','local_image_binding','immutable_reference']:
            self.assertEqual(value[key],'NOT_PROVEN')

    def test_tag_or_missing_local_image_does_not_attest_provenance(self):
        a,c,t=self.fixture();t['api_image']['immutable_config_ref']=False
        value=m.registration_preconditions(a,c,t)
        self.assertEqual(value['immutable_reference'],'NOT_PROVEN')
        self.assertIn('TRUSTED_IMAGE_PROOF_MISSING',value['blocking_reasons'])
        t['api_image']['container_image_binding']=False
        self.assertEqual(m.registration_preconditions(a,c,t)['local_image_binding'],'NOT_PROVEN')

    def test_mount_overlap_uses_components_and_covers_parent_and_child(self):
        for dest in ['/', '/app', '/app/dist', '/app/dist/module.js', '/app/node_modules/pkg', '/nodejs/bin/node']:
            self.assertEqual(m.code_mount_observation({'Mounts':[{'Destination':dest}]}),'CODE_PATH_OVERLAP')
        for dest in ['/app/distinct','/app/node_modules-old','/nodejs-old','/etc/config']:
            self.assertEqual(m.code_mount_observation({'Mounts':[{'Destination':dest}]}),'NO_CODE_MOUNT_OBSERVED')

    def test_missing_or_malformed_mounts_are_unknown_without_path_disclosure(self):
        for mounts in [None,{},[None],[{}],[{'Destination':'relative'}],
                       [{'Destination':'//app/dist'}],[{'Destination':'/app/../dist'}],
                       [{'Destination':'/app/dist/'}],[{'Destination':'/private\x00secret'}]]:
            self.assertEqual(m.code_mount_observation({'Mounts':mounts}),'NOT_PROVEN')

    def test_env_unknown_missing_empty_duplicate_and_false_values(self):
        for env,expected in [(None,'NOT_PROVEN'),({},'NOT_PROVEN'),([7],'NOT_PROVEN'),
                             (['MALFORMED'],'NOT_PROVEN'),([], 'MISSING'),
                             (['AUTH_DATABASE_URL= '],'MISSING'),
                             (['AUTH_DATABASE_URL=x','AUTH_DATABASE_URL=y'],'NOT_PROVEN')]:
            a,c,t=self.fixture();a['Config']['Env']=env
            value=m.registration_preconditions(a,c,t)
            self.assertEqual(value['registration_url'],expected)
            self.assertIn('REGISTRATION_URL_NOT_CONFIGURED',value['blocking_reasons'])

    def test_writable_or_unknown_root_remains_blocked(self):
        for readonly,state in [(False,'WRITABLE'),(None,'NOT_PROVEN'),(1,'NOT_PROVEN')]:
            a,c,t=self.fixture();a['HostConfig']['ReadonlyRootfs']=readonly
            value=m.registration_preconditions(a,c,t)
            self.assertEqual(value['root_filesystem'],state)
            self.assertIn('WRITABLE_ROOT_OR_UNKNOWN',value['blocking_reasons'])

    def test_extra_fields_unknown_strings_and_false_success_rejected(self):
        for key,bad in [('secret','private-value'),('binding_proven',True),('binding_proven',0),
                        ('helper_execution','PASS'),('status','READY'),('code_mounts','private-path')]:
            a,c,t=self.fixture();value=m.registration_preconditions(a,c,t);value[key]=bad
            with self.assertRaises(ValueError):m.validate_registration_preconditions(value,c,t)

    def test_missing_duplicate_reordered_or_injected_blockers_rejected(self):
        a,c,t=self.fixture();original=m.registration_preconditions(a,c,t)
        for reasons in [[],original['blocking_reasons']*2,list(reversed(original['blocking_reasons'])),['private-path']]:
            value=copy.deepcopy(original);value['blocking_reasons']=reasons
            with self.assertRaises(ValueError):m.validate_registration_preconditions(value,c,t)

    def test_route_image_and_runtime_contradictions_rejected(self):
        for field in ['route_configuration','local_image_binding','immutable_reference','runtime_stability']:
            a,c,t=self.fixture();value=m.registration_preconditions(a,c,t);value[field]='NOT_PROVEN'
            value['blocking_reasons']=m.registration_blockers(value)
            with self.assertRaises(ValueError):m.validate_registration_preconditions(value,c,t)

    def test_current_envelope_requires_new_section_and_schema(self):
        value=report(); self.assertEqual(value['schema'],'pc-crop.market-release-preflight.v2')
        self.assertEqual(m.validate_report(value,SHA),value)
        old=copy.deepcopy(value);old.pop('registration_binding')
        with self.assertRaises(ValueError):m.validate_report(old,SHA)
        old=copy.deepcopy(value);old['schema']='pc-crop.market-release-preflight.v1'
        with self.assertRaises(ValueError):m.validate_report(old,SHA)


class Publication(unittest.TestCase):
    def fixture(self, *, edit_config=None, edit_manifest=None, edit_index=None):
        encode=lambda d: json.dumps(d,separators=(',',':')).encode()
        digest=lambda b:'sha256:'+m.hashlib.sha256(b).hexdigest()
        config={'os':'linux','architecture':'amd64','rootfs':{'type':'layers','diff_ids':['sha256:'+'a'*64]},
                'config':{'Labels':{'org.opencontainers.image.revision':m.PUBLICATION['source_sha'],
                 'org.opencontainers.image.source':'https://github.com/pachaninm-lab/pachanin-demo',
                 'private':'DO_NOT_EXPORT'},'Env':['PRIVATE=DO_NOT_EXPORT']}}
        if edit_config:edit_config(config)
        cr=encode(config)
        manifest={'schemaVersion':2,'mediaType':m.OCI_MANIFEST,
                  'config':{'mediaType':m.OCI_CONFIG,'digest':digest(cr),'size':len(cr)},
                  'layers':[{'mediaType':'application/vnd.oci.image.layer.v1.tar+gzip','digest':'sha256:'+'b'*64,'size':123}]}
        if edit_manifest:edit_manifest(manifest)
        mr=encode(manifest)
        index={'schemaVersion':2,'mediaType':m.OCI_INDEX,'manifests':[{'mediaType':m.OCI_MANIFEST,
               'digest':digest(mr),'size':len(mr),'platform':{'os':'linux','architecture':'amd64'}}]}
        if edit_index:edit_index(index)
        ir=encode(index)
        return {**m.PUBLICATION,'index':digest(ir),'manifest':digest(mr),'config':digest(cr)},(ir,mr,cr)

    def verify(self,**changes):
        pins,docs=self.fixture(**changes)
        with patch.dict(m.PUBLICATION,pins,clear=True):return m.verify_publication_documents(*docs)

    def test_valid_metadata_cannot_claim_host_registration_or_code_proof(self):
        v=self.verify();self.assertEqual(v['status'],'PINNED_METADATA_VERIFIED')
        for key in ('host_binding','registration_binding'):self.assertEqual(v[key],'NOT_PERFORMED')
        self.assertEqual(v['installed_code'],'NOT_INSPECTED');self.assertEqual(v['layer_contents'],'NOT_DOWNLOADED')
        self.assertFalse(v['deployment_authorized']);self.assertNotIn('DO_NOT_EXPORT',json.dumps(v))
        self.assertEqual(set(v),{'schema','status','source_sha','index_digest','manifest_digest','image_config_digest',
            'platform','layer_count','declared_layer_bytes','layer_contents','installed_code','host_binding',
            'registration_binding','production_mutation','deployment_authorized'})

    def test_each_exact_response_digest_is_required(self):
        pins,docs=self.fixture()
        with patch.dict(m.PUBLICATION,pins,clear=True):
            for i in range(3):
                changed=list(docs);changed[i]+=b' '
                with self.subTest(i=i),self.assertRaisesRegex(ValueError,'PUBLICATION_DIGEST'):
                    m.verify_publication_documents(*changed)

    def test_descriptor_platform_count_size_type_and_digest_tampering(self):
        cases=[('edit_index',lambda d:d['manifests'][0]['platform'].update(architecture='arm64')),
          ('edit_index',lambda d:d['manifests'][0].update(size=1)),
          ('edit_index',lambda d:d['manifests'].append(copy.deepcopy(d['manifests'][0]))),
          ('edit_index',lambda d:d.update(schemaVersion=2.0)),
          ('edit_manifest',lambda d:d['config'].update(digest='sha256:'+'c'*64)),
          ('edit_manifest',lambda d:d['config'].update(size=False)),
          ('edit_manifest',lambda d:d['config'].update(mediaType='other')),
          ('edit_manifest',lambda d:d.update(layers=[])),
          ('edit_manifest',lambda d:d['layers'][0].update(size=-1)),
          ('edit_manifest',lambda d:d['layers'][0].update(size=2**31)),
          ('edit_manifest',lambda d:d['layers'][0].update(digest='PRIVATE'))]
        for key,edit in cases:
            with self.subTest(key=key,edit=edit),self.assertRaises(ValueError):self.verify(**{key:edit})

    def test_wrong_revision_source_architecture_or_rootfs_rejected(self):
        edits=[lambda d:d.update(os='other'),lambda d:d.update(architecture='arm64'),
          lambda d:d['config']['Labels'].update({'org.opencontainers.image.revision':'c'*40}),
          lambda d:d['config']['Labels'].update({'org.opencontainers.image.source':'https://other.invalid'}),
          lambda d:d['rootfs'].update(type='other'),lambda d:d['rootfs'].update(diff_ids=[]),
          lambda d:d['rootfs'].update(diff_ids=['PRIVATE'])]
        for edit in edits:
            with self.subTest(edit=edit),self.assertRaises(ValueError):self.verify(edit_config=edit)

    def test_strict_json_rejects_duplicates_nonfinite_invalid_utf8_and_overflow(self):
        for raw in (b'',b'{"x":1,"x":2}',b'{"x":NaN}',b'{"x":Infinity}',b'[]',b'\xff',b' '*(m.PUBLICATION_MAX_BYTES+1)):
            with self.subTest(raw=raw[:25]),self.assertRaises(ValueError):m.publication_json(raw)

    class Response:
        status=200
        def __init__(self,url,data=b'{}',headers=None):self.url,self.data,self.headers=url,data,headers or {}
        def geturl(self):return self.url
        def read1(self,size):v,self.data=self.data[:size],self.data[size:];return v
        def __enter__(self):return self
        def __exit__(self,*_):pass
    class Opener:
        def __init__(self,responses):self.responses,self.requests=iter(responses),[]
        def open(self,request,timeout):
            self.requests.append((request,timeout));v=next(self.responses)
            if isinstance(v,Exception):raise v
            return v
    def get(self,url=None,*,responses=None,budget=None,**options):
        url=url or 'https://ghcr.io/v2/'+m.PUBLICATION['repository']+'/blobs/'+m.PUBLICATION['config']
        opener=self.Opener(responses or [self.Response(url)])
        value=m.publication_get(url,'Bearer PRIVATE',m.time.monotonic()+60,opener,
                               [0,0] if budget is None else budget,**options)
        return value,opener

    def test_only_fixed_https_origins_are_requested(self):
        for url in ('http://ghcr.io/x','https://ghcr.io.evil.invalid/x','https://user:secret@ghcr.io/x',
                    'https://ghcr.io:444/x','https://ghcr.io/x#secret','file:///secret',
                    'https://pkg-containers.githubusercontent.com/other/path'):
            with self.subTest(url=url),self.assertRaises(ValueError):self.get(url)

    def test_exact_config_colon_and_slash_paths_strip_authorization(self):
        url='https://ghcr.io/v2/'+m.PUBLICATION['repository']+'/blobs/'+m.PUBLICATION['config']
        for path in (m.PUBLICATION['config'],m.PUBLICATION['config'].replace(':','/')):
            target='https://pkg-containers.githubusercontent.com/ghcr1/blobs/'+path+'?PRIVATE=secret'
            e=m.urllib.error.HTTPError(url,307,'PRIVATE',{'Location':target},None)
            value,opener=self.get(url,responses=[e,self.Response(target)],allow_blob_redirect=True)
            self.assertEqual(value,b'{}');self.assertEqual(len(opener.requests),2)
            self.assertEqual(opener.requests[0][0].get_header('Authorization'),'Bearer PRIVATE')
            self.assertIsNone(opener.requests[1][0].get_header('Authorization'))
            self.assertTrue(all(r.get_method()=='GET' and 0<t<=5 for r,t in opener.requests))

    def test_storage_namespace_rejects_traversal_controls_and_unbounded_identifiers(self):
        url='https://ghcr.io/v2/'+m.PUBLICATION['repository']+'/blobs/'+m.PUBLICATION['config']
        for path in ('sha256/'+ 'a'*257,'../'+m.PUBLICATION['config'],m.PUBLICATION['config'].replace(':','%253A'),
                     'sha256/../'+m.PUBLICATION['config'],'object%00','object%5Cfile','a//b','a/./b',
                     'a/'*9+'object'):
            target='https://pkg-containers.githubusercontent.com/ghcr1/blobs/'+path
            e=m.urllib.error.HTTPError(url,307,'PRIVATE',{'Location':target},None)
            with self.subTest(path=path),self.assertRaisesRegex(ValueError,'PUBLICATION_STORAGE_PATH'):
                self.get(url,responses=[e,self.Response(target)],allow_blob_redirect=True)

    def test_uri_decoding_is_namespace_policy_and_keeps_the_signed_url(self):
        url='https://ghcr.io/v2/'+m.PUBLICATION['repository']+'/blobs/'+m.PUBLICATION['config']
        exact='/ghcr1/blobs/'+m.PUBLICATION['config']
        paths=(exact.replace(':','%3A'),exact.replace(':','%3a'),exact.replace('/blobs/','/blobs%2F'),
               exact.replace('b','%62'))
        for path in paths:
            target='https://pkg-containers.githubusercontent.com'+path+'?PRIVATE=secret'
            e=m.urllib.error.HTTPError(url,307,'PRIVATE',{'Location':target},None)
            value,opener=self.get(url,responses=[e,self.Response(target)],allow_blob_redirect=True)
            self.assertEqual(value,b'{}');self.assertEqual(opener.requests[1][0].full_url,target)
            self.assertIsNone(opener.requests[1][0].get_header('Authorization'))
        for path in (exact.replace(':','%253A'),exact+'%',exact+'%zz',
                     '/ghcr1/blobs/%2e%2e/'+m.PUBLICATION['config'],exact+'%00',exact+'%FF'):
            target='https://pkg-containers.githubusercontent.com'+path
            e=m.urllib.error.HTTPError(url,307,'PRIVATE',{'Location':target},None)
            with self.subTest(path=path),self.assertRaisesRegex(ValueError,'PUBLICATION_STORAGE_PATH'):
                self.get(url,responses=[e,self.Response(target)],allow_blob_redirect=True)

    def test_unreviewed_redirect_or_token_redirect_is_rejected(self):
        url='https://ghcr.io/token'
        for allowed,target in ((False,'https://pkg-containers.githubusercontent.com/ghcr1/blobs/sha256/a'),
            (True,'https://evil.invalid/ghcr1/blobs/sha256/a'),(True,'https://ghcr.io/unreviewed')):
            e=m.urllib.error.HTTPError(url,307,'PRIVATE',{'Location':target},None)
            with self.subTest(target=target),self.assertRaises(ValueError):self.get(url,responses=[e],allow_blob_redirect=allowed)

    def test_body_total_request_and_deadline_limits(self):
        url='https://ghcr.io/token'
        cases=[{'responses':[self.Response(url,b'x'*11)],'max_bytes':10},
               {'responses':[self.Response(url,headers={'Content-Length':str(m.PUBLICATION_MAX_BYTES+1)})]},
               {'responses':[self.Response(url,b'')]},{'budget':[m.PUBLICATION_MAX_TOTAL,0]},{'budget':[0,8]}]
        for options in cases:
            with self.subTest(options=list(options)),self.assertRaises(ValueError):self.get(url,**options)
        with self.assertRaisesRegex(ValueError,'PUBLICATION_TIMEOUT'):
            m.publication_get(url,'PRIVATE',m.time.monotonic()-1,self.Opener([]),[0,0])

    def test_http_challenge_and_automatic_redirect_never_followed(self):
        url='https://ghcr.io/token'
        e=m.urllib.error.HTTPError(url,401,'PRIVATE',{'WWW-Authenticate':'Bearer realm=https://evil.invalid'},None)
        with self.assertRaisesRegex(ValueError,'PUBLICATION_AUTHORIZATION'):self.get(url,responses=[e])
        with self.assertRaisesRegex(ValueError,'PUBLICATION_HTTP'):self.get(responses=[self.Response('https://evil.invalid')])

    def test_issue_event_cannot_dispatch_runner_network(self):
        with patch.dict(os.environ,{'GITHUB_EVENT_NAME':'issue_comment'},clear=True), \
             patch.object(m,'collect') as collect,patch.object(m.urllib.request,'build_opener') as network:
            with self.assertRaisesRegex(ValueError,'PUBLICATION_RUNNER_ONLY'):m.published_api_baseline()
            collect.assert_not_called();network.assert_not_called()

    def test_exact_runner_request_plan_and_producer_receipt(self):
        pins,docs=self.fixture()
        env={'GITHUB_ACTIONS':'true','GITHUB_EVENT_NAME':'pull_request','GITHUB_REPOSITORY':'pachaninm-lab/pachanin-demo',
             'GITHUB_HEAD_REF':'ops/farmer-market-release-preflight-20260916','GITHUB_ACTOR':'pachaninm-lab',
             'GH_TOKEN':'DO_NOT_EXPORT','GITHUB_SHA':'d'*40}
        with patch.dict(m.PUBLICATION,pins,clear=True),patch.dict(os.environ,env,clear=True), \
             patch.object(m,'publication_get',side_effect=[b'{"token":"PRIVATE_BEARER"}',*docs]) as fetch:
            v=m.published_api_baseline()
        calls=fetch.call_args_list;self.assertEqual(len(calls),4)
        self.assertEqual(calls[0].args[0],'https://ghcr.io/token?service=ghcr.io&scope=repository%3Apachaninm-lab%2Fgrainflow-api%3Apull')
        self.assertEqual(calls[0].kwargs,{'max_bytes':65536});self.assertTrue(calls[0].args[1].startswith('Basic '))
        self.assertEqual(calls[1].args[1],'Bearer PRIVATE_BEARER');self.assertEqual(calls[3].kwargs,{'allow_blob_redirect':True})
        self.assertEqual(v['producer_actions_sha'],'d'*40);self.assertEqual(v['producer_source_sha256'],m.hashlib.sha256(PATH.read_bytes()).hexdigest())
        self.assertNotIn('PRIVATE',json.dumps(v));self.assertNotIn('DO_NOT_EXPORT',json.dumps(v))

    def test_opaque_storage_name_still_requires_exact_config_bytes(self):
        pins,docs=self.fixture()
        env={'GITHUB_ACTIONS':'true','GITHUB_EVENT_NAME':'pull_request','GITHUB_REPOSITORY':'pachaninm-lab/pachanin-demo',
             'GITHUB_HEAD_REF':'ops/farmer-market-release-preflight-20260916','GITHUB_ACTOR':'pachaninm-lab',
             'GH_TOKEN':'DO_NOT_EXPORT','GITHUB_SHA':'d'*40}
        token_url='https://ghcr.io/token?service=ghcr.io&scope=repository%3Apachaninm-lab%2Fgrainflow-api%3Apull'
        prefix='https://ghcr.io/v2/'+pins['repository']+'/'
        config_url=prefix+'blobs/'+pins['config']
        target='https://pkg-containers.githubusercontent.com/ghcr1/blobs/opaque.storage_object?PRIVATE=secret'
        for body in (docs[2],docs[2]+b' '):
            responses=[self.Response(token_url,b'{"token":"PRIVATE_BEARER"}'),
                self.Response(prefix+'manifests/'+pins['index'],docs[0]),
                self.Response(prefix+'manifests/'+pins['manifest'],docs[1]),
                m.urllib.error.HTTPError(config_url,307,'PRIVATE',{'Location':target},None),self.Response(target,body)]
            opener=self.Opener(responses)
            with patch.dict(m.PUBLICATION,pins,clear=True),patch.dict(os.environ,env,clear=True), \
                 patch.object(m.urllib.request,'build_opener',return_value=opener):
                if body==docs[2]:
                    v=m.published_api_baseline();self.assertEqual(v['status'],'PINNED_METADATA_VERIFIED')
                    self.assertNotIn('PRIVATE',json.dumps(v));self.assertEqual(v['host_binding'],'NOT_PERFORMED')
                else:
                    with self.assertRaisesRegex(ValueError,'PUBLICATION_DIGEST'):m.published_api_baseline()
            self.assertEqual(len(opener.requests),5)
            self.assertIsNone(opener.requests[-1][0].get_header('Authorization'))

    def test_cli_failure_never_exports_error_or_calls_host(self):
        import io,contextlib
        out=io.StringIO()
        with patch.object(sys,'argv',['collector','--published-api-baseline']), \
             patch.object(m,'published_api_baseline',side_effect=RuntimeError('PRIVATE_SECRET')), \
             patch.object(m,'collect') as collect,contextlib.redirect_stdout(out):
            with self.assertRaises(SystemExit):m.main()
        v=json.loads(out.getvalue());self.assertEqual(v['failure'],'PUBLICATION_UNAVAILABLE')
        self.assertEqual(v['status'],'NOT_PROVEN');self.assertNotIn('PRIVATE',out.getvalue());collect.assert_not_called()

    def test_workflow_has_isolated_pr_only_least_privilege_and_hard_deadline(self):
        wf=(PATH.parents[1]/'.github/workflows/production-p0-runtime-revision-parity-diagnostic.yml').read_text()
        block=wf.split('\n  publication-baseline:\n',1)[1].split('\n  diagnostic:\n',1)[0]
        for marker in ("github.event_name == 'pull_request'",'github.event.pull_request.head.repo.full_name == github.repository',
            "github.head_ref == 'ops/farmer-market-release-preflight-20260916'",'packages: read',
            'timeout --signal=TERM --kill-after=5s 75s','persist-credentials: false'):
            self.assertIn(marker,block)
        for forbidden in ('secrets.','ssh','issue_comment'):self.assertNotIn(forbidden,block)
        self.assertEqual(wf.count('packages: read'),1)


if __name__ == '__main__':
    unittest.main()
