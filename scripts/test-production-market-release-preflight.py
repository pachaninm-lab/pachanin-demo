#!/usr/bin/env python3
"""Executable negative tests; no production/network/database access."""
import copy
import importlib.util
import json
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


if __name__ == '__main__':
    unittest.main()
