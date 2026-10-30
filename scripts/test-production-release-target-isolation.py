#!/usr/bin/env python3
"""Execute the actual release helpers against isolated Docker fixtures."""
import copy
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('production-full-stack-exact-sha.sh')
SOURCE = SCRIPT.read_text()
HELPERS = SOURCE[SOURCE.index('runtime_isolation_error() {'):SOURCE.index('\nruntime_project=""')]
CANARY = 'PRIVATE_VALUE_MUST_NOT_APPEAR'
API, WEB, WATCH, FOREIGN_API, FOREIGN_WEB, FOREIGN_WATCH, WORKER, NEW_API, BROKER, FOREIGN_WORKER, FOREIGN_BROKER = [c * 64 for c in '123456789ab']

DOCKER = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
p=Path(os.environ['FIXTURE_PATH']); f=json.loads(p.read_text()); a=sys.argv[1:]
with open(os.environ['DOCKER_CALLS'],'a') as log: log.write(json.dumps(a)+'\n')
kind=a[0]
if kind=='compose': kind='compose-'+a[-1]
if kind=='ps':
    if '-aq' in a:
        filters=[a[i+1] for i,v in enumerate(a) if v=='--filter']
        service=next((v.split('=',2)[-1] for v in filters if v.startswith('label=com.docker.compose.service=')),None)
        kind='watchtower-list' if service=='watchtower' else 'service-list'
    else:
        kind='all-list'
if kind=='inspect':
    fmt=a[a.index('--format')+1]
    kind='state' if 'RestartPolicy' in fmt else ('identity' if '.Id' in fmt else 'project')
if f.get('fail')==kind:
    print('PRIVATE_VALUE_MUST_NOT_APPEAR',file=sys.stderr); sys.exit(23)
containers=f['containers']
if a[0]=='compose':
    value=f.get('compose_override',{}).get(a[-1])
    if value is None: value='\n'.join(f['compose'][a[-1]])
    print(value)
elif a[0]=='ps':
    if '-aq' in a:
        filters=[a[i+1] for i,v in enumerate(a) if v=='--filter']
        project=next((v.split('=',2)[-1] for v in filters if v.startswith('label=com.docker.compose.project=')),None)
        service=next((v.split('=',2)[-1] for v in filters if v.startswith('label=com.docker.compose.service=')),None)
        ids=[i for i,c in containers.items() if (project is None or c['project']==project) and (service is None or c['service']==service)]
        if service=='watchtower': ids=f.get('watchtower_override',ids)
        ids=f.get('service_override',{}).get(service,ids)
    else:
        ids=f.get('all_override',[i for i,c in containers.items() if c['running']])
    print('\n'.join(ids))
elif a[0]=='inspect':
    i=a[-1]; c=containers.get(i)
    if c is None: sys.exit(24)
    if kind=='project': print(c['project'])
    elif kind=='identity': print(f.get('identity_override',{}).get(i,f"{i} {c['project']} {c['service']}"))
    else: print(c['restart']+' '+str(c['running']).lower())
elif a[0]=='update':
    if not f.get('ignore_update'): containers[a[-1]]['restart']='no'
    p.write_text(json.dumps(f))
elif a[0]=='stop':
    if not f.get('ignore_stop'): containers[a[-1]]['running']=False
    if f.get('add_watchtower_after_stop'):
        containers['c'*64]={'project':'production','service':'watchtower','running':True,'restart':'always'}
    p.write_text(json.dumps(f))
