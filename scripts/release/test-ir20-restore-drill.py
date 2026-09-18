#!/usr/bin/env python3
"""Exercise the actual shell executor with synthetic Docker, never production."""
import errno
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

SCRIPT = Path(__file__).with_name('ir20-restore-drill.sh')
SOURCE = 'a' * 64
RESTORE = 'b' * 64
SHA = 'c' * 40
CANARY = 'SYNTHETIC_SECRET_DO_NOT_EMIT'
FAKE = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
root=pathlib.Path(os.environ['FAKE_ROOT']); a=sys.argv[1:]
with (root/'calls').open('a') as f:f.write(json.dumps(a)+'\n')
assert a[:2]==['--host','unix:///var/run/docker.sock']; a=a[2:]
mode=os.environ.get('CASE',''); source='a'*64; restored='b'*64; image='sha256:'+'d'*64
state=root/'state.json'
def error():
 print('SYNTHETIC_SECRET_DO_NOT_EMIT',file=sys.stderr); sys.exit(23)
def source_row():
 c={'Id':source,'Image':image,'Config':{'Env':['PG_MAJOR=16','POSTGRES_DB=grainflow','POSTGRES_USER=postgres','PASSWORD=SYNTHETIC_SECRET_DO_NOT_EMIT'],
 'Labels':{'com.docker.compose.project':'production','com.docker.compose.service':'postgres'}},'State':{'Running':True,'StartedAt':'fixed'}}
 if mode=='project':c['Config']['Labels']['com.docker.compose.project']='foreign'
 if mode=='stopped':c['State']['Running']=False
 if mode=='major':c['Config']['Env'][0]='PG_MAJOR=17'
 if mode=='duplicate_env':c['Config']['Env'].append('PG_MAJOR=16')
 if mode=='dbname':c['Config']['Env'][1]='POSTGRES_DB=postgresql://secret@foreign/db'
 if mode=='image_id':c['Image']='mutable:latest'
 if mode=='source_drift' and state.exists():c['State']['StartedAt']='changed'
 return c
if a[:2]==['container','inspect']:
 target=a[-1]
 if target==source:
  output=pathlib.Path(os.readlink('/proc/self/fd/1'))
  if output.name=='source-before.json':
   assert output.parent.parent==pathlib.Path('/var/lib/pc-release-authority/backups/ir20')
   (root/'backup-location').write_text(str(output.parent))
  if mode=='source_transport':error()
  print(json.dumps([source_row()]));sys.exit()
 if not state.exists():sys.exit(1)
 s=json.loads(state.read_text())
 if '--format' in a:
  if mode=='cleanup_transport':error()
  print(restored+(' '+s['run'] if 'pc-crop.ir20-restore' in a[a.index('--format')+1] else ''));sys.exit()
 c={'Id':restored,'Image':image,'Config':{'Labels':{'pc-crop.ir20-restore':s['run']},'User':'999:999'},
 'State':{'Running':False},'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Privileged':False,
 'Memory':805306368,'MemorySwap':805306368,'NanoCpus':1000000000,'PidsLimit':128,'CapDrop':['ALL'],
 'SecurityOpt':['no-new-privileges'],'Tmpfs':{'/var/lib/postgresql/data':'','/var/run/postgresql':'','/tmp':''}}}
 mutations={'network':('NetworkMode','host'),'privileged':('Privileged',True),'bind':('Binds',['/:/host']),
 'ports':('PortBindings',{'5432/tcp':[{}]}),'memory':('Memory',0),'cpu':('NanoCpus',0),
 'caps':('CapAdd',['SYS_ADMIN']),'mounts':('Mounts',[{}]),'pids':('PidsLimit',0),'readonly':('ReadonlyRootfs',False)}
 if mode in mutations:k,v=mutations[mode];c['HostConfig'][k]=v
 if mode=='user':c['Config']['User']='0:0'
 if mode=='restore_image':c['Image']='sha256:'+'e'*64
 print(json.dumps([c]));sys.exit()
if a[:2]==['image','inspect']:
 c={'Entrypoint':['docker-entrypoint.sh'],'Cmd':['postgres'],'Env':['PG_MAJOR=16'],'Volumes':{'/var/lib/postgresql/data':{}}}
 if mode=='entrypoint':c['Entrypoint']=['untrusted']
 if mode=='volumes':c['Volumes']['/unbounded']={}
 print(json.dumps([{'Id':image,'Config':c}]));sys.exit()
