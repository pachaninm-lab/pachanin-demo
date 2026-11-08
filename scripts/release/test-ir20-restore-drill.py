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


class OptionalReviewEvidenceTests(unittest.TestCase):
    def setUp(self):
        import textwrap
        workflow = SCRIPT.parents[2] / '.github/workflows/ir20-restore-drill.yml'
        text = workflow.read_text()
        matches = re.findall(r"<<'PY_REVIEW_AGENT'[^\n]*\n(.*?)^          PY_REVIEW_AGENT$",
                             text, re.MULTILINE | re.DOTALL)
        self.assertEqual(len(matches), 1)
        self.namespace = {'__name__':'review_evidence_test'}
        exec(compile(textwrap.dedent(matches[0]), str(workflow), 'exec'), self.namespace)
        self.paths = self.namespace['PATHS']
        self.lines = {p:10000 for p in self.paths}
        self.candidate = {
            'reviewed_head_sha':SHA, 'verdict':'PASS', 'tests_executed':False,
            'deployment_approval':False,
            'files':[{'path':p, 'analysis':'Synthetic validator fixture only; this is not an actual source review. '*2,
                      'line_refs':[1]} for p in self.paths],
            'areas':{a:'Synthetic validator fixture only; this is not an actual source review. '*2
                     for a in self.namespace['AREAS']},
            'findings':[], 'limitations':['Synthetic schema tests do not execute a model or supply independent review.']}
        self.response = {'stop_type':'eos', 'truncated':False, 'tokens_evaluated':100}

    def validate(self):
        self.response['content'] = json.dumps(self.candidate)
        return self.namespace['validate_candidate'](self.response, SHA, self.lines, 100)

    def test_well_formed_candidate_is_not_deployment_approval(self):
        result = self.validate()
        self.assertFalse(result['deployment_approval'])
        self.assertFalse(result['tests_executed'])

    def test_context_or_generation_truncation_is_not_review(self):
        for key,value in [('truncated',True),('stop_type','limit'),('tokens_evaluated',99)]:
            with self.subTest(key=key):
                old=self.response[key];self.response[key]=value
                with self.assertRaises(ValueError):self.validate()
                self.response[key]=old

    def test_wrong_sha_incomplete_files_or_missing_area_is_not_review(self):
        for mode in ('sha','file','duplicate','area','analysis','line','bool-line'):
            with self.subTest(mode=mode):
                saved=json.loads(json.dumps(self.candidate))
                if mode=='sha':self.candidate['reviewed_head_sha']='0'*40
                elif mode=='file':self.candidate['files'].pop()
                elif mode=='duplicate':self.candidate['files'][0]=self.candidate['files'][1]
                elif mode=='area':self.candidate['areas'].pop(next(iter(self.candidate['areas'])))
                elif mode=='analysis':self.candidate['files'][0]['analysis']='PASS'
                elif mode=='line':self.candidate['files'][0]['line_refs']=[10001]
                else:self.candidate['files'][0]['line_refs']=[True]
                with self.assertRaises(ValueError):self.validate()
                self.candidate=saved

    def test_blocking_finding_cannot_coexist_with_pass(self):
        self.candidate['findings']=[{'path':self.paths[0],'line':1,'severity':'P1',
            'problem':'Synthetic blocking defect for validator regression only.',
            'fix':'Synthetic required correction for validator regression only.'}]
        with self.assertRaises(ValueError):self.validate()
        self.candidate['verdict']='BLOCKED'
        self.assertEqual(self.validate()['verdict'],'BLOCKED')

    def test_fabricated_test_or_deployment_claim_is_not_review(self):
        for key in ('tests_executed','deployment_approval'):
            with self.subTest(key=key):
                self.candidate[key]=True
                with self.assertRaises(ValueError):self.validate()
                self.candidate[key]=False

    def test_malformed_oversized_or_incomplete_response_is_not_review(self):
        for content in ('not json','[]','x'*98305):
            with self.subTest(content=content[:10]):
                self.response['content']=content
                with self.assertRaises((ValueError,TypeError)):
                    self.namespace['validate_candidate'](self.response,SHA,self.lines,100)