else: sys.exit(25)
'''


def fixture():
    values = [(API,'production','api'), (WEB,'production','web'),
              (WATCH,'production','watchtower'), (FOREIGN_API,'other','api'),
              (FOREIGN_WEB,'other','web'), (FOREIGN_WATCH,'other','watchtower'),
              (WORKER,'production','outbox-worker'), (BROKER,'production','ir20-kafka'),
              (FOREIGN_WORKER,'other','outbox-worker'), (FOREIGN_BROKER,'other','ir20-kafka')]
    return {'containers': {i:{'project':p,'service':s,'running':True,'restart':'always'}
                           for i,p,s in values}, 'compose': {'api':[API], 'web':[WEB]}}


class TargetIsolation(unittest.TestCase):
    def run_shell(self, body, data=None, *, project='production', next_data=None):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'docker').write_text(DOCKER); (root/'docker').chmod(0o700)
            (root/'fixture.json').write_text(json.dumps(data or fixture()))
            (root/'next.json').write_text(json.dumps(next_data or {}))
            script=("set -Eeuo pipefail\n" + HELPERS + '\n' +
                    'dc=(docker compose --project-name production)\n' +
                    f'api_id={API}\nweb_id={WEB}\nprod_project={shlex.quote(project)}\nruntime_project=""\nOUTBOX_SERVICE=outbox-worker\nKAFKA_SERVICE=ir20-kafka\n' +
                    'resolve_release_runtime_project\n' + body)
            env={**os.environ, 'PATH':str(root)+os.pathsep+os.environ['PATH'],
                 'FIXTURE_PATH':str(root/'fixture.json'), 'DOCKER_CALLS':str(root/'calls')}
            result=subprocess.run(['bash','-c',script],cwd=root,env=env,capture_output=True,text=True)
            calls=[json.loads(x) for x in (root/'calls').read_text().splitlines()]
            outputs={p.name:p.read_text() for p in root.glob('*.snapshot')}
            state=json.loads((root/'fixture.json').read_text())
            self.assertNotIn(CANARY,result.stdout+result.stderr+''.join(outputs.values()))
            return result,calls,outputs,state

    def assert_failure(self, body, data, code, **kwargs):
        result,calls,outputs,state=self.run_shell(body,data,**kwargs)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('ERROR_CODE='+code,result.stderr)
        return calls,outputs,state

    def test_only_foreign_projects_stay_in_snapshot(self):
        r,_,files,_=self.run_shell('snapshot_unrelated before.snapshot')
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(files['before.snapshot'].splitlines(),sorted([FOREIGN_API,FOREIGN_WEB,FOREIGN_WATCH,FOREIGN_WORKER,FOREIGN_BROKER]))

    def test_missing_explicit_project_uses_matching_runtime_authority(self):
        r,_,_,_=self.run_shell('snapshot_unrelated before.snapshot',project='')
        self.assertEqual(r.returncode,0,r.stderr)

    def test_explicit_project_mismatch_blocks_before_mutations(self):
        calls,_,_=self.assert_failure('retire_release_watchtower',fixture(),'TARGET_PROJECT_MISMATCH',project='wrong')
        self.assertFalse(any(x[0] in ('update','stop') for x in calls))

    def test_api_web_project_mismatch_blocks(self):
        f=fixture(); f['containers'][WEB]['project']='other'
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_PROJECT_MISMATCH')

    def test_invalid_project_does_not_leak(self):
        f=fixture(); f['containers'][API]['project']=CANARY+'\nsecret'; f['containers'][WEB]['project']=CANARY+'\nsecret'
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_PROJECT_MISMATCH')

    def test_project_transport_error_is_not_success(self):
        f=fixture(); f['fail']='project'
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_PROJECT_UNREADABLE')

    def test_empty_target_blocks(self):
        f=fixture(); f['compose']['api']=[]
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_CONTAINER_MISSING')

    def test_multiple_target_instances_are_not_silently_truncated(self):
        f=fixture(); f['compose']['api']=[API,NEW_API]
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_RUNTIME_AMBIGUOUS')

    def test_duplicate_target_ids_block(self):
        f=fixture(); f['compose']['api']=[API,API]
        self.assert_failure('snapshot_unrelated before.snapshot',f,'CONTAINER_ID_DUPLICATED')

    def test_short_id_blocks(self):
        f=fixture(); f['compose_override']={'api':API[:12]}
        self.assert_failure('snapshot_unrelated before.snapshot',f,'CONTAINER_ID_INVALID')

    def test_malformed_id_does_not_leak(self):
        f=fixture(); f['compose_override']={'api':CANARY}
        self.assert_failure('snapshot_unrelated before.snapshot',f,'CONTAINER_ID_INVALID')

    def test_compose_transport_error_blocks(self):
        f=fixture(); f['fail']='compose-api'
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_DISCOVERY_FAILED')

    def test_other_project_returned_by_compose_blocks(self):
        f=fixture(); f['compose']['api']=[FOREIGN_API]
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_IDENTITY_MISMATCH')

    def test_wrong_service_returned_by_compose_blocks(self):
        f=fixture(); f['compose']['api']=[WEB]
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_IDENTITY_MISMATCH')

    def test_identity_transport_error_blocks(self):
        f=fixture(); f['fail']='identity'
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_IDENTITY_UNREADABLE')

    def test_list_transport_error_blocks(self):
        f=fixture(); f['fail']='all-list'
        self.assert_failure('snapshot_unrelated before.snapshot',f,'RUNTIME_SNAPSHOT_FAILED')

    def test_duplicate_running_inventory_blocks(self):
        f=fixture(); f['all_override']=[API,WEB,API]
        self.assert_failure('snapshot_unrelated before.snapshot',f,'CONTAINER_ID_DUPLICATED')

    def test_replaced_target_during_snapshot_blocks(self):
        f=fixture(); f['all_override']=[WEB,WORKER]
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_SNAPSHOT_CHANGED')

    def test_recreated_own_api_is_allowed_by_before_after_comparison(self):
        after=fixture(); after['containers'][NEW_API]=after['containers'].pop(API); after['compose']['api']=[NEW_API]
        r,_,_,_=self.run_shell('snapshot_unrelated before.snapshot\ncp next.json "$FIXTURE_PATH"\nsnapshot_unrelated after.snapshot\ncmp before.snapshot after.snapshot',next_data=after)
        self.assertEqual(r.returncode,0,r.stderr)

    def test_lost_foreign_api_is_detected(self):
        after=fixture(); after['containers'][FOREIGN_API]['running']=False
        r,_,files,_=self.run_shell('snapshot_unrelated before.snapshot\ncp next.json "$FIXTURE_PATH"\nsnapshot_unrelated after.snapshot\ncmp -s before.snapshot after.snapshot',next_data=after)
        self.assertNotEqual(r.returncode,0)
        self.assertNotEqual(files['before.snapshot'],files['after.snapshot'])

    def test_recreated_owned_worker_is_allowed(self):
        after=fixture(); after['containers'][NEW_API]=after['containers'].pop(WORKER)
        r,_,_,_=self.run_shell('snapshot_unrelated before.snapshot\ncp next.json "$FIXTURE_PATH"\nsnapshot_unrelated after.snapshot\ncmp -s before.snapshot after.snapshot',next_data=after)
        self.assertEqual(r.returncode,0,r.stderr)

    def test_recreated_owned_broker_is_allowed(self):
        after=fixture(); replacement='d'*64; after['containers'][replacement]=after['containers'].pop(BROKER)
        r,_,_,_=self.run_shell('snapshot_unrelated before.snapshot\ncp next.json "$FIXTURE_PATH"\nsnapshot_unrelated after.snapshot\ncmp -s before.snapshot after.snapshot',next_data=after)
        self.assertEqual(r.returncode,0,r.stderr)

    def test_duplicate_owned_worker_is_rejected(self):
        f=fixture(); duplicate='e'*64; f['containers'][duplicate]={'project':'production','service':'outbox-worker','running':True,'restart':'always'}
        self.assert_failure('snapshot_unrelated before.snapshot',f,'TARGET_RUNTIME_AMBIGUOUS')

    def test_foreign_worker_change_is_detected(self):
        after=fixture(); after['containers'][FOREIGN_WORKER]['running']=False
        r,_,files,_=self.run_shell('snapshot_unrelated before.snapshot\ncp next.json "$FIXTURE_PATH"\nsnapshot_unrelated after.snapshot\ncmp -s before.snapshot after.snapshot',next_data=after)
        self.assertNotEqual(r.returncode,0)
        self.assertNotEqual(files['before.snapshot'],files['after.snapshot'])

    def test_only_own_watchtower_is_mutated_and_verified(self):
        r,calls,_,state=self.run_shell('retire_release_watchtower')
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual([x for x in calls if x[0] in ('update','stop')],[['update','--restart=no',WATCH],['stop',WATCH]])
        self.assertEqual(state['containers'][WATCH]['restart'],'no')
        self.assertFalse(state['containers'][WATCH]['running'])
        self.assertTrue(state['containers'][FOREIGN_WATCH]['running'])

    def test_no_own_watchtower_is_valid(self):
        f=fixture(); del f['containers'][WATCH]
        r,calls,_,_=self.run_shell('retire_release_watchtower',f)
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertFalse(any(x[0] in ('update','stop') for x in calls))

    def test_stopped_own_watchtower_restart_policy_is_retired(self):
        f=fixture(); f['containers'][WATCH]['running']=False
        r,_,_,state=self.run_shell('retire_release_watchtower',f)
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(state['containers'][WATCH]['restart'],'no')

    def test_watchtower_discovery_error_blocks_without_mutation(self):
        f=fixture(); f['fail']='watchtower-list'
        calls,_,_=self.assert_failure('retire_release_watchtower',f,'WATCHTOWER_DISCOVERY_FAILED')
        self.assertFalse(any(x[0] in ('update','stop') for x in calls))

    def test_foreign_watchtower_returned_by_docker_filter_is_rejected(self):
        f=fixture(); f['watchtower_override']=[FOREIGN_WATCH]
        calls,_,_=self.assert_failure('retire_release_watchtower',f,'TARGET_IDENTITY_MISMATCH')
        self.assertFalse(any(x[0] in ('update','stop') for x in calls))

    def test_update_error_is_not_silently_ignored(self):
        f=fixture(); f['fail']='update'
        self.assert_failure('retire_release_watchtower',f,'WATCHTOWER_UPDATE_FAILED')

    def test_stop_error_is_not_silently_ignored(self):
        f=fixture(); f['fail']='stop'
        self.assert_failure('retire_release_watchtower',f,'WATCHTOWER_STOP_FAILED')

    def test_successful_stop_command_with_running_container_is_rejected(self):
        f=fixture(); f['ignore_stop']=True
        self.assert_failure('retire_release_watchtower',f,'WATCHTOWER_NOT_RETIRED')

    def test_successful_update_command_with_restart_policy_is_rejected(self):
        f=fixture(); f['ignore_update']=True
        self.assert_failure('retire_release_watchtower',f,'WATCHTOWER_NOT_RETIRED')

    def test_watchtower_state_unreadable_is_rejected(self):
        f=fixture(); f['fail']='state'
        self.assert_failure('retire_release_watchtower',f,'WATCHTOWER_STATE_UNREADABLE')

    def test_new_watchtower_during_retirement_is_rejected(self):
        f=fixture(); f['add_watchtower_after_stop']=True
        self.assert_failure('retire_release_watchtower',f,'WATCHTOWER_SET_CHANGED')

    def test_retirement_preserves_unrelated_snapshot(self):
        r,_,_,_=self.run_shell('snapshot_unrelated before.snapshot\nretire_release_watchtower\nsnapshot_unrelated after.snapshot 1\ncmp before.snapshot after.snapshot')
        self.assertEqual(r.returncode,0,r.stderr)

    def test_restarted_watchtower_is_not_hidden_by_final_snapshot(self):
        after=fixture(); after['containers'][WATCH]['restart']='no'
        r,_,_,_=self.run_shell('snapshot_unrelated before.snapshot\nretire_release_watchtower\ncp next.json "$FIXTURE_PATH"\nsnapshot_unrelated after.snapshot 1',next_data=after)
        self.assertNotEqual(r.returncode,0)
        self.assertIn('WATCHTOWER_RUNNING_AFTER_RETIREMENT',r.stderr)

    def test_new_watchtower_after_retirement_blocks_final_snapshot(self):
        after=fixture(); after['containers'][WATCH].update(running=False,restart='no')
        after['containers']['c'*64]={'project':'production','service':'watchtower','running':True,'restart':'always'}
        r,_,_,_=self.run_shell('retire_release_watchtower\ncp next.json "$FIXTURE_PATH"\nsnapshot_unrelated after.snapshot 1',next_data=after)
        self.assertNotEqual(r.returncode,0)
        self.assertIn('WATCHTOWER_RUNNING_AFTER_RETIREMENT',r.stderr)

    def test_restored_restart_policy_blocks_final_snapshot(self):
        after=fixture(); after['containers'][WATCH]['running']=False
        r,_,_,_=self.run_shell('retire_release_watchtower\ncp next.json "$FIXTURE_PATH"\nsnapshot_unrelated after.snapshot 1',next_data=after)
        self.assertNotEqual(r.returncode,0)
        self.assertIn('WATCHTOWER_NOT_RETIRED',r.stderr)

    def test_invalid_snapshot_mode_blocks(self):
        self.assert_failure('snapshot_unrelated before.snapshot unsafe',fixture(),'SNAPSHOT_MODE_INVALID')

    def test_outer_flow_checks_helper_failures_before_admission(self):
        self.assertIn('resolve_release_runtime_project || fail RUNTIME_PROJECT_VALIDATION_FAILED',SOURCE)
        self.assertIn('snapshot_unrelated "$before_ids" || fail RUNTIME_ISOLATION_FAILED',SOURCE)
        self.assertIn('snapshot_unrelated "$after_ids" 1 || fail RUNTIME_ISOLATION_FAILED',SOURCE)
        self.assertIn('retire_release_watchtower || fail WATCHTOWER_RETIREMENT_FAILED',SOURCE)
        self.assertLess(SOURCE.index('snapshot_unrelated "$before_ids"'),SOURCE.index('RELEASE_ROLLBACK_ARMED=1'))
        self.assertNotIn('mapfile -t watchtower_ids < <(docker ps -aq',SOURCE)



# Exercise the whole real executor entrypoint, including streamed Bash origin,
# against a Docker fixture that rejects every non-read operation.
AUDIT_DOCKER = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
root=Path(__file__).resolve().parent; f=json.loads((root/'audit-fixture.json').read_text()); a=sys.argv[1:]
with open(root/'audit-calls.jsonl','a') as log: log.write(json.dumps(a)+'\n')
if f.get('docker_failure'):
    print('PRIVATE_VALUE_MUST_NOT_APPEAR',file=sys.stderr);sys.exit(23)
if a[0]=='compose':
    if a[-5:]==['config','--no-env-resolution','--no-interpolate','--format','json']:
        if '--env-file' not in a or a[a.index('--env-file')+1]!='/dev/null':sys.exit(91)
        if f.get('change_input'): (root/'compose.yml').write_text('services: {changed: {}}\n')
        model=f['model']
        if f.get('model_drift') and (root/'drift.flag').exists():model={**model,'name':'externally-changed'}
        print(json.dumps(model))
    else:sys.exit(92)
elif a[0]=='ps':
    role='api' if 'label=com.docker.compose.service=api' in a else 'web'
    print(('a' if role=='api' else 'b')*(64 if '--no-trunc' in a else 12))
elif a[0]=='inspect':
    role='api' if a[-1]=='a'*64 else 'web'
    if a[2]=='{{json .Config.Labels}}':
        print(json.dumps({'com.docker.compose.project':f.get('runtime_project','production'),
                         'com.docker.compose.project.working_dir':str(root),
                         'com.docker.compose.project.config_files':str(root/'compose.yml'),
                         'com.docker.compose.service':role,
                         'org.opencontainers.image.revision':('7' if f.get('spoof_label') else ('1' if role=='api' else '2'))*40}))
    else:print('sha256:'+('3' if role=='api' else '4')*64+'|running|healthy')
elif a[:2]==['image','inspect']:
    revision='1' if a[-1]=='sha256:'+'3'*64 else '2'
    if f.get('image_drift') and (root/'drift.flag').exists():revision='9'
    print(json.dumps({'org.opencontainers.image.revision':revision*40}))
elif a==['info','--format','{{.DockerRootDir}}']:print(root)
elif a==['volume','ls','-q']:
    if f.get('model_drift') or f.get('image_drift'):(root/'drift.flag').write_text('external observation fixture')
    print('\n'.join('volume-'+str(i) for i in range(19)))
else:
    print('MUTATION_FORBIDDEN',file=sys.stderr);sys.exit(93)
'''



