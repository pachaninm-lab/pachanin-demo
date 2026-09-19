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
API, WEB, WATCH, FOREIGN_API, FOREIGN_WEB, FOREIGN_WATCH, WORKER, NEW_API = [c * 64 for c in '12345678']

DOCKER = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
p=Path(os.environ['FIXTURE_PATH']); f=json.loads(p.read_text()); a=sys.argv[1:]
with open(os.environ['DOCKER_CALLS'],'a') as log: log.write(json.dumps(a)+'\n')
kind=a[0]
if kind=='compose': kind='compose-'+a[-1]
if kind=='ps': kind='watchtower-list' if '-aq' in a else 'all-list'
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
        ids=[i for i,c in containers.items() if c['service']=='watchtower' and (project is None or c['project']==project)]
        ids=f.get('watchtower_override',ids)
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
        containers['9'*64]={'project':'production','service':'watchtower','running':True,'restart':'always'}
    p.write_text(json.dumps(f))
else: sys.exit(25)
'''


def fixture():
    values = [(API,'production','api'), (WEB,'production','web'),
              (WATCH,'production','watchtower'), (FOREIGN_API,'other','api'),
              (FOREIGN_WEB,'other','web'), (FOREIGN_WATCH,'other','watchtower'),
              (WORKER,'production','outbox-worker')]
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
                    f'api_id={API}\nweb_id={WEB}\nprod_project={shlex.quote(project)}\nruntime_project=""\n' +
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

    def test_other_projects_and_worker_stay_in_snapshot(self):
        r,_,files,_=self.run_shell('snapshot_unrelated before.snapshot')
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(files['before.snapshot'].splitlines(),[FOREIGN_API,FOREIGN_WEB,FOREIGN_WATCH,WORKER])

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

    def test_recreated_worker_is_detected_until_rollout_authorized(self):
        after=fixture(); after['containers'][NEW_API]=after['containers'].pop(WORKER)
        r,_,_,_=self.run_shell('snapshot_unrelated before.snapshot\ncp next.json "$FIXTURE_PATH"\nsnapshot_unrelated after.snapshot\ncmp -s before.snapshot after.snapshot',next_data=after)
        self.assertNotEqual(r.returncode,0)

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
        after['containers']['9'*64]={'project':'production','service':'watchtower','running':True,'restart':'always'}
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


if __name__=='__main__': unittest.main(verbosity=2)