if a[0]=='create':
 run=a[a.index('--label')+1].split('=',1)[1]
 state.write_text(json.dumps({'run':run,'name':a[a.index('--name')+1]}))
 if mode=='create_unknown':error()
 print(source if mode=='same_id' else restored);sys.exit()
if a[0]=='start':
 if mode=='start':error()
 print(restored);sys.exit()
if a[0]=='rm':
 assert a[-1]==restored
 if mode=='cleanup':error()
 if mode=='cleanup_noop':sys.exit()
 state.unlink();sys.exit()
if a[0]=='ps':
 assert a==['ps','-aq','--no-trunc','--filter','id='+restored]
 if mode=='cleanup_inventory_transport':error()
 if mode=='cleanup_inventory_invalid':print('SYNTHETIC_SECRET_DO_NOT_EMIT');sys.exit()
 if mode=='cleanup_inventory_wrong':print(source);sys.exit()
 if state.exists():print(restored)
 sys.exit()
if a[0]=='exec':
 target=source if source in a else restored
 if 'id' in a:
  print('0' if mode=='uid' else '999');sys.exit()
 if 'pg_isready' in a:sys.exit()
 if 'pg_dumpall' in a:
  f=root/'roles-count'; n=int(f.read_text())+1 if f.exists() else 1;f.write_text(str(n))
  if mode=='roles_export':error()
  role='changed' if mode=='roles_changed' and n==2 else 'postgres'
  key=('A' if n==1 else 'B')*64
  print('\\restrict '+key+'\nCREATE ROLE '+role+';\n\\unrestrict '+key);sys.exit()
 if 'pg_dump' in a:
  if mode=='dump':error()
  print('synthetic archive');sys.exit()
 if 'pg_restore' in a:
  sys.stdin.buffer.read()
  if mode=='restore':error()
  sys.exit()
 if 'psql' in a:
  for line in sys.stdin:
   if 'SELECT (current_user' in line:print('0' if mode=='db_authority' else '1',flush=True)
   elif 'pg_export_snapshot' in line:
    print('bad' if mode in ('snapshot','snapshot_closed_invalid') else '00000003-0000001A-1',flush=True)
    if mode.startswith('snapshot_closed_'):sys.exit(23)
   elif line.startswith('COPY'):
    if mode=='snapshot_closed_fingerprint' and target==source:
     counter=root/'fingerprints'; n=int(counter.read_text())+1 if counter.exists() else 1
     counter.write_text(str(n))
     if n==6:error()
    if mode=='fingerprint' and target==source:error()
    print('{"id":"changed"}' if mode=='mismatch' and target==restored else '{"id":"synthetic"}',flush=True)
   elif line.strip()=='\\q':break
  sys.exit()