class MigrationAuthorityReadOnlyAudit(unittest.TestCase):
    def audit(self, *, migrations=0, streamed=False, change_input=False,
              runtime_project='production', docker_failure=False, backup=False,
              symlink=False, malformed_selector=False, dsn_mismatch=False,
              raw_compose=None, fallback=False, spoof_label=False, model_drift=False, image_drift=False, unresolved_dsn=False):
        import base64
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'docker').write_text(AUDIT_DOCKER);(root/'docker').chmod(0o700)
            compose=root/'compose.yml';compose.write_text(raw_compose or 'services: {api: {}, web: {}}\n');compose.chmod(0o600)
            if symlink:
                compose.rename(root/'actual-compose.yml');compose.symlink_to(root/'actual-compose.yml')
            private='PRIVATE_VALUE_MUST_NOT_APPEAR'
            model={'name':'production','services':{'api':{'environment':{'AUTH_DATABASE_URL':'postgresql://runtime:'+private+'@database:5432/canonical?schema=public'}},'web':{}}}
            for i in range(migrations):
                model['services']['migration-'+str(i)]={'image':'grainflow-migration:exact','environment':{'DATABASE_URL':'postgresql://dedicated:'+private+'@'+('different' if dsn_mismatch else 'database')+':5432/canonical?schema=public'}}
            if unresolved_dsn and migrations:
                model['services']['migration-0']['environment']['DATABASE_URL']='postgresql://${USER}:${PASSWORD}@${HOST}/canonical'
            fixture={'model':model,'change_input':change_input,'runtime_project':runtime_project,'docker_failure':docker_failure,
                     'spoof_label':spoof_label,'model_drift':model_drift,'image_drift':image_drift}
            (root/'audit-fixture.json').write_text(json.dumps(fixture))
            encode=lambda value:base64.b64encode(str(value).encode()).decode()
            env={**os.environ,'PATH':str(root)+os.pathsep+os.environ['PATH'], 'AUDIT_FIXTURE_ROOT':str(root),
                 'PC_PROD_DIR_B64':encode(root),'PC_PROD_COMPOSE_B64':'%%%%' if malformed_selector else encode(compose),
                 'PC_PROD_PROJECT_B64':encode('production')}
            if fallback:
                env.pop('PC_PROD_DIR_B64',None);env.pop('PC_PROD_COMPOSE_B64',None);env.pop('PC_PROD_PROJECT_B64',None)
            for name in ['PC_PROD_BACKUP_EVIDENCE_FILE_B64','PC_BACKUP_EVIDENCE_FILE_B64']:
                env.pop(name,None)
            if backup:
                evidence=root/'backup-evidence';evidence.write_text('STATUS=PASS\n'+private);evidence.chmod(0o600)
                env['PC_PROD_BACKUP_EVIDENCE_FILE_B64']=encode(evidence)
            before={p.name:(p.lstat().st_mode, p.read_bytes()) for p in root.iterdir() if p.name not in ['audit-calls.jsonl','drift.flag'] and not p.is_symlink()}
            args=['audit','4'*40,'fixture-123']
            if streamed:
                result=subprocess.run(['bash','-s','--',*args],input=SOURCE,cwd=root,env=env,capture_output=True,text=True,timeout=30)
            else:
                result=subprocess.run(['bash',str(SCRIPT),*args],cwd=root,env=env,capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertNotIn(private,result.stdout+result.stderr)
            self.assertNotIn(str(root),result.stdout+result.stderr)
            report=json.loads(result.stdout)
            self.assertEqual(report['source_sha'],'4'*40)
            self.assertEqual(report['run_id'],'fixture-123')
            self.assertEqual(report['result'],'HOLD')
            self.assertEqual(report['production_mutation'],'NONE')
            self.assertEqual(report['release_eligibility'],'NOT_GRANTED')
            self.assertEqual(report['migration_principal'],'NOT_PROVEN')
            self.assertEqual(report['backup_integrity'],'NOT_PROVEN')
            self.assertEqual(report['reserve19_authority'],'NOT_PROVEN')
            self.assertEqual(report['private_cleanup'],'COMPLETE')
            after={p.name:(p.lstat().st_mode,p.read_bytes()) for p in root.iterdir() if p.name not in ['audit-calls.jsonl','drift.flag'] and not p.is_symlink()}
            if change_input:before.pop('compose.yml');after.pop('compose.yml')
            self.assertEqual(before,after)
            calls=[json.loads(x) for x in (root/'audit-calls.jsonl').read_text().splitlines()] if (root/'audit-calls.jsonl').exists() else []
            for call in calls:
                self.assertIn(call[0],['compose','inspect','image','info','volume','ps'])
                if call[0]=='compose':self.assertEqual(call[-5:],['config','--no-env-resolution','--no-interpolate','--format','json'])
                if call[0]=='ps':self.assertIn('--no-trunc',call)
                if call[0]=='volume':self.assertEqual(call,['volume','ls','-q'])
            return report,calls

    def test_streamed_zero_migration_is_complete_hold_and_never_creates_service(self):
        report,calls=self.audit(streamed=True)
        self.assertEqual(report['observation'],'COMPLETE')
        self.assertEqual(report['migration'],'MISSING')
        self.assertEqual(report['runtime_api_revision'],'1'*40)
        self.assertEqual(report['runtime_web_revision'],'2'*40)
        self.assertEqual(report['capacity'],'MEASURED')
        self.assertEqual(report['observed_volume_count'],19)
        self.assertEqual(report['input_stability'],'UNCHANGED')

    def test_one_url_configuration_is_not_privileged_principal_or_eligibility(self):
        report,_=self.audit(migrations=1)
        self.assertEqual(report['migration'],'ONE')
        self.assertEqual(report['migration_database'],'CONFIG_PARITY')
        self.assertEqual(report['migration_credential_reference'],'CONFIG_PRESENT')

    def test_two_candidates_do_not_select_the_first(self):
        report,_=self.audit(migrations=2)
        self.assertEqual(report['migration'],'AMBIGUOUS')
        self.assertEqual(report['migration_database'],'NOT_PROVEN')

    def test_database_mismatch_remains_explicit_hold(self):
        report,_=self.audit(migrations=1,dsn_mismatch=True)
        self.assertEqual(report['migration_database'],'CONFIG_MISMATCH')

    def test_invalid_project_reports_no_protected_paths_or_mutations(self):
        report,_=self.audit(runtime_project='other')
        self.assertEqual(report['observation'],'INCOMPLETE')
        self.assertEqual(report['reject_reason'],'PROJECT_MISMATCH')

    def test_changed_input_is_not_an_unchanged_snapshot(self):
        report,_=self.audit(change_input=True)
        self.assertEqual(report['observation'],'INCOMPLETE')
        self.assertEqual(report['input_stability'],'CHANGED')
        self.assertEqual(report['reject_reason'],'INPUTS_CHANGED')

    def test_backup_pass_substring_is_only_private_metadata(self):
        report,_=self.audit(backup=True)
        # A file created by this runner has its effective UID. Non-root CI
        # must observe the same owner rejection as the real executor.
        expected='PRESENT_PRIVATE' if os.geteuid()==0 else 'NOT_PROVEN'
        self.assertEqual(report['backup_metadata'],expected)
        self.assertEqual(report['backup_integrity'],'NOT_PROVEN')

    def test_actual_backup_metadata_guard_requires_root_private_regular_nonempty_file(self):
        import ast
        import stat
        from unittest import mock
        audit=SOURCE.split("<<'PY_MIGRATION_AUTHORITY_AUDIT'\n",1)[1].split('\nPY_MIGRATION_AUTHORITY_AUDIT',1)[0]
        # Execute the actual complete backup try/except, with real file opens
        # and metadata. Only the returned UID is controlled so every runner
        # proves both owner branches without chown, sudo or a runtime hook.
        blocks=[node for node in ast.walk(ast.parse(audit)) if isinstance(node,ast.Try)
                and any(isinstance(item,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='backup'
                            for target in item.targets) for item in node.body)]
        self.assertEqual(len(blocks),1)
        code=compile(ast.Module(body=blocks,type_ignores=[]),'actual-backup-metadata-guard','exec')
        real_fstat=os.fstat
        cases=[(0,mode,b'STATUS=PASS\n'+CANARY.encode(),'PRESENT_PRIVATE') for mode in (0o400,0o440,0o600,0o640)]
        cases += [(1000,0o600,b'STATUS=PASS\n'+CANARY.encode(),'NOT_PROVEN'),
                  (65534,0o600,b'STATUS=PASS\n'+CANARY.encode(),'NOT_PROVEN'),
                  (0,0o644,b'STATUS=PASS\n'+CANARY.encode(),'NOT_PROVEN'),
                  (0,0o600,b'','NOT_PROVEN')]
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for index,(owner,mode,contents,expected) in enumerate(cases):
                with self.subTest(owner=owner,mode=oct(mode),empty=not contents):
                    evidence=root/('backup-'+str(index));evidence.write_bytes(contents);evidence.chmod(mode)
                    report={'backup_metadata':'NOT_PROVEN','backup_integrity':'NOT_PROVEN'}
                    namespace={'os':os,'stat':stat,'Path':Path,'report':report,
                               'selector':lambda name:str(evidence) if name=='PC_PROD_BACKUP_EVIDENCE_FILE_B64' else ''}
                    def owned_metadata(fd):
                        metadata=list(real_fstat(fd));metadata[4]=owner
                        return os.stat_result(metadata)
                    with mock.patch.object(os,'fstat',side_effect=owned_metadata) as observed:
                        exec(code,namespace)
                    observed.assert_called_once()
                    self.assertEqual(report,{'backup_metadata':expected,'backup_integrity':'NOT_PROVEN'})
                    self.assertEqual(evidence.read_bytes(),contents)
                    self.assertEqual(stat.S_IMODE(evidence.stat().st_mode),mode)
                    self.assertNotIn(CANARY,json.dumps(report))
                    evidence.unlink()
            for kind in ('directory','symlink'):
                with self.subTest(kind=kind):
                    evidence=root/kind
                    if kind=='directory':evidence.mkdir()
                    else:evidence.symlink_to(root/'missing-private-target')
                    report={'backup_metadata':'NOT_PROVEN','backup_integrity':'NOT_PROVEN'}
                    namespace={'os':os,'stat':stat,'Path':Path,'report':report,'selector':lambda name:str(evidence)}
                    exec(code,namespace)
                    self.assertEqual(report,{'backup_metadata':'NOT_PROVEN','backup_integrity':'NOT_PROVEN'})

    def test_docker_errors_are_not_leaked_or_converted_to_observations(self):
        report,_=self.audit(docker_failure=True)
        self.assertEqual(report['observation'],'INCOMPLETE')
        self.assertEqual(report['reject_reason'],'READ_FAILED')

    def test_symlink_and_malformed_selectors_fail_closed_without_mutation(self):
        for variant in [{'symlink':True},{'malformed_selector':True}]:
            with self.subTest(variant=variant):
                report,_=self.audit(**variant)
                self.assertEqual(report['observation'],'INCOMPLETE')


    def test_realistic_fallback_requests_full_ids_before_inspect(self):
        report,calls=self.audit(fallback=True)
        self.assertEqual(report['observation'],'COMPLETE')
        self.assertTrue(any(c[:4]==['ps','--no-trunc','-q','--filter'] for c in calls))

    def test_image_revision_comes_from_exact_image_id_not_container_label(self):
        report,calls=self.audit(spoof_label=True)
        self.assertEqual(report['runtime_api_revision'],'1'*40)
        self.assertEqual(report['runtime_web_revision'],'2'*40)
        self.assertTrue(any(c[:2]==['image','inspect'] for c in calls))

    def test_image_and_model_changes_are_not_stable_observations(self):
        for changes in [{'model_drift':True},{'image_drift':True}]:
            with self.subTest(changes=changes):
                report,_=self.audit(**changes)
                self.assertEqual(report['input_stability'],'CHANGED')
                self.assertEqual(report['observation'],'INCOMPLETE')
                self.assertEqual(report['reject_reason'],'INPUTS_CHANGED')

    def test_implicit_environment_is_explicitly_unobserved_and_placeholders_are_not_parity(self):
        report,_=self.audit(migrations=1,unresolved_dsn=True)
        self.assertEqual(report['configuration_basis'],'SEALED_FILES_NO_ENV_RESOLUTION')
        self.assertEqual(report['environment_authority'],'NOT_OBSERVED')
        self.assertEqual(report['migration_database'],'NOT_PROVEN')
        self.assertEqual(report['migration_credential_reference'],'NOT_PROVEN')

    def test_indirect_compose_and_yaml_abuse_rejected_before_any_compose_command(self):
        values=['include: [oci://review.invalid/never-fetch]\nservices: {api: {}, web: {}}\n',
                'services: {api: {extends: {file: remote.yml}}, web: {}}\n',
                'services: {api: {provider: {type: model}}, web: {}}\n',
                '{"services":{"api":{},"web":{}},"inc\\u006cude":["remote"]}',
                'services: {api: {}, web: {}}\nservices: {}\n',
                'services: !unsafe {api: {}, web: {}}\n',
                '%YAML 1.2\n---\nservices: {api: {}, web: {}}\n',
                'services: &recursive {api: *recursive, web: {}}\n']
        for source in values:
            with self.subTest(source=source):
                report,calls=self.audit(raw_compose=source)
                self.assertEqual(report['observation'],'INCOMPLETE')
                self.assertFalse(any(c[0]=='compose' for c in calls))

    def test_output_overflow_and_timeout_kill_owned_process_group_without_raw_disk_file(self):
        import ast,sys,time
        audit=SOURCE.split("<<'PY_MIGRATION_AUTHORITY_AUDIT'\n",1)[1].split('\nPY_MIGRATION_AUTHORITY_AUDIT',1)[0]
        tree=ast.parse(audit)
        nodes=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef,ast.ClassDef,ast.Assign)) and not (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='report' for t in n.targets))]
        namespace={};exec(compile(ast.Module(body=nodes,type_ignores=[]),'actual-audit-functions','exec'),namespace)
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); marker=root/'survived'
            # A child would write after the overflowing parent. Neither may survive.
            child='import time;from pathlib import Path;time.sleep(.5);Path('+repr(str(marker))+').write_text("SURVIVED")'
            script='import subprocess,sys;subprocess.Popen([sys.executable,"-c",'+repr(child)+']);sys.stdout.write("X"*1048576);sys.stdout.flush()'
            namespace['DEADLINE']=time.monotonic()+3
            with self.assertRaises(ValueError):namespace['command']([sys.executable,'-c',script],1024)
            time.sleep(.6)
            self.assertFalse(marker.exists())
            namespace['DEADLINE']=time.monotonic()+.15
            started=time.monotonic()
            with self.assertRaises(ValueError):namespace['command']([sys.executable,'-c','import time;time.sleep(10)'],1024)
            self.assertLess(time.monotonic()-started,1)
            self.assertEqual(list(root.iterdir()),[])

    def test_ordered_model_resource_budgets_reject_unique_and_duplicate_inputs_before_compose(self):
        import ast,time
        from unittest import mock
        audit=SOURCE.split("<<'PY_MIGRATION_AUTHORITY_AUDIT'\n",1)[1].split('\nPY_MIGRATION_AUTHORITY_AUDIT',1)[0]
        tree=ast.parse(audit)
        nodes=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef,ast.ClassDef,ast.Assign)) and not (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='report' for t in n.targets))]
        namespace={};exec(compile(ast.Module(body=nodes,type_ignores=[]),'actual-audit-resource-bounds','exec'),namespace)
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            node_source='services: {api: {}, web: {}}\nx-many: ['+','.join('node'+str(i) for i in range(2000))+']\n'
            byte_source='services: {api: {}, web: {}}\nx-large: "'+'X'*200000+'"\n'
            alias_source='services: {api: {}, web: {}}\nx-anchor: &a [word]\nx-many: ['+','.join('*a' for _ in range(32))+']\n'
            deep_source='services: {api: {}, web: {}}\nx-depth: '+'['*65+'word'+']'*65+'\n'
            cases=[('duplicate-nodes',node_source,48,False,'nodes',65536),
                   ('unique-nodes',node_source,48,True,'nodes',65536),
                   ('duplicate-bytes',byte_source,48,False,'bytes',8388608),
                   ('duplicate-aliases',alias_source,40,False,'aliases',1024),
                   ('single-depth',deep_source,1,False,'depth',64)]
            for name,raw,count,unique,key,bound in cases:
                with self.subTest(name=name):
                    paths=[]
                    for index in range(count if unique else 1):
                        path=root/(name+str(index)+'.yml');path.write_text(raw);paths.append(str(path))
                    ordered=paths if unique else paths*count
                    calls=[]
                    namespace['command']=lambda args:(calls.append(args) or '{"name":"fixture","services":{"api":{},"web":{}}}')
                    namespace['DEADLINE']=time.monotonic()+15
                    if key!='depth':
                        cost=namespace['closed_compose_bytes'](raw.encode(),'no-trusted-custom-tags')
                        self.assertGreater(cost[key]*count,bound)
                    with mock.patch.object(namespace['tempfile'],'mkdtemp') as allocation:
                        with self.assertRaises(namespace['UnsupportedModel']):
                            with namespace['sealed_compose_inputs'](ordered,str(root),'fixture'):
                                self.fail('overbudget ordered model yielded')
                        allocation.assert_not_called()
                    self.assertEqual(calls,[])

    def test_normal_ordered_duplicate_inputs_are_preserved_and_owned_snapshots_removed(self):
        import ast,time,stat
        audit=SOURCE.split("<<'PY_MIGRATION_AUTHORITY_AUDIT'\n",1)[1].split('\nPY_MIGRATION_AUTHORITY_AUDIT',1)[0]
        tree=ast.parse(audit)
        nodes=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef,ast.ClassDef,ast.Assign)) and not (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='report' for t in n.targets))]
        namespace={};exec(compile(ast.Module(body=nodes,type_ignores=[]),'actual-audit-ordered-inputs','exec'),namespace)
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);first=root/'first.yml';second=root/'second.yml'
            first.write_text('services: {api: {}, web: {}}\nx-label: first\n')
            second.write_text('services: {api: {}, web: {}}\nx-label: second\n')
            ordered=[str(first),str(second),str(first)];calls=[]
            def render(args):
                calls.append(args)
                files=[Path(args[i+1]) for i,value in enumerate(args) if value=='-f']
                self.assertEqual([p.read_bytes() for p in files],[first.read_bytes(),second.read_bytes(),first.read_bytes()])
                self.assertEqual(files[0],files[2])
                self.assertTrue(all(stat.S_IMODE(p.stat().st_mode)==0o600 for p in files))
                self.assertTrue(all(stat.S_IMODE(p.parent.stat().st_mode)==0o700 for p in files))
                return '{"name":"fixture","services":{"api":{},"web":{}}}'
            namespace['command']=render;namespace['DEADLINE']=time.monotonic()+15
            with namespace['sealed_compose_inputs'](ordered,str(root),'fixture') as (before,command,model):
                self.assertEqual(set(before),{str(first),str(second)})
                self.assertEqual(model['name'],'fixture')
                snapshots=[Path(command[i+1]) for i,value in enumerate(command) if value=='-f']
                self.assertEqual(len(snapshots),3)
            self.assertEqual(len(calls),1)
            self.assertTrue(all(not p.exists() for p in snapshots))

    def test_copied_closed_grammar_and_upstream_bundle_match_accepted_web_source(self):
        import ast
        import textwrap
        source=(SCRIPT.parent.parent/'.github/workflows/production-web-exact-sha.yml').read_text()
        outer=source.split("python3 - <<'PY_WEB_READONLY_AUDIT'\n",1)[1].split('\n          PY_WEB_READONLY_AUDIT',1)[0]
        outer=textwrap.dedent(outer)
        collector=next(ast.literal_eval(n.value) for n in ast.parse(outer).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='COLLECTOR' for t in n.targets))
        audit=SOURCE.split("<<'PY_MIGRATION_AUTHORITY_AUDIT'\n",1)[1].split('\nPY_MIGRATION_AUTHORITY_AUDIT',1)[0]
        def selected(code):
            nodes=[]
            for n in ast.parse(code).body:
                if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id.startswith('PYYAML_') for t in n.targets):nodes.append(ast.dump(n,include_attributes=False))
                if isinstance(n,ast.FunctionDef) and n.name in ('closed_compose_bytes','event_parser_types','unique','decode'):nodes.append(ast.dump(n,include_attributes=False))
            return nodes
        self.assertEqual(selected(collector),selected(audit))