class ReviewDiagnosticsTests(unittest.TestCase):
    def setUp(self):
        import textwrap
        self.workflow = SCRIPT.parents[2]/'.github/workflows/ir20-restore-drill.yml'
        self.text = self.workflow.read_text()
        self.agents = {}
        for tag in ('PY_REVIEW_AGENT','PY_REVIEW_RECORD'):
            matches = re.findall(r"<<'"+tag+r"'[^\n]*\n(.*?)^          "+tag+r"$",
                                 self.text,re.M|re.S)
            self.assertEqual(len(matches),1)
            namespace = {'__name__':'synthetic_diagnostic_test'}
            exec(compile(textwrap.dedent(matches[0]),'<stdin>','exec'),namespace)
            self.agents[tag] = namespace

    def test_exception_classification_never_serializes_private_details(self):
        import http.client
        import urllib.error
        cases = [(urllib.error.HTTPError('https://'+CANARY,503,CANARY,{},None),'HTTP_ERROR'),
                 (TimeoutError(CANARY),'TIMEOUT'),
                 (urllib.error.URLError(TimeoutError(CANARY)),'TIMEOUT'),
                 (urllib.error.URLError(CANARY),'TRANSPORT_ERROR'),
                 (http.client.RemoteDisconnected(CANARY),'HTTP_PROTOCOL_ERROR'),
                 (json.JSONDecodeError(CANARY,CANARY,1),'INVALID_JSON'),
                 (subprocess.CalledProcessError(23,CANARY,stderr=CANARY),'SOURCE_COMMAND_FAILED'),
                 (ValueError(CANARY),'INVALID_REVIEW_EVIDENCE'),
                 (RuntimeError(CANARY),'UNEXPECTED_EXCEPTION')]
        for error,category in cases:
            with self.subTest(category=category):
                result=self.agents['PY_REVIEW_AGENT']['failure_details'](error)
                self.assertEqual(result['category'],category)
                self.assertNotIn(CANARY,json.dumps(result))
                if category=='HTTP_ERROR': self.assertEqual(result['http_status'],503)

    def test_actual_agent_failure_retains_stage_and_safe_diagnostic(self):
        agent=self.agents['PY_REVIEW_AGENT']
        with tempfile.TemporaryDirectory() as temp, mock.patch.dict(os.environ,REVIEW_TMP=temp,TARGET_SHA=SHA):
            def fail():
                agent['checkpoint']('single-full-diff-inference')
                raise TimeoutError(CANARY)
            with mock.patch.dict(agent,main=fail):
                self.assertEqual(agent['run_review'](),1)
            path=Path(temp)
            self.assertEqual((path/'stage.txt').read_text().strip(),'single-full-diff-inference')
            data=json.loads((path/'failure.json').read_text())
            self.assertEqual(data['category'],'TIMEOUT')
            self.assertNotIn(CANARY,json.dumps(data))

    def finalize_case(self,rc='1',outcome='success',candidate=None,diagnostic=None,stage='single-full-diff-inference'):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);out=root/'evidence';runtime=root/'runtime'
            out.mkdir();runtime.mkdir()
            if rc is not None: (runtime/'exit-code.txt').write_text(rc)
            (runtime/'stage.txt').write_text(stage)
            (runtime/'server-state.txt').write_text('137')
            (runtime/'collector.log').write_text(CANARY)
            (runtime/'engine.log').write_text(CANARY+' failed to allocate '+CANARY)
            if diagnostic is not None: (runtime/'failure.json').write_text(json.dumps(diagnostic))
            if candidate is not None: (out/'evidence.json').write_text(json.dumps(candidate))
            (out/'request.json').write_text('{"synthetic":true}')
            identity={'source_sha':SHA,'base_sha':'d'*40,'run_id':'fixture','run_attempt':'1'}
            result=self.agents['PY_REVIEW_RECORD']['finalize'](out,runtime,identity,outcome)
            self.assertFalse(runtime.exists())
            self.assertEqual(result,json.loads((out/'evidence.json').read_text()))
            self.assertEqual(result['source_sha'],SHA)
            self.assertEqual(result['server_exit_code'],137)
            self.assertIn('request.json',result['artifact_sha256'])
            self.assertNotIn(CANARY,json.dumps(result))
            for key in ('independent_review_accepted','merge_authorized','production_acceptance'):
                self.assertIs(result[key],False)
            return result

    def test_failure_finalization_keeps_evidence_but_not_logs_or_approval(self):
        result=self.finalize_case(diagnostic={'category':'HTTP_ERROR','http_status':503,
                                             'message':CANARY,'agent_line_numbers':[10,20]})
        self.assertFalse(result['candidate_valid'])
        self.assertEqual(result['disposition'],'NOT_REVIEW')
        self.assertEqual(result['diagnostic']['http_status'],503)
        self.assertEqual(result['engine_log_indicators'],['allocation_failure'])

    def test_interrupted_or_stale_execution_cannot_retain_candidate_success(self):
        candidate={'source_sha':SHA,'candidate_valid':True,'model_verdict':'PASS'}
        for rc,outcome,value in [(None,'cancelled',candidate),('1','success',candidate),
                                ('0','failure',candidate),('0','success',dict(candidate,source_sha='0'*40))]:
            with self.subTest(rc=rc,outcome=outcome):
                result=self.finalize_case(rc,outcome,value)
                self.assertFalse(result['candidate_valid'])
                self.assertEqual(result['disposition'],'NOT_REVIEW')

    def test_finalizer_filters_untrusted_diagnostic_strings_and_malformed_fields(self):
        for diagnostic in ([],{'category':[CANARY]},{'category':CANARY,'http_status':CANARY,'agent_line_numbers':[True]}):
            result=self.finalize_case(diagnostic=diagnostic,stage=CANARY)
            self.assertEqual(result['failure_category'],'PROCESS_FAILED')
            self.assertEqual(result['stage'],'initialization-or-unclassified')

    def test_well_formed_candidate_still_never_creates_independent_acceptance(self):
        result=self.finalize_case('0','success',{'source_sha':SHA,'candidate_valid':True,
                                  'model_verdict':'BLOCKED','merge_authorized':True})
        self.assertTrue(result['candidate_valid'])
        self.assertEqual(result['model_verdict'],'BLOCKED')

    def test_missing_runtime_still_records_interrupted_execution(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            result=self.agents['PY_REVIEW_RECORD']['finalize'](root/'out',root/'absent',{'source_sha':SHA},'skipped')
            self.assertFalse(result['candidate_valid'])
            self.assertIsNone(result['execution_exit_code'])

    def test_capacity_and_deadline_contract_and_always_finalizer_are_present(self):
        self.assertIn('--ctx-size 40960',self.text)
        self.assertIn('len(tokens) <= 40960-6144-512',self.text)
        self.assertIn('--ubatch-size 128 --timeout 3000',self.text)
        self.assertIn('timeout=2700',self.text)
        self.assertIn('id: review_execution\n        timeout-minutes: 60',self.text)
        self.assertIn('Preserve classified evidence before deleting private runtime logs\n        if: always()',self.text)
        self.assertEqual(self.text.count("result = api('/completion'"),1)


class StoppedPhysicalCopyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import types
        source = SCRIPT.read_text().split("<<'PY_STOPPED_SOURCE'\n", 1)[1].split('\nPY_STOPPED_SOURCE\n', 1)[0]
        cls.module = types.ModuleType('ir20_stopped_fixture')
        exec(compile(source, str(SCRIPT) + ':stopped-mode', 'exec'), cls.module.__dict__)
        cls.cold, _ = cls.module.dependencies(SCRIPT.resolve().parents[2])

    def records(self):
        rows = []
        for number in range(11):
            row = {'ID': format(number, '064x'), 'Image': 'sha256:' + 'e' * 64,
                   'Config': {}, 'MountPoints': {}}
            if number == 0:
                row.update(Image=self.module.PG_IMAGE,
                           Config={'Env': ['PG_MAJOR=16', 'POSTGRES_USER=postgres', 'POSTGRES_DB=fixture',
                                           'PASSWORD=' + CANARY]},
                           MountPoints={'data': {'Type': 'volume', 'Name': 'pg-fixture',
                                                 'Destination': self.module.DATA, 'RW': True}})
            rows.append(row)
        return rows

    def serialized(self, rows):
        raw = [json.dumps(row, sort_keys=True).encode() for row in rows]
        import hashlib
        pins = tuple((row['ID'], row['Image'], hashlib.sha256(value).hexdigest())
                     for row, value in zip(rows, raw))
        return raw, pins

    def test_selects_only_the_exact_complete_historical_postgres_record(self):
        raw, pins = self.serialized(self.records())
        self.assertEqual(self.module.selected_postgres(raw, pins),
                         {'volume': 'pg-fixture', 'user': 'postgres', 'database': 'fixture'})
        with self.assertRaisesRegex(self.module.StoppedCopyError, 'SOURCE_RECORD_DRIFT'):
            self.module.selected_postgres(raw, tuple(reversed(pins[:-1])) + (pins[0],))

    def test_source_profiles_reject_malformed_and_ambiguous_authority(self):
        cases = [
            lambda r: r[0]['Config']['Env'].append('PG_MAJOR=16'),
            lambda r: r[0]['Config']['Env'].__setitem__(0, 'PG_MAJOR=17'),
            lambda r: r[0]['Config']['Env'].append('PGDATA=/foreign'),
            lambda r: r[0]['Config']['Env'].__setitem__(1, 'POSTGRES_USER=postgresql://foreign'),
            lambda r: r[0]['MountPoints']['data'].update(Type='bind'),
            lambda r: r[0]['MountPoints']['data'].update(RW=False),
            lambda r: r[0]['MountPoints']['data'].update(Name='../other'),
            lambda r: r[0].update(Image='mutable:latest'),
            lambda r: r.__setitem__(1, dict(r[0], ID=format(1, '064x'))),
        ]
        for change in cases:
            with self.subTest(change=change):
                rows = self.records()
                change(rows)
                raw, pins = self.serialized(rows)
                with self.assertRaises(self.module.StoppedCopyError):
                    self.module.selected_postgres(raw, pins)

    def snapshot_root(self, root):
        data = root / 'volumes' / 'pg-fixture' / '_data'
        for name in ('global', 'base', 'pg_wal'):
            (data / name).mkdir(parents=True, mode=0o700)
        for parent in (root, root/'volumes', root/'volumes'/'pg-fixture', data):
            parent.chmod(0o700)
        (data/'PG_VERSION').write_bytes(b'16\n')
        (data/'global'/'pg_control').write_bytes(b'synthetic-control-only')
        (data/'base'/'16384').write_bytes(b'synthetic-page\x00bytes')
        for path in data.rglob('*'):
            path.chmod(0o700 if path.is_dir() else 0o600)
        return data

    def test_actual_descriptor_snapshot_is_read_only_and_rejects_links_and_recovery_profiles(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = self.snapshot_root(root)
            before = (data/'base'/'16384').stat()
            with mock.patch.multiple(self.module, PG_UID=os.getuid(), PG_GID=os.getgid()):
                with self.module.pg_snapshot(self.cold, str(root), 'pg-fixture') as snapshot:
                    snapshot.capture()
                    self.module.validate_snapshot(snapshot)
                after = (data/'base'/'16384').stat()
                self.assertEqual(self.cold.stable_stat(before), self.cold.stable_stat(after))
                for name in ('recovery.signal', 'standby.signal', 'backup_label', 'tablespace_map'):
                    path = data/name
                    path.write_bytes(b'unsupported')
                    path.chmod(0o600)
                    with self.module.pg_snapshot(self.cold, str(root), 'pg-fixture') as snapshot:
                        snapshot.capture()
                        with self.assertRaisesRegex(self.module.StoppedCopyError, 'RECOVERY_PROFILE'):
                            self.module.validate_snapshot(snapshot)
                    path.unlink()
                (data/'link').symlink_to(data/'PG_VERSION')
                with self.module.pg_snapshot(self.cold, str(root), 'pg-fixture') as snapshot:
                    with self.assertRaisesRegex(self.cold.PreservationError, 'SOURCE_LINK_OR_SPECIAL'):
                        snapshot.capture()

    def archive(self, *, mutation=None):
        import hashlib, io, tarfile
        entries = {'data': {'kind': 'directory', 'uid': 999, 'gid': 999, 'mode': 0o700, 'mtime_ns': 123000000001},
                   'data/file': {'kind': 'file', 'uid': 999, 'gid': 999, 'mode': 0o600, 'mtime_ns': 123000000002,
                                 'size': 3, 'sha256': hashlib.sha256(b'abc').hexdigest()}}
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for name, value in entries.items():
                if mutation == 'missing' and name == 'data/file':
                    continue
                info = tarfile.TarInfo('.' if name == 'data' else name[5:])
                info.type = tarfile.DIRTYPE if value['kind'] == 'directory' else tarfile.REGTYPE
                info.uid, info.gid, info.mode = value['uid'], value['gid'], value['mode']
                info.pax_headers['mtime'] = '123.000000001' if name == 'data' else '123.000000002'
                info.size = value.get('size', 0)
                if name == 'data/file':
                    if mutation == 'escape': info.name = '../foreign'
                    if mutation == 'link': info.type, info.linkname = tarfile.SYMTYPE, '/foreign'
                    if mutation == 'owner': info.uid = 0
                    if mutation == 'mode': info.mode = 0o777
                    if mutation == 'mtime': info.pax_headers['mtime'] = '123.000000003'
                    archive.addfile(info, io.BytesIO(b'abd' if mutation == 'content' else b'abc'))
                    if mutation == 'duplicate': archive.addfile(info, io.BytesIO(b'abc'))
                else:
                    archive.addfile(info)
        return output.getvalue(), entries

    def test_real_tar_roundtrip_and_adversarial_archive_rejections(self):
        self.module.archive_verification(*self.archive())
        for mutation in ('missing', 'escape', 'link', 'owner', 'mode', 'mtime', 'content', 'duplicate'):
            with self.subTest(mutation=mutation), self.assertRaises(self.module.StoppedCopyError):
                self.module.archive_verification(*self.archive(mutation=mutation))

    def isolation(self, copy):
        return {'Id': 'a'*64, 'Image': self.module.PG_IMAGE,
                'Config': {'User': '999:999', 'Labels': {self.module.LABEL: copy.identity}},
                'State': {'Running': False}, 'Mounts': [],
                'HostConfig': {'NetworkMode': 'none', 'ReadonlyRootfs': True, 'Privileged': False,
                               'Tmpfs': dict(copy.tmpfs or {}),
                               'Memory': 805306368, 'MemorySwap': 805306368, 'NanoCpus': 1000000000,
                               'PidsLimit': 128, 'CapDrop': ['ALL'], 'SecurityOpt': ['no-new-privileges'],
                               'RestartPolicy': {'Name': 'no'}, 'LogConfig': {'Type': 'none'}}}

    def test_actual_container_inspection_blocks_privileged_network_mount_resource_and_identity_drift(self):
        copy = self.module.DockerCopy(SHA, '12345')
        copy.container_id = 'a'*64
        copy.tmpfs = {self.module.DATA: 'bounded-data', '/var/run/postgresql': 'bounded-socket', '/tmp': 'bounded-temp'}
        for key, value in [('NetworkMode','host'), ('Privileged',True), ('ReadonlyRootfs',False),
                           ('Binds',['/:/host']), ('Mounts',[{}]), ('Tmpfs',{}), ('PidMode','host'), ('IpcMode','host'), ('Devices',[{}]), ('PortBindings',{'1/tcp':[]}),
                           ('Memory',0), ('PidsLimit',0), ('CapAdd',['SYS_ADMIN']),
                           ('RestartPolicy',{'Name':'always'}), ('LogConfig',{'Type':'json-file'})]:
            row = self.isolation(copy)
            row['HostConfig'][key] = value
            with self.subTest(key=key), mock.patch.object(copy, 'inspection', return_value=row), \
                 self.assertRaises(self.module.StoppedCopyError):
                copy.validate_isolation()
        for change in (lambda r:r.update(Image='mutable:latest'), lambda r:r['Config'].update(User='0:0'),
                       lambda r:r['Config']['Labels'].update({self.module.LABEL:'foreign'}),
                       lambda r:r.update(Mounts=[{'Type':'volume','Destination':self.module.DATA}])):
            row=self.isolation(copy); change(row)
            with mock.patch.object(copy,'inspection',return_value=row), self.assertRaises(self.module.StoppedCopyError):
                copy.validate_isolation()

    def test_cleanup_requires_exact_owned_identity_and_independent_absence(self):
        copy = self.module.DockerCopy(SHA, '12345')
        copy.create_attempted, copy.container_id = True, 'a'*64
        row = self.isolation(copy)
        with mock.patch.object(copy, 'inspection', return_value=row), \
             mock.patch.object(copy, 'command', return_value=subprocess.CompletedProcess([],0,b'')) as command:
            copy.cleanup()
            self.assertEqual(command.call_args_list[0].args[0], ['rm','-f','a'*64])
            self.assertEqual(command.call_args_list[1].args[0], ['ps','-aq','--no-trunc','--filter','id='+'a'*64])
        with mock.patch.object(copy, 'inspection', return_value=row), \
             mock.patch.object(copy, 'command', return_value=subprocess.CompletedProcess([],0,b'a'*64)), \
             self.assertRaisesRegex(self.module.StoppedCopyError, 'CLEANUP_NOT_PROVEN'):
            copy.cleanup()
        row['Config']['Labels'][self.module.LABEL]='foreign'
        with mock.patch.object(copy, 'inspection', return_value=row), mock.patch.object(copy,'command') as command, \
             self.assertRaisesRegex(self.module.StoppedCopyError, 'CLEANUP_IDENTITY'):
            copy.cleanup()
        command.assert_not_called()

    def test_late_transfer_waits_consume_remaining_time_and_expiry_never_starts_another_wait(self):
        copy=self.module.DockerCopy(SHA,'12345')
        copy.deadline=100
        process=mock.Mock()
        process.wait.return_value=0
        with mock.patch.object(self.module.time,'monotonic',return_value=97.5):
            self.assertEqual(copy.wait_for(process,120),0)
        process.wait.assert_called_once_with(timeout=2.5)
        process.wait.reset_mock()
        with mock.patch.object(self.module.time,'monotonic',return_value=100), \
             self.assertRaisesRegex(self.module.StoppedCopyError,'OPERATION_DEADLINE'):
            copy.wait_for(process,15)
        process.wait.assert_not_called()
        with mock.patch.object(self.module.time,'monotonic',return_value=101):
            copy.begin_cleanup()
        self.assertEqual(copy.deadline,161)
        with mock.patch.object(self.module.time,'monotonic',return_value=111):
            copy.begin_cleanup()
            self.assertEqual(copy.remaining(120),50)
        self.assertEqual(copy.deadline,161,'cleanup must never renew its own budget')

    def test_actual_clone_commands_never_enable_checksums_or_start_a_source_service(self):
        copy = self.module.DockerCopy(SHA, '12345')
        copy.container_id = 'a'*64
        outputs = [b'',b'',b't\n',b'',b'',b'',b'Database cluster state: shut down\nData page checksum version: 1\n',b'']
        with mock.patch.object(copy, 'execute', side_effect=[subprocess.CompletedProcess([],0,v) for v in outputs]) as execute:
            self.assertEqual(copy.recover('postgres','fixture'),'VERIFIED')
        calls=[call.args[0] for call in execute.call_args_list]
        self.assertIn(['pg_dump', '-h', '/var/run/postgresql', '-w', '-U', 'postgres', '-d', 'fixture',
                       '--format=custom', '--file=/dev/null', '--no-sync'], calls)
        self.assertIn(['pg_checksums','--check','-D',self.module.DATA], calls)
        self.assertFalse(any('--enable' in call or '--disable' in call for call in calls))
        setup=execute.call_args_list[0].kwargs['data']
        self.assertIn(b'shared_preload_libraries = \'\'',setup)
        self.assertIn(b'restore_command = \'\'',setup)
        self.assertIn(b': > postgresql.auto.conf',setup)
        self.assertFalse(any('docker' in call or 'restart' in call for call in calls))

    def test_disabled_checksums_are_honest_and_failed_clean_shutdown_rejects_acceptance(self):
        for state,checksum,result in [('shut down','0','NOT_ENABLED'),('in production','1',None),('shut down','2',None)]:
            copy=self.module.DockerCopy(SHA,'12345');copy.container_id='a'*64
            outputs=[b'',b'',b't\n',b'',b'',b'',('Database cluster state: '+state+'\nData page checksum version: '+checksum+'\n').encode()]
            with mock.patch.object(copy,'execute',side_effect=[subprocess.CompletedProcess([],0,v) for v in outputs]) as execute:
                if result is None:
                    with self.assertRaises(self.module.StoppedCopyError):copy.recover('postgres','fixture')
                else:self.assertEqual(copy.recover('postgres','fixture'),result)
                self.assertFalse(any('pg_checksums' in c.args[0] for c in execute.call_args_list))

    def test_private_journal_is_durable_exclusive_and_never_replayed(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);root.chmod(0o700)
            copy=self.module.DockerCopy(SHA,'12345')
            with mock.patch.object(self.module,'preserved_copies'):
                with self.module.operation_journal(self.cold,str(root),SHA,'12345',copy) as (_,fd):
                    path=root/self.module.OPERATION/'operation.pending'
                    self.assertEqual(path.stat().st_mode&0o777,0o600)
                    record=json.loads(path.read_bytes())
                    self.assertEqual(record['ownedContainerIdentity'],copy.identity)
                    self.assertEqual(record['status'],'UNKNOWN_RECONCILIATION_REQUIRED')
                original=path.read_bytes()
                with self.assertRaisesRegex(self.module.StoppedCopyError,'OPERATION_ALREADY_EXISTS_RECONCILE'):
                    with self.module.operation_journal(self.cold,str(root),SHA,'12345',copy):pass
                self.assertEqual(path.read_bytes(),original)

    def test_embedded_mode_argument_rejection_never_emits_raw_errors(self):
        result=subprocess.run(['bash',str(SCRIPT),'--stopped'],capture_output=True,text=True,timeout=5)
        self.assertEqual(result.returncode,2)
        self.assertNotIn(CANARY,result.stdout+result.stderr)
        self.assertEqual(result.stderr,'IR20_STOPPED_ERROR=ARGUMENTS\n')

    def publication_case(self, fault):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);root.chmod(0o700)
            copy=self.module.DockerCopy(SHA,'12345')
            with mock.patch.object(self.module,'preserved_copies'):
                with self.module.operation_journal(self.cold,str(root),SHA,'12345',copy) as (backup_fd,operation_fd):
                    directory=root/self.module.OPERATION
                    journal=(directory/'operation.pending').read_bytes()
                    real_sync=self.cold.sync
                    real_open=self.cold.private_file
                    real_write=self.module.os.write
                    real_close=self.module.os.close
                    real_rename=self.module.os.rename
                    real_unlink=self.module.os.unlink
                    sync_calls=[0]
                    def synchronize(fd):
                        sync_calls[0]+=1
                        target={'file_sync':1,'directory_before_rename':2,
                                'directory_after_rename':3,'parent_sync':4,
                                'unlink_failure':3,'cleanup_sync_failure':1}.get(fault)
                        if sync_calls[0]==target or (fault=='cleanup_sync_failure' and sync_calls[0]>1):
                            raise OSError(5,CANARY)
                        return real_sync(fd)
                    def private_file(fd,name):
                        if fault=='open':raise OSError(5,CANARY)
                        return real_open(fd,name)
                    def write(fd,data):
                        if fault=='write':raise OSError(5,CANARY)
                        return real_write(fd,data[:-1] if fault=='short_write' else data)
                    def close(fd):
                        report_file=os.readlink('/proc/self/fd/'+str(fd)).endswith('/report.pending')
                        real_close(fd)
                        if fault=='close' and report_file:raise OSError(5,CANARY)
                    def rename(*args,**kwargs):
                        if fault=='rename':raise OSError(5,CANARY)
                        result=real_rename(*args,**kwargs)
                        if fault=='rename_after_effect':raise OSError(5,CANARY)
                        return result
                    def unlink(name,**kwargs):
                        if fault=='unlink_failure' and name=='report.json':raise OSError(5,CANARY)
                        return real_unlink(name,**kwargs)
                    expected='REPORT_CLEANUP_NOT_PROVEN' if fault in ('unlink_failure','cleanup_sync_failure') else 'REPORT_PUBLICATION_FAILED'
                    with mock.patch.object(self.cold,'sync',side_effect=synchronize), \
                         mock.patch.object(self.cold,'private_file',side_effect=private_file), \
                         mock.patch.object(self.module.os,'write',side_effect=write), \
                         mock.patch.object(self.module.os,'close',side_effect=close), \
                         mock.patch.object(self.module.os,'rename',side_effect=rename), \
                         mock.patch.object(self.module.os,'unlink',side_effect=unlink), \
                         self.assertRaisesRegex(self.module.StoppedCopyError,expected) as error:
                        self.module.publish_stopped_report(self.cold,backup_fd,operation_fd,
                            {'passed':True,'targetSha':SHA,'runtimeRestored':False})
                    self.assertNotIn(CANARY,str(error.exception))
                    self.assertFalse((directory/'report.pending').exists())
                    if fault!='unlink_failure':self.assertFalse((directory/'report.json').exists())
                    self.assertEqual((directory/'operation.pending').read_bytes(),journal)
                    self.assertEqual(json.loads(journal)['status'],'UNKNOWN_RECONCILIATION_REQUIRED')
                with self.assertRaisesRegex(self.module.StoppedCopyError,'OPERATION_ALREADY_EXISTS_RECONCILE'):
                    with self.module.operation_journal(self.cold,str(root),SHA,'12345',copy):pass

    def test_each_stopped_report_publication_failure_invalidates_markers_and_retains_journal(self):
        for fault in ('open','write','short_write','file_sync','directory_before_rename',
                      'rename','rename_after_effect','directory_after_rename','parent_sync','close'):
            with self.subTest(fault=fault):self.publication_case(fault)

    def test_stopped_report_invalidation_failure_is_explicitly_unproved(self):
        for fault in ('unlink_failure','cleanup_sync_failure'):
            with self.subTest(fault=fault):self.publication_case(fault)

    def test_actual_coordinator_removes_positive_report_after_final_directory_sync_failure(self):
        real_sync=self.cold.sync
        injected=[False]
        def fail_after_rename(fd):
            directory=Path(os.readlink('/proc/self/fd/'+str(fd)))
            if not injected[0] and directory.is_dir() and (directory/'report.json').exists():
                injected[0]=True
                raise OSError(5,CANARY)
            return real_sync(fd)
        with mock.patch.object(self.cold,'sync',side_effect=fail_after_rename):
            self.full_case('publication_failure')
        self.assertTrue(injected[0],'the real coordinator must reach the post-rename barrier')

    def test_preserved_private_ciphertext_guards_reject_tampering_links_and_public_modes(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);root.chmod(0o700)
            entries=[]
            for index in range(2):
                parent=root/('copy-'+str(index));parent.mkdir(mode=0o700)
                payload=('synthetic-cipher-'+str(index)).encode()
                digest=hashlib.sha256(payload).hexdigest()
                (parent/'preservation.tar.gpg').write_bytes(payload)
                (parent/'receipt.json').write_text(json.dumps({'passed':True,'ciphertextSha256':digest,
                    'sourceUnchanged':True,'runtimeRestored':False}))
                for path in parent.iterdir():path.chmod(0o600)
                entries.append((parent.name,digest))
            fd=self.cold.absolute_directory(str(root))
            try:
                with mock.patch.object(self.module,'PRESERVED_CIPHERS',tuple(entries)):
                    self.module.preserved_copies(self.cold,fd)
                    cipher=root/entries[0][0]/'preservation.tar.gpg';original=cipher.read_bytes()
                    cipher.write_bytes(b'tampered')
                    with self.assertRaisesRegex(self.module.StoppedCopyError,'PRESERVED_CIPHERTEXT_CHANGED'):
                        self.module.preserved_copies(self.cold,fd)
                    cipher.write_bytes(original);cipher.chmod(0o644)
                    with self.assertRaisesRegex(self.module.StoppedCopyError,'PRESERVED_FILE_PROFILE'):
                        self.module.preserved_copies(self.cold,fd)
                    cipher.chmod(0o600);cipher.unlink();cipher.symlink_to(root/entries[1][0]/cipher.name)
                    with self.assertRaises(OSError):self.module.preserved_copies(self.cold,fd)
            finally:os.close(fd)

    def test_create_declares_an_inert_nonroot_container_without_a_host_or_source_mount(self):
        copy=self.module.DockerCopy(SHA,'12345')
        with mock.patch.object(copy,'command',return_value=subprocess.CompletedProcess([],0,('a'*64).encode())) as command, \
             mock.patch.object(copy,'validate_isolation'):
            copy.create('postgres','fixture',0o700)
        create=command.call_args_list[0].args[0]
        self.assertEqual(create[-3:],['/bin/sleep',self.module.PG_IMAGE,'900'])
        self.assertEqual(create[create.index('--user')+1],'999:999')
        self.assertEqual(create[create.index('--network')+1],'none')
        self.assertIn('--pull=never',create)
        self.assertNotIn('--mount',create);self.assertNotIn('--volume',create);self.assertNotIn('-v',create)
        self.assertNotIn(CANARY,' '.join(create))
        self.assertEqual(command.call_args_list[1].args[0],['start','a'*64])

    def full_case(self, case=''):
        import types
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/'source';source.mkdir(mode=0o700)
            data=self.snapshot_root(source)
            raw,pins=self.serialized(self.records())
            for row,payload in zip(self.records(),raw):
                parent=source/'containers'/row['ID'];parent.mkdir(parents=True,mode=0o700)
                (parent/'config.v2.json').write_bytes(payload)
            backup=root/'backup';backup.mkdir(mode=0o700)
            baseline=(pins,(b'pg-fixture',),(),frozenset({self.module.PG_IMAGE}),frozenset())
            observed=[0]
            def observe():
                observed[0]+=1
                return baseline if case!='runtime_drift' or observed[0]<4 else ('drift',)
            helper=types.SimpleNamespace(Host=lambda:types.SimpleNamespace(observe=observe))
            calls=[]
            class Copy:
                name='fixture-owned';identity=SHA+':12345:fixture-token'
                def __init__(self,*_):pass
                def create(self,*_):
                    calls.append('create')
                    if case=='create':raise RuntimeError(CANARY)
                def transfer(self,*_):
                    calls.append('transfer')
                    if case=='source_drift':(data/'base'/'16384').write_bytes(b'changed')
                    if case=='transfer':raise RuntimeError(CANARY)
                def recover(self,*_):
                    calls.append('recover')
                    if case=='recover':raise RuntimeError(CANARY)
                    return 'VERIFIED'
                def cleanup(self):
                    calls.append('cleanup')
                    if case=='cleanup':raise RuntimeError(CANARY)
            with mock.patch.multiple(self.module,PG_UID=os.getuid(),PG_GID=os.getgid()), \
                 mock.patch.object(self.module,'preserved_copies'), \
                 mock.patch.object(self.cold,'no_postgres_processes'):
                if case:
                    with self.assertRaises(Exception):
                        self.module.validate_stopped(self.cold,helper,SHA,'12345',source_root=str(source),
                                                     backup_root=str(backup),docker_factory=Copy)
                    self.assertFalse((backup/self.module.OPERATION/'report.json').exists())
                    self.assertTrue((backup/self.module.OPERATION/'operation.pending').exists())
                else:
                    result=self.module.validate_stopped(self.cold,helper,SHA,'12345',source_root=str(source),
                                                         backup_root=str(backup),docker_factory=Copy)
                    final=backup/self.module.OPERATION/'report.json'
                    self.assertEqual(json.loads(final.read_bytes()),result)
                    self.assertEqual(final.stat().st_mode&0o777,0o600)
                    self.assertFalse(result['startupAuthorized']);self.assertFalse(result['runtimeRestored'])
                    self.assertEqual(result['databaseIntegrity'],'NOT_FULLY_ATTESTED')
                    self.assertEqual(result['runId'],'12345');self.assertEqual(result['targetSha'],SHA)
                    self.assertNotIn(CANARY,final.read_text())
                self.assertEqual(calls.count('cleanup'),1)
                self.assertEqual(calls[0],'create')

    def test_actual_coordinator_records_source_bound_success_only_after_verified_cleanup(self):
        self.full_case()

    def test_actual_coordinator_preserves_pending_ambiguity_and_refuses_success_after_failure_or_drift(self):
        for case in ('create','transfer','recover','cleanup','source_drift','runtime_drift'):
            with self.subTest(case=case):self.full_case(case)


if __name__ == '__main__':
    unittest.main(verbosity=2)