error()
'''


@unittest.skipUnless(os.geteuid() == 0, 'executor requires root; CI uses sudo')
class DrillTests(unittest.TestCase):
    def run_case(self, case='', args=None):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'python3').symlink_to(sys.executable)
            fake = root / 'docker'
            fake.write_text(FAKE)
            fake.chmod(0o700)
            env = dict(os.environ, PATH=str(root)+os.pathsep+os.environ['PATH'],
                       FAKE_ROOT=str(root), CASE=case, DOCKER_HOST='tcp://forbidden:2375',
                       DOCKER_CONTEXT='foreign', PYTHONOPTIMIZE='1')
            result = subprocess.run(['bash', str(SCRIPT), *(args or [SHA, SOURCE, 'production'])],
                                    env=env, capture_output=True, text=True, timeout=90)
            self.assertNotIn(CANARY, result.stdout+result.stderr)
            calls = [json.loads(v) for v in (root/'calls').read_text().splitlines()] if (root/'calls').exists() else []
            self.assertFalse(any(v[2] in ('pull','stop','restart','update','kill') for v in calls))
            self.assertFalse(any(v[2]=='rm' and SOURCE in v for v in calls))
            if (root/'backup-location').exists():
                backup=Path((root/'backup-location').read_text())
                self.assertEqual(backup.parent,Path('/var/lib/pc-release-authority/backups/ir20'))
                # Only the intended protected backup/roles and a final report may remain.
                remnants=sorted(p.name for p in backup.iterdir()
                                if p.name not in ('database.dump','roles.sql','report.json'))
                self.assertEqual(remnants, [], 'sensitive temporary files survived cleanup')
            return result, calls

    def test_actual_executor_happy_path_and_local_daemon(self):
        result, calls = self.run_case()
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report['target_sha'], SHA)
        self.assertFalse(report['deployment_authorized'])
        self.assertEqual(report['live_delivery'], 'NOT_PERFORMED')
        self.assertEqual(len(report['checks']), 6)
        self.assertTrue(all(v['rows']==1 for v in report['checks'].values()))
        self.assertEqual(sum(v[2]=='create' for v in calls), 1)
        create = next(v for v in calls if v[2]=='create')
        self.assertIn('--pull=never', create)
        self.assertEqual(create[create.index('--network')+1], 'none')
        self.assertEqual(sum(v[2]=='rm' for v in calls), 1)
        inventory = [v for v in calls if v[2]=='ps']
        self.assertEqual(inventory, [['--host','unix:///var/run/docker.sock',
                                     'ps','-aq','--no-trunc','--filter','id='+RESTORE]])
        self.assertGreater(calls.index(inventory[0]),
                           next(i for i,v in enumerate(calls) if v[2]=='rm'))
        restore = next(v for v in calls if 'pg_restore' in v)
        self.assertIn('--exit-on-error', restore)
        self.assertNotIn('--no-owner', restore)
        self.assertNotIn('--no-acl', restore)
        for call in calls:
            if any(tool in call for tool in ('psql','pg_dump','pg_dumpall','pg_restore')):
                target = SOURCE if SOURCE in call else RESTORE
                self.assertEqual(call[call.index(target)+1:call.index(target)+8],
                                 ['env','-u','PGSERVICE','-u','PGSERVICEFILE','-u','PGHOSTADDR'])
                self.assertNotIn('PGSERVICE=',call)

    def test_input_rejections_do_not_call_docker(self):
        for args in ([SHA[:7],SOURCE,'production'],[SHA,SOURCE[:12],'production'],[SHA,SOURCE,'../other']):
            with self.subTest(args=args):
                result,calls=self.run_case(args=args)
                self.assertNotEqual(result.returncode,0)
                self.assertEqual(calls,[])

    def test_source_failures_prevent_restore_creation(self):
        for case in ('project','stopped','major','duplicate_env','dbname','image_id','source_transport',
                     'entrypoint','volumes','uid','db_authority','snapshot','fingerprint','roles_export','dump','roles_changed'):
            with self.subTest(case=case):
                result,calls=self.run_case(case)
                self.assertNotEqual(result.returncode,0)
                self.assertEqual(result.stdout,'')
                self.assertFalse(any(v[2]=='create' for v in calls))

    def test_isolation_defects_prevent_start_and_are_cleaned(self):
        for case in ('network','privileged','bind','ports','memory','cpu','caps','mounts','pids','readonly','user','restore_image'):
            with self.subTest(case=case):
                result,calls=self.run_case(case)
                self.assertNotEqual(result.returncode,0)
                self.assertEqual(result.stdout,'')
                self.assertFalse(any(v[2]=='start' for v in calls))
                self.assertTrue(any(v[2]=='rm' for v in calls))

    def test_restore_and_cleanup_failures_never_emit_pass(self):
        for case in ('create_unknown','same_id','start','restore','mismatch','source_drift','cleanup','cleanup_transport'):
            with self.subTest(case=case):
                result,calls=self.run_case(case)
                self.assertNotEqual(result.returncode,0)
                self.assertEqual(result.stdout,'')
                if case!='cleanup_transport':
                    self.assertTrue(any(v[2]=='rm' for v in calls))

    def test_delete_acknowledgement_without_proven_absence_never_emits_pass(self):
        for case in ('cleanup_noop', 'cleanup_inventory_transport',
                     'cleanup_inventory_invalid', 'cleanup_inventory_wrong'):
            with self.subTest(case=case):
                result,calls=self.run_case(case)
                self.assertNotEqual(result.returncode,0)
                self.assertEqual(result.stdout,'')
                self.assertIn('IR20_RESTORE_ERROR=CLEANUP_NOT_PROVEN',result.stderr)
                self.assertEqual(sum(v[2]=='rm' for v in calls),1)
                self.assertEqual(sum(v[2]=='ps' for v in calls),1)

    def test_closed_snapshot_input_does_not_terminate_parent_or_skip_cleanup(self):
        cases={'snapshot_closed_valid':'SNAPSHOT_END',
               'snapshot_closed_invalid':'SNAPSHOT_ID',
               'snapshot_closed_fingerprint':'SOURCE_FINGERPRINT'}
        for case,code in cases.items():
            with self.subTest(case=case):
                result,calls=self.run_case(case)
                self.assertEqual(result.returncode,1,result.stderr)
                self.assertEqual(result.stdout,'')
                self.assertIn('IR20_RESTORE_ERROR='+code,result.stderr)
                self.assertIn('IR20_RESTORE_RESULT=NOT_VERIFIED',result.stderr)
                self.assertFalse(any(v[2]=='create' for v in calls))


class DurabilityTests(unittest.TestCase):
    def run_finalizer(self, fail_at=None, missing_archive=False):
        # Execute the exact embedded finalizer, not a rewritten model of it.
        matches = re.findall(r"<<'PYSYNC'[^\n]*\n(.*?)^PYSYNC$",
                             SCRIPT.read_text(), re.MULTILINE | re.DOTALL)
        self.assertEqual(len(matches), 1)
        code = compile(matches[0], str(SCRIPT) + ':PYSYNC', 'exec')
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / 'backups' / 'ir20' / 'run'
            directory.mkdir(parents=True)
            archive = directory / 'database.dump'
            roles = directory / 'roles.sql'
            pending = directory / 'report.pending.json'
            final = directory / 'report.json'
            archive.write_bytes(b'synthetic archive')
            roles.write_bytes(b'synthetic roles')
            pending.write_text('{"synthetic":true}\n')
            if missing_archive:
                archive.unlink()
            expected = [('fsync', str(path)) for path in
                        (archive, roles, pending, directory, *directory.parents)]
            expected += [('replace', str(pending), str(final)), ('fsync', str(directory))]
            events = []
            real_fsync, real_replace = os.fsync, os.replace

            def observe(event):
                events.append(event)
                if fail_at == len(events) - 1:
                    raise OSError(errno.EIO, 'synthetic durability failure')

            def fsync(fd):
                observe(('fsync', os.readlink('/proc/self/fd/' + str(fd))))
                return real_fsync(fd)

            def replace(source, target):
                observe(('replace', str(source), str(target)))
                return real_replace(source, target)

            error = None
            with mock.patch.object(sys, 'argv', ['-', str(directory)]), \
                    mock.patch.object(os, 'fsync', fsync), \
                    mock.patch.object(os, 'replace', replace):
                try:
                    exec(code, {'__name__': '__main__'})
                except OSError as caught:
                    error = caught
            return {'events': events, 'expected': expected, 'error': error,
                    'final': final.exists(), 'pending': pending.exists(),
                    'archive': archive.read_bytes() if archive.exists() else None,
                    'roles': roles.read_bytes()}

    def test_archive_and_ancestor_entries_are_synced_before_report_publication(self):
        result = self.run_finalizer()
        self.assertIsNone(result['error'])
        self.assertEqual(result['events'], result['expected'])
        self.assertTrue(result['final'])
        self.assertFalse(result['pending'])

    def test_each_durability_failure_removes_report_markers_and_preserves_backup(self):
        count = len(self.run_finalizer()['expected'])
        for fail_at in range(count):
            with self.subTest(fail_at=fail_at):
                result = self.run_finalizer(fail_at=fail_at)
                self.assertIsInstance(result['error'], OSError)
                self.assertFalse(result['final'])
                self.assertFalse(result['pending'])
                self.assertEqual(result['archive'], b'synthetic archive')
                self.assertEqual(result['roles'], b'synthetic roles')

    def test_missing_archive_cannot_leave_success_or_pending_report(self):
        result = self.run_finalizer(missing_archive=True)
        self.assertIsInstance(result['error'], FileNotFoundError)
        self.assertFalse(result['final'])
        self.assertFalse(result['pending'])
        self.assertEqual(result['roles'], b'synthetic roles')


if __name__ == '__main__':
    unittest.main(verbosity=2)