class MigrationAuthorityAuditControllerContracts(unittest.TestCase):
    def workflow(self):
        return (SCRIPT.parent.parent/'.github/workflows/production-full-stack-exact-sha.yml').read_text()

    def python_block(self, name):
        block=self.workflow().split("<<'"+name+"'\n",1)[1].split('\n          '+name,1)[0]
        return '\n'.join(line[10:] if line else '' for line in block.splitlines())+'\n'

    def test_contract_checkout_and_source_binding_run_before_every_native_or_contract_test(self):
        source=self.workflow().split('\n  contract:\n',1)[1].split('\n  deploy:\n',1)[0]
        self.assertIn('uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262',source)
        self.assertIn("ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}",source)
        self.assertIn('persist-credentials: false',source)
        binding=source.index('Verify immutable contract source before executing source tests')
        self.assertLess(binding,source.index('Reject every non-controller reusable release authority'))
        self.assertLess(binding,source.index('node scripts/check-production-full-stack-release.mjs'))
        self.assertLess(binding,source.index('python3 -B scripts/test-production-release-target-isolation.py'))
        self.assertNotIn('pull_request_target',source)

    def test_actual_contract_source_gate_accepts_prhead_push_owner_and_rejects_merge_or_missing_sha(self):
        source=self.workflow().split('      - name: Verify immutable contract source before executing source tests\n',1)[1].split('      - uses: actions/setup-node@v4',1)[0]
        shell=source.split('        run: |\n',1)[1]
        shell='\n'.join(line[10:] if line else '' for line in shell.splitlines())+'\n'
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            def git(*args):
                return subprocess.check_output(['git',*args],cwd=root,stderr=subprocess.DEVNULL,text=True).strip()
            git('init','-b','main');git('config','user.name','Source binding fixture');git('config','user.email','fixture@example.invalid')
            (root/'base').write_text('base');git('add','base');git('commit','-m','base')
            git('checkout','-b','pr');(root/'pr-file').write_text('head');git('add','pr-file');git('commit','-m','head');head=git('rev-parse','HEAD')
            git('checkout','main');(root/'main-file').write_text('main');git('add','main-file');git('commit','-m','main')
            git('merge','--no-ff','pr','-m','synthetic merge');merged=git('rev-parse','HEAD')
            cases=[('pull_request',head,head,merged,head,True),
                   ('pull_request',head,head,merged,merged,False),
                   ('pull_request',merged,head,merged,merged,False),
                   ('pull_request',merged,'',merged,merged,False),
                   ('pull_request','',head,merged,head,False),
                   ('pull_request',head[:7],head,merged,head,False),
                   ('push',merged,'',merged,merged,True),
                   ('issue_comment',merged,'',merged,merged,True),
                   ('issue_comment',head,'',merged,head,False),
                   ('push',merged,'','',merged,False),
                   ('pull_request_target',head,head,merged,head,False)]
            for event,expected,pr,event_sha,actual,accept in cases:
                with self.subTest(event=event,expected=expected,actual=actual,pr=pr):
                    git('checkout','--detach',actual)
                    env={**os.environ,'GITHUB_EVENT_NAME':event,'EXPECTED_SOURCE_SHA':expected,
                         'PR_HEAD_SHA':pr,'EVENT_SOURCE_SHA':event_sha}
                    result=subprocess.run(['bash','-c',shell],cwd=root,env=env,capture_output=True,text=True,timeout=5)
                    self.assertEqual(result.returncode==0,accept,result.stderr)
                    if accept:self.assertIn('CONTRACT_EXACT_SOURCE_SHA='+actual+' event='+event,result.stdout)
                    else:self.assertNotIn('CONTRACT_EXACT_SOURCE_SHA=',result.stdout)

    def test_actual_reusable_bash_gate_rejects_every_unauthorized_context(self):
        source=self.workflow().split('      - name: Reject every non-controller audit authority\n',1)[1].split('      - run: node scripts/check-production-full-stack-release.mjs',1)[0]
        shell=source.split('        run: |\n',1)[1]
        shell='\n'.join(line[10:] for line in shell.splitlines() if line.strip())+'\n'
        valid={'AUDIT_AUTHORIZED':'true','RELEASE_AUTHORIZED':'false','GITHUB_EVENT_NAME':'issue_comment',
               'TARGET_SHA':'4'*40,'EVENT_SHA':'4'*40,'CONTROLLER_ISSUE_NUMBER':'4637','EVENT_ISSUE_NUMBER':'4637',
               'COMMENTER':'owner','REPOSITORY_OWNER':'owner','ASSOCIATION':'OWNER','GITHUB_ACTOR':'owner',
               'GITHUB_TRIGGERING_ACTOR':'owner','COMMAND':'/production migration-authority-audit current-main'}
        variants=[{}, {'AUDIT_AUTHORIZED':'false'},{'RELEASE_AUTHORIZED':'true'}, {'GITHUB_EVENT_NAME':'push'},
                  {'TARGET_SHA':'bad'},{'EVENT_SHA':'5'*40},{'CONTROLLER_ISSUE_NUMBER':'3072'},
                  {'EVENT_ISSUE_NUMBER':'3072'},{'COMMENTER':'foreign'},{'ASSOCIATION':'MEMBER'},
                  {'GITHUB_ACTOR':'foreign'},{'GITHUB_TRIGGERING_ACTOR':'foreign'},
                  {'COMMAND':'/production release current-main'},{'COMMAND':'/production migration-authority-audit current-main extra'}]
        for variant in variants:
            with self.subTest(variant=variant):
                result=subprocess.run(['bash','-c',shell],env={**os.environ,**valid,**variant},capture_output=True,text=True,timeout=5)
                self.assertEqual(result.returncode==0,not variant)

    def test_actual_readonly_admission_verifier_is_closed_and_source_bound(self):
        import hashlib
        from unittest import mock
        code=self.python_block('PY_AUDIT_ADMISSION')
        paths=['.github/workflows/platform-v7-safe-merge.yml','.github/workflows/production-full-stack-exact-sha.yml',
               'scripts/production-full-stack-exact-sha.sh','scripts/check-production-full-stack-release.mjs',
               'scripts/test-production-release-target-isolation.py']
        repo=SCRIPT.parent.parent
        rows=[]
        for path in paths:
            data=(repo/path).read_bytes();mode='100755' if (repo/path).stat().st_mode & 0o111 else '100644'
            rows.append({'path':path,'mode':mode,'afterBlob':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(),'sha256':hashlib.sha256(data).hexdigest()})
        admission={'owner':'ACCOUNT_1_CORE','sourceBranch':'ops/production-migration-authority-repair-20261029',
                   'readOnly':True,'materializationAuthorized':False,'productionMutationAuthorized':False,'sourcePins':rows}
        real_read=Path.read_text
        def read(path,*args,**kwargs):
            if str(path)=='docs/platform-v7/autopilot/autopilot-state.json':return json.dumps(current)
            return real_read(path,*args,**kwargs)
        def git(args,**kwargs):
            self.assertEqual(args[:4],['git','ls-tree','HEAD','--'])
            row=next(row for row in rows if row['path']==args[-1])
            return row['mode']+' blob '+row['afterBlob']+'\t'+row['path']+'\n'
        variants=[None,{}, {'owner':'FOREIGN'}, {'readOnly':False}, {'materializationAuthorized':True},
                  {'productionMutationAuthorized':True}, {'sourceBranch':'other'}, {'sourcePins':rows[:-1]},
                  {'sourcePins':[{**rows[0],'sha256':'0'*64},*rows[1:]]},
                  {'sourcePins':[{**rows[0],'afterBlob':'0'*40},*rows[1:]]}]
        previous=Path.cwd()
        try:
            os.chdir(repo)
            for variant in variants:
                with self.subTest(variant=variant):
                    value=None if variant is None else {**admission,**variant}
                    current={'coordinationAdmissions':{'migration-authority-audit-20261029':value}}
                    with mock.patch.object(Path,'read_text',read),mock.patch.object(subprocess,'check_output',git):
                        if variant=={}:exec(compile(code,'actual-audit-admission','exec'),{})
                        else:
                            with self.assertRaises(AssertionError):exec(compile(code,'actual-audit-admission','exec'),{})
        finally:os.chdir(previous)

    def test_actual_response_validator_never_publishes_freeform_or_secret_fields(self):
        import sys
        helper=MigrationAuthorityReadOnlyAudit()
        report,_=helper.audit(streamed=True)
        code=self.python_block('PY_AUDIT_RESPONSE')
        variants=[({},True,True),({'result':'PASS'},False,False),({'private':'PRIVATE_VALUE_MUST_NOT_APPEAR'},False,False),
                  ({'model_sha256':'PRIVATE_VALUE_MUST_NOT_APPEAR'},False,False),({'observed_at':'PRIVATE_VALUE_MUST_NOT_APPEAR'},False,False),({'source_sha':'5'*40},False,False),
                  ({'migration_principal':'SUPERUSER'},False,False),({'docker_available_kib':True},False,False),
                  ({'observation':'INCOMPLETE','reject_reason':'READ_FAILED'},False,True)]
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for index,(change,success,written) in enumerate(variants):
                with self.subTest(change=change):
                    source=root/str(index);destination=root/(str(index)+'.json');source.write_text(json.dumps({**report,**change}))
                    env={**os.environ,'TARGET_SHA':'4'*40,'GITHUB_RUN_ID':'fixture-123'}
                    result=subprocess.run([sys.executable,'-I','-c',code,str(source),str(destination)],env=env,capture_output=True,text=True,timeout=5)
                    self.assertEqual(result.returncode==0,success)
                    self.assertEqual(destination.exists(),written)
                    self.assertNotIn(CANARY,result.stdout+result.stderr)
                    if destination.exists():self.assertNotIn(CANARY,destination.read_text())


def native_environment_values(value):
    """Read both Compose JSON environment forms without resolving any value."""
    if type(value) is dict:
        assert all(type(k) is str and k and '=' not in k and type(v) is str
                   for k,v in value.items())
        return dict(value)
    assert type(value) is list
    result={}
    for item in value:
        assert type(item) is str
        key,separator,content=item.partition('=')
        assert separator and key and key not in result
        result[key]=content
    return result


class NativeEnvironmentShapeContracts(unittest.TestCase):
    def test_mapping_and_list_retain_literal_values_and_empty_or_equals_values(self):
        expected={'ORDER':'first','INLINE':'${PC_AUDIT_CANARY}','EMPTY':'','EQUALS':'a=b'}
        self.assertEqual(native_environment_values(expected),expected)
        self.assertEqual(native_environment_values([k+'='+v for k,v in expected.items()]),expected)
        self.assertEqual(native_environment_values({}),{})
        self.assertEqual(native_environment_values([]),{})

    def test_ambiguous_or_unsupported_environment_is_rejected(self):
        for value in (None,True,'ORDER=first',{'ORDER':None},{'ORDER':1},{'': 'x'},
                      {'ORDER=BAD':'x'},{1:'x'},['ORDER'],['=first'],[None],
                      ['ORDER=first','ORDER=second'],[['ORDER','first']]):
            with self.subTest(value=value):
                with self.assertRaises(AssertionError):native_environment_values(value)


def native_migration_audit_config():
    """No Docker Engine/create/pull: execute the actual sealed config helper."""
    import ast
    import shutil
    import stat
    import time
    docker=shutil.which('docker')
    if not docker:
        print('MIGRATION_AUDIT_NATIVE_CONFIG=NOT_AVAILABLE',flush=True)
        return False
    version=subprocess.run([docker,'compose','version'],capture_output=True,timeout=10)
    if version.returncode:
        print('MIGRATION_AUDIT_NATIVE_CONFIG=NOT_AVAILABLE',flush=True)
        return False
    audit=SOURCE.split("<<'PY_MIGRATION_AUTHORITY_AUDIT'\n",1)[1].split('\nPY_MIGRATION_AUTHORITY_AUDIT',1)[0]
    tree=ast.parse(audit)
    nodes=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef,ast.ClassDef,ast.Assign)) and not (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='report' for t in n.targets))]
    namespace={};exec(compile(ast.Module(body=nodes,type_ignores=[]),'actual-audit-native-config','exec'),namespace)
    original=namespace['command']; calls=[]
    def observed(args,*a,**kw):
        calls.append(args)
        return original(args,*a,**kw)
    namespace['command']=observed
    with tempfile.TemporaryDirectory(prefix='pc-migration-native-') as directory:
        root=Path(directory)
        implicit=root/'.env';implicit.write_text('PC_AUDIT_CANARY=PRIVATE_VALUE_MUST_NOT_APPEAR\n')
        secret=root/'service.env';secret.write_text('PRIVATE_VALUE_MUST_NOT_APPEAR=secret\n');secret.chmod(0o600)
        first=root/'base.yml';first.write_text('services:\n  api:\n    image: example.invalid/audit:no-pull\n    env_file: [service.env]\n    environment:\n      INLINE: "${PC_AUDIT_CANARY}"\n      ORDER: first\n  web:\n    image: example.invalid/audit:no-pull\n')
        second=root/'override.yml';second.write_text('services:\n  api:\n    environment:\n      ORDER: second\n')
        before={x.name:(x.stat().st_mode,x.read_bytes()) for x in root.iterdir()}
        cases=[([first],'explicit-audit','first'),([first],'','first'),
               ([first,second],'explicit-audit','second'),([second,first],'explicit-audit','first')]
        for ordered,project,expected in cases:
            namespace['DEADLINE']=time.monotonic()+30
            with namespace['sealed_compose_inputs']([str(x) for x in ordered],str(root),project) as (raw,command,model):
                assert model['name']==(project or root.name)
                environment=native_environment_values(model['services']['api']['environment'])
                assert environment['ORDER']==expected
                assert environment['INLINE']=='${PC_AUDIT_CANARY}'
                assert 'PRIVATE_VALUE_MUST_NOT_APPEAR' not in json.dumps(model)
                assert namespace['decode'](original(command).encode())==model
                paths=[Path(command[i+1]) for i,x in enumerate(command) if x=='-f']
                assert len(paths)==len(ordered)
                assert all(stat.S_IMODE(x.stat().st_mode)==0o600 for x in paths)
                assert all(stat.S_IMODE(x.parent.stat().st_mode)==0o700 for x in paths)
            assert all(not x.exists() for x in paths)
        assert before=={x.name:(x.stat().st_mode,x.read_bytes()) for x in root.iterdir()}
        indirect=root/'indirect.yml';indirect.write_text('include: [oci://review.invalid/never-fetch]\nservices: {api: {}, web: {}}\n')
        count=len(calls)
        try:
            with namespace['sealed_compose_inputs']([str(indirect)],str(root),'explicit-audit'):
                raise AssertionError('unsafe include was accepted')
        except namespace['UnsupportedModel']:
            pass
        assert len(calls)==count
    print('MIGRATION_AUDIT_NATIVE_CONFIG=PASS cases=5 source=actual-sealed-helper engine_mutation=NONE',flush=True)
    return True


if __name__=='__main__':
    import sys
    result=unittest.main(verbosity=2,exit=False).result
    if not result.wasSuccessful():raise SystemExit(1)
    native=native_migration_audit_config()
    # Hosted contract execution must prove real Compose support on this head.
    # Local absence is recorded accurately and never promoted to native PASS.
    if not native and os.environ.get('GITHUB_ACTIONS')=='true':raise SystemExit(1)
