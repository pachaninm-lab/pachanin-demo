import contextlib
import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('recovery', Path(__file__).with_name('production_stopped_runtime_headroom.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
TARGET = 'b' * 40
CID = 'c' * 64
IMAGE = 'sha256:' + 'a' * 64
USED = 'sha256:' + 'd' * 64
CANDIDATE = {'id': IMAGE, 'refs': ['pc-crop-transfer/web:' + 'e' * 40], 'revision': 'e' * 40}
ITEM = {'Id': IMAGE, 'RepoTags': CANDIDATE['refs'], 'RepoDigests': [],
        'Config': {'Labels': {'org.opencontainers.image.revision': 'e' * 40}}}


def actual_workflow_step(name):
    import textwrap
    here = Path(__file__).parent
    path = here / 'production-stopped-runtime-headroom.yml'
    if not path.is_file():
        path = here.parent / '.github/workflows/production-stopped-runtime-headroom.yml'
    workflow = path.read_text()
    block = workflow.split('      - name: ' + name + '\n', 1)[1].split('\n      - ', 1)[0]
    return workflow, textwrap.dedent(block.split('        run: |\n', 1)[1])


class FakeHost:
    def __init__(self):
        self.item = copy.deepcopy(ITEM)
        self.deleted = False
        self.calls = []
        self.space = 0
        self.refuse = False
        self.observe_count = 0
        self.drift_at = None
        self.used_at = None

    def observe(self):
        self.observe_count += 1
        volumes = ('one',) if self.drift_at != self.observe_count else ('different',)
        images = frozenset({USED} if self.deleted else {USED, IMAGE})
        used = frozenset({USED, IMAGE} if self.used_at == self.observe_count else {USED})
        return ((CID, USED, 'private-config-hash'),), volumes, ('network',), images, used

    def available_kb(self):
        return self.space

    def inspect(self, image):
        self.calls.append(('inspect', image))
        return None if self.deleted else self.item

    def remove(self, image):
        self.calls.append(('remove', image))
        if self.refuse:
            return False
        self.deleted = True
        self.space = m.TARGET_KB
        return True


class RecoveryTests(unittest.TestCase):
    def test_success_preserves_protected_inventory_and_publishes_ambiguous_attempt(self):
        host, events = FakeHost(), []
        result = m.recover(host, TARGET, (CANDIDATE,), events.append, frozenset({USED}))
        self.assertTrue(result['passed'])
        self.assertEqual(result['deletedImages'], 1)
        self.assertEqual(events[0]['outcome'], 'NOT_YET_RECONCILED')
        self.assertEqual([c for c in host.calls if c[0] == 'remove'], [('remove', IMAGE)])
        self.assertFalse(result['runtimeRestored'])
        self.assertEqual(result['volumeDataIntegrity'], 'NOT_ATTESTED')

    def test_pre_removal_drift_performs_no_deletion(self):
        host = FakeHost()
        host.drift_at = 2
        with self.assertRaisesRegex(m.RecoveryError, 'PRE_REMOVAL_DRIFT'):
            m.recover(host, TARGET, (CANDIDATE,), reserve_ids=frozenset({USED}))
        self.assertFalse(host.deleted)

    def test_new_containerd_reference_performs_no_deletion(self):
        host = FakeHost()
        host.used_at = 2
        with self.assertRaisesRegex(m.RecoveryError, 'NEW_CONTAINER_REFERENCE'):
            m.recover(host, TARGET, (CANDIDATE,), reserve_ids=frozenset({USED}))
        self.assertFalse(host.deleted)

    def test_post_removal_drift_is_failure_not_success(self):
        host = FakeHost()
        host.drift_at = 3
        with self.assertRaisesRegex(m.RecoveryError, 'POST_REMOVAL_DRIFT'):
            m.recover(host, TARGET, (CANDIDATE,), reserve_ids=frozenset({USED}))
        self.assertTrue(host.deleted)

    def test_nonforce_refusal_is_not_retried_or_claimed_as_free_space(self):
        host = FakeHost()
        host.refuse = True
        result = m.recover(host, TARGET, (CANDIDATE,), reserve_ids=frozenset({USED}))
        self.assertFalse(result['passed'])
        self.assertEqual(result['refusedImages'], 1)
        self.assertEqual(len([c for c in host.calls if c[0] == 'remove']), 1)

    def test_final_reconciliation_rejects_drift_with_and_without_removals(self):
        for sufficient, drift_at in ((True, 2), (False, 4)):
            with self.subTest(initial_headroom=sufficient):
                host = FakeHost()
                host.space = m.TARGET_KB if sufficient else 0
                host.drift_at = drift_at
                with self.assertRaisesRegex(m.RecoveryError, 'FINAL_INVENTORY_DRIFT'):
                    m.recover(host, TARGET, (CANDIDATE,), reserve_ids=frozenset({USED}))
                self.assertEqual(host.deleted, not sufficient)

    def test_refused_partial_untag_is_not_a_reconciled_refusal(self):
        host = FakeHost()
        def partially_untag(image):
            host.calls.append(('remove', image))
            host.item['RepoTags'] = []
            return False
        host.remove = partially_untag
        with self.assertRaisesRegex(m.RecoveryError, 'REFERENCES_CHANGED'):
            m.recover(host, TARGET, (CANDIDATE,), reserve_ids=frozenset({USED}))
        self.assertEqual([c for c in host.calls if c[0] == 'remove'], [('remove', IMAGE)])
        self.assertFalse(host.deleted)

    def test_already_sufficient_space_has_zero_deletions(self):
        host = FakeHost()
        host.space = m.TARGET_KB
        self.assertEqual(m.recover(host, TARGET, (CANDIDATE,), reserve_ids=frozenset({USED}))['deletedImages'], 0)
        self.assertFalse(host.deleted)

    def test_unknown_ref_target_revision_and_missing_inspect_fail_before_mutation(self):
        for kind in ('foreign_ref', 'target', 'missing'):
            with self.subTest(kind=kind):
                host = FakeHost()
                if kind == 'foreign_ref':
                    host.item['RepoTags'] = ['unapproved/image:private']
                elif kind == 'target':
                    host.item['Config']['Labels']['org.opencontainers.image.revision'] = TARGET
                else:
                    host.deleted = True
                with self.assertRaises(m.RecoveryError):
                    m.recover(host, TARGET, (CANDIDATE,), reserve_ids=frozenset({USED}))
                self.assertFalse(any(c[0] == 'remove' for c in host.calls))

    def test_protected_candidate_rejected(self):
        host = FakeHost()
        with self.assertRaisesRegex(m.RecoveryError, 'PROTECTED_CANDIDATE'):
            m.recover(host, TARGET, ({**CANDIDATE, 'id': USED},), reserve_ids=frozenset({USED}))
        self.assertFalse(host.deleted)

    def test_missing_rollback_reserve_prevents_deletion(self):
        host = FakeHost()
        with self.assertRaisesRegex(m.RecoveryError, 'ROLLBACK_RESERVE_MISSING'):
            m.recover(host, TARGET, (CANDIDATE,), reserve_ids=frozenset({'sha256:' + 'f' * 64}))
        self.assertFalse(host.deleted)

    def test_actual_remove_argv_has_no_force_and_no_parent_prune(self):
        host = m.Host()
        with patch.object(host, 'command') as call:
            call.return_value.returncode = 0
            self.assertTrue(host.remove(IMAGE))
            self.assertEqual(call.call_args.args[0], ['docker', 'image', 'rm', '--no-prune', IMAGE])
        with self.assertRaises(m.RecoveryError):
            host.remove('not-an-image')

    def test_source_candidates_are_exact_bounded_transfer_images_and_preserve_reserves(self):
        self.assertEqual(len(m.CANDIDATES), 40)
        self.assertEqual(len({c['id'] for c in m.CANDIDATES}), 40)
        self.assertTrue(set(c['id'] for c in m.CANDIDATES).isdisjoint(m.RESERVE_IDS))
        self.assertTrue(set(c['id'] for c in m.CANDIDATES).isdisjoint(image for _, image in m.EXPECTED_REFS))
        self.assertEqual(len(m.EXPECTED_REFS), 11)
        for candidate in m.CANDIDATES:
            self.assertEqual(candidate['namespace'], 'EXACT_SHA_TRANSFER_ALIAS')
            self.assertIn(candidate['component'], ('api', 'migration', 'web'))
            for ref in candidate['refs']:
                prefix = 'pc-crop-transfer/' + candidate['component']
                self.assertTrue(ref == prefix + ':' + candidate['revision'] or
                                m.re.fullmatch(m.re.escape(prefix) + r'@sha256:[0-9a-f]{64}', ref))

    def test_read_api_cannot_open_an_arbitrary_endpoint(self):
        with self.assertRaisesRegex(m.RecoveryError, 'API_PATH'):
            m.Host().read_api('/containers/create')

    def test_actual_host_observation_fails_closed_on_transport_and_usage_ambiguity(self):
        from types import SimpleNamespace
        class ReadHost(m.Host):
            endpoint = 'unix:///var/run/docker.sock'
            containers = b''
            usage = 0
            foreign_used = False
            def command(self, argv, **kwargs):
                if argv[:3] == ['docker', 'context', 'inspect']:
                    value = self.endpoint.encode()
                elif argv[:2] == ['docker', 'ps']:
                    value = self.containers
                elif argv[:3] == ['docker', 'volume', 'ls']:
                    value = b'\n'.join(('volume' + str(i)).encode() for i in range(19))
                elif argv[:3] == ['docker', 'network', 'ls']:
                    value = b'\n'.join(('network' + str(i)).encode() for i in range(6))
                elif argv[:5] == ['ctr', '--address', '/run/containerd/containerd.sock', '--namespace', 'moby']:
                    value = b''
                else:
                    raise AssertionError('Unexpected command')
                return SimpleNamespace(stdout=value, returncode=0)
            def read_api(self, path):
                if path.endswith('/info'):
                    return {'DockerRootDir': m.ROOT, 'Driver': 'overlayfs', 'Containerd': {'Address': '/run/containerd/containerd.sock', 'Namespaces': {'Containers': 'moby'}}}
                return [{'Id': USED, 'Containers': 1}, {'Id': IMAGE, 'Containers': 1 if self.foreign_used else self.usage}]
        configs = (((CID, USED, 'private-hash'),), frozenset({'volume0'}))
        with patch.dict(os.environ, {}, clear=True), patch.object(m, 'metadata', return_value=configs), patch.object(os, 'stat', return_value=SimpleNamespace(st_dev=1)), patch.object(os, 'lstat', return_value=SimpleNamespace(st_mode=m.stat.S_IFSOCK, st_uid=0)):
            self.assertIn(USED, ReadHost().observe()[4])
            for name, value in (('endpoint', 'ssh://untrusted'), ('containers', b'unknown-container'), ('usage', -1), ('usage', None), ('usage', True), ('foreign_used', True)):
                with self.subTest(name=name, value=value):
                    host = ReadHost()
                    setattr(host, name, value)
                    with self.assertRaises(m.RecoveryError):
                        host.observe()
            with patch.dict(os.environ, {'DOCKER_HOST': 'unix:///different.sock'}):
                with self.assertRaisesRegex(m.RecoveryError, 'DOCKER_CONTEXT_ENV'):
                    ReadHost().observe()

    def test_actual_containerd_probe_requires_pinned_socket_and_empty_real_stores(self):
        from types import SimpleNamespace as N
        host = m.Host()
        info = {'Containerd': {'Address':'/run/containerd/containerd.sock',
                              'Namespaces':{'Containers':'moby'}}}
        with patch.object(os,'lstat',return_value=N(st_mode=m.stat.S_IFSOCK,st_uid=0)), patch.object(host,'command',return_value=N(returncode=0,stdout=b'')) as call:
            host.observe_empty_containerd(info)
            self.assertEqual([x.args[0] for x in call.call_args_list], [
                ['ctr','--address','/run/containerd/containerd.sock','--namespace','moby','containers','list','--quiet'],
                ['ctr','--address','/run/containerd/containerd.sock','--namespace','moby','tasks','list','--quiet']])
            for value in ({}, {'Containerd':{'Address':'/untrusted.sock','Namespaces':{'Containers':'moby'}}},
                          {'Containerd':{'Address':'/run/containerd/containerd.sock','Namespaces':{'Containers':'unknown'}}}):
                with self.assertRaisesRegex(m.RecoveryError,'CONTAINERD_ENDPOINT_UNKNOWN'):
                    host.observe_empty_containerd(value)
            for value in (N(st_mode=m.stat.S_IFREG,st_uid=0), N(st_mode=m.stat.S_IFSOCK,st_uid=1000)):
                with patch.object(os,'lstat',return_value=value), self.assertRaisesRegex(m.RecoveryError,'CONTAINERD_SOCKET_IDENTITY'):
                    host.observe_empty_containerd(info)
            with patch.object(os,'lstat',side_effect=FileNotFoundError()), self.assertRaisesRegex(m.RecoveryError,'CONTAINERD_SOCKET_UNAVAILABLE'):
                host.observe_empty_containerd(info)
            with patch.object(host,'command',side_effect=FileNotFoundError()), self.assertRaisesRegex(m.RecoveryError,'CONTAINERD_PROBE_UNAVAILABLE'):
                host.observe_empty_containerd(info)
            for values, code in (([N(returncode=1,stdout=b'')],'CONTAINERD_INVENTORY_UNAVAILABLE'),
                                  ([N(returncode=0,stdout=b'object')],'CONTAINERD_OBJECTS_PRESENT'),
                                  ([N(returncode=0,stdout=b''),N(returncode=0,stdout=b'task')],'CONTAINERD_OBJECTS_PRESENT')):
                with patch.object(host,'command',side_effect=values), self.assertRaisesRegex(m.RecoveryError,code):
                    host.observe_empty_containerd(info)

    def test_actual_workflow_requires_exact_owner_command_and_successful_contract(self):
        import ast
        import re
        from types import SimpleNamespace as N
        here = Path(__file__).parent
        workflow_path = here / 'production-stopped-runtime-headroom.yml'
        if not workflow_path.exists():
            workflow_path = here.parent / '.github/workflows/production-stopped-runtime-headroom.yml'
        workflow = workflow_path.read_text()
        codes = []
        for job in ('contract', 'recover'):
            block = workflow.split('\n  ' + job + ':\n', 1)[1].split('\n    runs-on:', 1)[0]
            condition = re.search(r'\n    if: >-\n((?:      [^\n]*\n)+)', '\n' + block + '\n')[1]
            condition = ' '.join(line.strip() for line in condition.splitlines()).replace('&&', ' and ').replace('||', ' or ')
            tree = ast.parse(condition, mode='eval')
            allowed = (ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.Compare, ast.Eq, ast.Attribute, ast.Name, ast.Load, ast.Constant)
            self.assertTrue(all(type(node) in allowed for node in ast.walk(tree)))
            codes.append(compile(tree, '<actual owner route>', 'eval'))
        def routed(issue=4637, body='/production reclaim-stopped-runtime current-main', author='owner', actor='owner', triggering='owner', association='OWNER', result='success', event='issue_comment'):
            github = N(event_name=event, repository_owner='owner', actor=actor, triggering_actor=triggering,
                event=N(issue=N(number=issue),comment=N(body=body,author_association=association,user=N(login=author))))
            return tuple(bool(eval(code, {'__builtins__': {}}, {'github':github,'needs':N(contract=N(result=result))})) for code in codes)
        self.assertEqual(routed(), (True, True))
        self.assertEqual(routed(event='pull_request'), (True, False))
        for changes in ({'issue':5469}, {'body':'/production reclaim-docker current-main'}, {'body':'/production reclaim-stopped-runtime current-main\n'}, {'event':'push'}):
            self.assertEqual(routed(**changes), (False, False))
        for changes in ({'author':'other'}, {'actor':'other'}, {'triggering':'other'}, {'association':'COLLABORATOR'}, {'result':'failure'}, {'result':'skipped'}):
            self.assertEqual(routed(**changes), (True, False))
        self.assertNotIn('StrictHostKeyChecking=no', workflow)
        self.assertIn('production-full-stack-exact-sha', workflow)
        self.assertIn('SOURCE_VECTOR_MISMATCH', workflow)

    def test_pull_request_contract_has_no_protected_secret_or_issue_write_binding(self):
        import re
        here = Path(__file__).parent
        workflow_path = here / 'production-stopped-runtime-headroom.yml'
        if not workflow_path.exists():
            workflow_path = here.parent / '.github/workflows/production-stopped-runtime-headroom.yml'
        workflow = workflow_path.read_text()
        references = re.findall(r'(?m)^\s*-\s*uses:\s*(\S+)\s*$', workflow)
        def pinned(reference):
            return re.fullmatch(r'actions/(?:checkout|upload-artifact)@[0-9a-f]{40}', reference) is not None
        self.assertEqual(len(references), 3)
        self.assertTrue(all(pinned(reference) for reference in references))
        for reference in references:
            self.assertFalse(pinned(reference.split('@')[0] + '@v4'))
        global_scope, jobs = workflow.split('\njobs:\n', 1)
        contract, recovery = jobs.split('\n  recover:\n', 1)
        self.assertNotIn('secrets.', global_scope + contract)
        self.assertNotIn('issues: write', global_scope + contract)
        self.assertNotIn('concurrency:', global_scope + contract)
        self.assertIn('    concurrency:\n      group: production-full-stack-exact-sha\n      cancel-in-progress: false', recovery)
        for binding in ('PC_PROD_HOST', 'PC_PROD_SSH_USER', 'PC_PROD_SSH_PORT',
                        'PC_PROD_SSH_KEY', 'PC_PROD_SSH_PRIVATE_KEY', 'VPS_SSH_KEY',
                        'PC_PROD_SSH_HOST_FINGERPRINT'):
            self.assertEqual(recovery.count('secrets.' + binding + ' }'), 1)
        self.assertIn('    permissions:\n      contents: read\n      issues: write', recovery)

    def test_all_shared_production_participants_keep_multiple_pending_operations(self):
        here = Path(__file__).parent
        workflow_dir = here.parent / '.github/workflows'
        if not workflow_dir.is_dir():
            workflow_dir = here.parent / 'pc-crop/.github/workflows'
        workflows = {p.name: p.read_text() for p in workflow_dir.iterdir()
                     if p.suffix in ('.yml', '.yaml')}
        # In the private proposal, overlay the exact future payloads. In source
        # CI these same files already reside in .github/workflows.
        for name in ('production-cold-preservation.yml',
                     'production-stopped-runtime-headroom.yml',
                     'production-docker-headroom-recovery.yml',
                     'production-docker-headroom-owner-push-once.yml'):
            if (here / name).is_file():
                workflows[name] = (here / name).read_text()
        def participants_and_validate(payloads):
            participants = set()
            for name, text in payloads.items():
                lines = text.splitlines()
                for i, line in enumerate(lines):
                    if line.strip() != 'concurrency:':
                        continue
                    indent = len(line) - len(line.lstrip())
                    block = []
                    for child in lines[i + 1:]:
                        if child.strip() and not child.lstrip().startswith('#'):
                            if len(child) - len(child.lstrip()) <= indent:
                                break
                            block.append(child.strip())
                    if 'group: production-full-stack-exact-sha' not in block:
                        continue
                    participants.add(name)
                    if block.count('queue: max') != 1 or block.count('cancel-in-progress: false') != 1:
                        raise ValueError('SHARED_PRODUCTION_PENDING_REPLACEMENT:' + name)
            return participants
        expected = {'production-docker-headroom-diagnostic.yml',
                    'production-cold-preservation.yml',
                    'production-full-stack-exact-sha.yml',
                    'production-stopped-runtime-headroom.yml',
                    'production-docker-headroom-recovery.yml',
                    'production-docker-headroom-owner-push-once.yml'}
        self.assertEqual(participants_and_validate(workflows), expected)
        # Exercise the actual prior default-single-pending regression on every
        # participant, rather than merely checking the new workflow in isolation.
        for name in sorted(expected):
            with self.subTest(legacy_default=name):
                broken = dict(workflows)
                broken[name] = broken[name].replace('queue: max', '# default pending replacement')
                with self.assertRaisesRegex(ValueError, 'SHARED_PRODUCTION_PENDING_REPLACEMENT'):
                    participants_and_validate(broken)

    def test_spent_owner_push_bridge_cannot_mutate_host_when_its_queue_is_corrected(self):
        import ast
        import re
        from types import SimpleNamespace as N
        here = Path(__file__).parent
        name = 'production-docker-headroom-owner-push-once.yml'
        path = here / name
        if not path.is_file():
            path = here.parent / '.github/workflows' / name
        workflow = path.read_text()
        recovery = workflow.split('\n  recover:\n', 1)[1]
        condition = re.search(r'\n    if: >-\n((?:      [^\n]*\n)+)', recovery)[1]
        condition = ' '.join(line.strip() for line in condition.splitlines())
        condition = condition.replace('&&', ' and ').replace('false', 'False')
        tree = ast.parse(condition, mode='eval')
        allowed = (ast.Expression, ast.BoolOp, ast.And, ast.Compare, ast.Eq,
                   ast.Attribute, ast.Name, ast.Load, ast.Constant)
        self.assertTrue(all(type(node) in allowed for node in ast.walk(tree)))
        self.assertIsInstance(tree.body, ast.BoolOp)
        self.assertIs(tree.body.values[0].value, False)
        for event in ('push', 'pull_request', 'issue_comment', 'workflow_dispatch'):
            github = N(event_name=event, repository_owner='owner', actor='owner', triggering_actor='owner')
            self.assertFalse(eval(compile(tree, '<retired owner-push bridge>', 'eval'),
                                  {'__builtins__': {}}, {'github': github}))
        self.assertIn('scripts/production-docker-headroom-recovery.sh', workflow)

    def test_actual_output_validator_retains_unknown_journal_on_broken_transport(self):
        import re
        import subprocess
        import sys
        import textwrap
        here = Path(__file__).parent
        workflow_path = here / 'production-stopped-runtime-headroom.yml'
        if not workflow_path.exists():
            workflow_path = here.parent / '.github/workflows/production-stopped-runtime-headroom.yml'
        workflow = workflow_path.read_text()
        def actual_block(marker):
            match = re.search("<<'" + marker + "'\n(.*?)\n          " + marker + "\n", workflow, re.S)
            self.assertIsNotNone(match)
            return textwrap.dedent(match[1])
        pending, record = actual_block('PY_PENDING'), actual_block('PY_RECORD')
        self.assertLess(workflow.index("<<'PY_PENDING'"), workflow.index('"python3 - --sha'))
        valid = {'schemaVersion':'pc.stopped-runtime-headroom.v1','targetSha':TARGET,
                 'beforeAvailableKb':0,'afterAvailableKb':6*1024*1024,'attemptedImages':1,
                 'deletedImages':1,'refusedImages':0,'passed':True,'targetReached':True,
                 'metadataUnchanged':True,'volumesUnchanged':True,'networksUnchanged':True,
                 'runtimeRestored':False,'volumeDataIntegrity':'NOT_ATTESTED'}
        failed = {'schemaVersion':'pc.stopped-runtime-headroom.v1','passed':False,
                  'errorCode':'CONTAINERD_CONTAINERS_PRESENT','runtimeRestored':False,
                  'mutationOutcome':'RECONCILIATION_REQUIRED_IF_STARTED'}
        capacity = {**valid,'afterAvailableKb':0,'passed':False,'targetReached':False}
        cases = [('',255,False), ('UNTRUSTED_SECRET',0,False),
                 (json.dumps({**valid,'injected':'UNTRUSTED_SECRET'}),0,False),
                 (json.dumps(valid),0,True)]
        cases += [(json.dumps(valid),rc,False) for rc in (1,2,124,255)]
        cases += [(json.dumps(failed),rc,rc == 1) for rc in (0,1,2,255)]
        cases += [(json.dumps(capacity),rc,rc == 2) for rc in (0,1,2,255)]
        self.assertIn('"$EVIDENCE_DIR" "$rc" <<\'PY_RECORD\'', workflow)
        for raw, status, accepted in cases:
            with self.subTest(accepted=accepted, ssh_status=status):
                with tempfile.TemporaryDirectory() as root_name:
                    root = Path(root_name)
                    result = subprocess.run([sys.executable,'-',TARGET,str(root)],input=pending,
                        text=True,capture_output=True)
                    self.assertEqual(result.returncode,0,result.stderr)
                    source = root/'input.txt';source.write_text(raw)
                    result = subprocess.run([sys.executable,'-',str(source),TARGET,str(root),str(status)],
                        input=record,text=True,capture_output=True)
                    body = (root/'issue-record.md').read_text()
                    self.assertNotIn('UNTRUSTED_SECRET',body)
                    if accepted:
                        self.assertEqual(result.returncode,0,result.stderr)
                        self.assertTrue((root/'result.jsonl').is_file())
                    else:
                        self.assertNotEqual(result.returncode,0)
                        self.assertIn('`UNKNOWN`',body)
                        self.assertIn('Do not retry',body)
                        self.assertFalse((root/'result.jsonl').exists())

    def test_actual_event_binding_rejects_queued_main_and_workflow_drift(self):
        import subprocess
        import sys
        workflow, source = actual_workflow_step('Bind accepted exact main and evidence journal')
        prefix = source.split("python3 - <<'PY_BIND'\n", 1)[0]
        recovery = workflow.split('\n  recover:\n', 1)[1]
        self.assertIn('ref: ${{ github.sha }}', recovery)
        self.assertNotIn('ref: main\n', recovery)
        self.assertNotIn('git checkout --detach', prefix)
        other = 'c' * 40
        cases = [({},True), ({'GITHUB_SHA':'invalid'},False),
                 ({'GITHUB_WORKFLOW_SHA':other},False),
                 ({'GITHUB_WORKFLOW_REF':'fixture/repo/.github/workflows/other.yml@refs/heads/main'},False),
                 ({'FIXTURE_CHECKOUT':other},False),
                 ({'FIXTURE_FETCHED':other,'FIXTURE_API_MAIN':other},False),
                 ({'FIXTURE_API_MAIN':other},False),
                 ({'FIXTURE_FETCH_STATUS':'1'},False)]
        for changes, accepted in cases:
            with self.subTest(changes=changes):
                with tempfile.TemporaryDirectory() as directory:
                    root = Path(directory); commands = root/'bin';commands.mkdir()
                    programs = {
                        'git': "import os,sys\na=sys.argv[1:]\nif a and a[0]=='fetch':sys.exit(int(os.environ.get('FIXTURE_FETCH_STATUS','0')))\nif a==['rev-parse','HEAD']:print(os.environ['FIXTURE_CHECKOUT'])\nelif a==['rev-parse','origin/main']:print(os.environ['FIXTURE_FETCHED'])\nelse:sys.exit(9)\n",
                        'gh': "import os\nprint(os.environ['FIXTURE_API_MAIN'])\n"}
                    for name, code in programs.items():
                        path=commands/name;path.write_text('#!'+sys.executable+'\n'+code);path.chmod(0o755)
                    output=root/'github-env';output.write_text('')
                    env={**os.environ,'PATH':str(commands)+os.pathsep+os.environ['PATH'],
                         'GITHUB_SHA':TARGET,'GITHUB_WORKFLOW_SHA':TARGET,
                         'GITHUB_REPOSITORY':'fixture/repo',
                         'GITHUB_WORKFLOW_REF':'fixture/repo/.github/workflows/production-stopped-runtime-headroom.yml@refs/heads/main',
                         'GITHUB_ENV':str(output),'EVIDENCE_DIR':str(root/'evidence'),
                         'FIXTURE_CHECKOUT':TARGET,'FIXTURE_FETCHED':TARGET,
                         'FIXTURE_API_MAIN':TARGET,**changes}
                    result=subprocess.run(['bash','-ceu',prefix],cwd=root,env=env,text=True,capture_output=True)
                    self.assertEqual(result.returncode == 0,accepted,result.stderr)
                    self.assertEqual('TARGET_SHA='+TARGET in output.read_text(),accepted)

    def test_actual_bash_stage_keeps_unknown_for_transport_or_post_source_ambiguity(self):
        import subprocess
        import sys
        workflow, source = actual_workflow_step('Execute only the separately accepted image-only stage')
        final={'schemaVersion':'pc.stopped-runtime-headroom.v1','targetSha':TARGET,
               'beforeAvailableKb':0,'afterAvailableKb':6*1024*1024,'attemptedImages':1,
               'deletedImages':1,'refusedImages':0,'passed':True,'targetReached':True,
               'metadataUnchanged':True,'volumesUnchanged':True,'networksUnchanged':True,
               'runtimeRestored':False,'volumeDataIntegrity':'NOT_ATTESTED'}
        failed={'schemaVersion':'pc.stopped-runtime-headroom.v1','passed':False,
                'errorCode':'CONTAINERD_CONTAINERS_PRESENT','runtimeRestored':False,
                'mutationOutcome':'RECONCILIATION_REQUIRED_IF_STARTED'}
        capacity={**final,'afterAvailableKb':0,'passed':False,'targetReached':False}
        cases=[('success',final,0,TARGET,'success'),
               ('transport',final,255,TARGET,'unknown'),
               ('wrong-status',final,2,TARGET,'unknown'),
               ('source-drift',final,0,'c'*40,'unknown'),
               ('capacity',capacity,2,TARGET,'failure'),
               ('exception',failed,1,TARGET,'failure'),
               ('false-success',failed,0,TARGET,'unknown'),
               ('empty',None,255,TARGET,'unknown')]
        for name, payload, status, post_sha, expected in cases:
            with self.subTest(case=name):
                with tempfile.TemporaryDirectory() as directory:
                    root=Path(directory);commands=root/'bin';commands.mkdir()
                    output=root/'evidence';output.mkdir()
                    dummy=root/'scripts/production_stopped_runtime_headroom.py';dummy.parent.mkdir();dummy.write_text('# fixture only\n')
                    raw=root/'fixture-output';raw.write_text('' if payload is None else json.dumps(payload)+'\n')
                    done=root/'ssh-done'
                    programs={
                        'git': "import os,sys,pathlib\na=sys.argv[1:]\nif a and a[0]=='fetch':sys.exit(0)\nif a==['rev-parse','origin/main']:print(os.environ['FIXTURE_POST_SHA'] if pathlib.Path(os.environ['FIXTURE_DONE']).exists() else os.environ['TARGET_SHA'])\nelse:sys.exit(9)\n",
                        'ssh': "import os,sys,pathlib\npathlib.Path(os.environ['FIXTURE_DONE']).write_text('done')\nsys.stdout.write(pathlib.Path(os.environ['FIXTURE_OUTPUT']).read_text())\nsys.exit(int(os.environ['FIXTURE_STATUS']))\n"}
                    for command, code in programs.items():
                        path=commands/command;path.write_text('#!'+sys.executable+'\n'+code);path.chmod(0o755)
                    env={**os.environ,'PATH':str(commands)+os.pathsep+os.environ['PATH'],
                         'TARGET_SHA':TARGET,'EVIDENCE_DIR':str(output),
                         'SSH_USER_SECRET':'fixture','PROD_HOST':'127.0.0.1','PROD_PORT':'1',
                         'FIXTURE_OUTPUT':str(raw),'FIXTURE_STATUS':str(status),
                         'FIXTURE_POST_SHA':post_sha,'FIXTURE_DONE':str(done)}
                    result=subprocess.run(['bash','-ceu',source],cwd=root,env=env,text=True,capture_output=True)
                    self.assertTrue(done.is_file())
                    body=(output/'issue-record.md').read_text()
                    self.assertEqual(result.returncode == 0,expected == 'success',result.stderr)
                    terminal=output/'result.jsonl'
                    if expected == 'unknown':
                        self.assertIn('`UNKNOWN`',body)
                        self.assertFalse(terminal.exists())
                    else:
                        self.assertNotIn('`UNKNOWN`',body)
                        self.assertTrue(terminal.is_file())
                        self.assertEqual(json.loads(terminal.read_text().splitlines()[-1])['passed'],expected == 'success')

    def test_actual_metadata_checks_identity_symlinks_size_and_atime(self):
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            directory = root / 'containers' / CID
            directory.mkdir(parents=True)
            config = directory / 'config.v2.json'
            value = {'ID': CID, 'Image': USED, 'MountPoints': {}, 'Config': {'Env': ['SECRET']}}
            config.write_text(json.dumps(value))
            with patch.object(m, 'EXPECTED_REFS', ((CID, USED),)):
                paths = (root, directory.parent, directory, config)
                for path in paths:
                    os.utime(path, ns=(1, path.stat().st_mtime_ns))
                records, _ = m.metadata(root_name)
                self.assertEqual(records[0][:2], (CID, USED))
                self.assertNotIn('SECRET', repr(records))
                self.assertTrue(all(path.stat().st_atime_ns == 1 for path in paths))
                config.write_text(json.dumps({**value, 'ID': 'x'}))
                with self.assertRaises(m.RecoveryError):
                    m.metadata(root_name)
                config.unlink()
                target = root / 'target'
                target.write_text(json.dumps(value))
                config.symlink_to(target)
                with self.assertRaises(OSError):
                    m.metadata(root_name)
                config.unlink()
                config.write_text(json.dumps({**value, 'padding': 'x' * (4 * 1024 * 1024)}))
                with self.assertRaises(m.RecoveryError):
                    m.metadata(root_name)

class ClosedDockerFailureContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import re
        import textwrap
        cls.workflow = (Path(__file__).parents[1] / '.github/workflows/production-docker-headroom-diagnostic.yml').read_text()
        cls.sources = {}
        for key in ('SIGNAL', 'TRANSPORT', 'SUMMARY'):
            start = re.search(r"^          (?:cat > .* <<'|python3 .* <<')PY_CLOSED_DOCKER_" + key + "'\\n", cls.workflow, re.M)
            if not start:
                raise AssertionError('missing actual closed source ' + key)
            end = cls.workflow.index('          PY_CLOSED_DOCKER_' + key + '\n', start.end())
            cls.sources[key] = textwrap.dedent(cls.workflow[start.end():end])
        cls.module = {'__name__': 'closed_collector_contract'}
        exec(compile(cls.sources['SIGNAL'], '<actual-closed-signal>', 'exec'), cls.module)
        cls.transport = {'__name__': 'closed_transport_contract'}
        exec(compile(cls.sources['TRANSPORT'], '<actual-closed-transport>', 'exec'), cls.transport)

    def metadata(self, path):
        import stat
        from types import SimpleNamespace
        mode = stat.S_IFDIR | 0o755
        if path == '/usr/bin/docker': mode = stat.S_IFREG | 0o755
        if path == '/run/docker.sock': mode = stat.S_IFSOCK | 0o660
        return SimpleNamespace(st_dev=1, st_ino=hash(path), st_mode=mode, st_uid=0, st_gid=0,
                               st_size=1, st_mtime_ns=1, st_ctime_ns=1)

    def collect(self, source, *, metadata=None):
        import subprocess
        import sys
        real_popen = subprocess.Popen
        calls = []
        def popen(argv, **kwargs):
            self.assertEqual(tuple(argv), self.module['ARGV'])
            self.assertEqual(kwargs['env'], {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C'})
            self.assertEqual(kwargs['cwd'], '/')
            self.assertIs(kwargs['stdin'], subprocess.DEVNULL)
            self.assertTrue(kwargs['close_fds']); self.assertTrue(kwargs['start_new_session'])
            self.assertTrue(callable(kwargs['preexec_fn']))
            calls.append(tuple(argv))
            return real_popen([sys.executable, '-I', '-c', source], **kwargs)
        with patch.object(os, 'geteuid', return_value=0), patch.object(os, 'lstat', side_effect=metadata or self.metadata), \
                patch.object(subprocess, 'Popen', side_effect=popen):
            result = self.module['collect']()
        self.assertLessEqual(len(calls), 1)
        return self.module['validate_report'](result), calls

    def test_fixed_argv_and_zero_success_is_no_volume_attestation(self):
        result, calls = self.collect('pass')
        self.assertEqual(result['status'], 'SUCCESS'); self.assertEqual(result['container_count'], 0)
        self.assertEqual(len(calls), 1); self.assertEqual(result['root_cause'], 'NOT_ESTABLISHED')
        self.assertFalse(result['deployment_authorized']); self.assertFalse(result['production_mutation'])

    def test_valid_ids_are_counted_without_publishing_identifiers(self):
        result, _ = self.collect("print('c'*64)")
        self.assertEqual(result['container_count'], 1); self.assertNotIn('c'*64, json.dumps(result))

    def test_nonzero_permission_signal_has_no_raw_stderr(self):
        secret = 'SECRET_SHOULD_NEVER_ESCAPE'
        result, _ = self.collect("import os; os.write(2,b'permission denied while trying to connect to the docker daemon socket SECRET_SHOULD_NEVER_ESCAPE');raise SystemExit(1)")
        self.assertEqual(result['status'], 'NONZERO')
        self.assertEqual(result['failure_signal'], 'SOCKET_PERMISSION_DENIED'); self.assertNotIn(secret,json.dumps(result))

    def test_nonzero_unknown_and_ambiguous_errors_stay_unknown(self):
        for payload in [b'SECRET_RAW_PATH', b'unknown shorthand flag: context not found:']:
            with self.subTest(payload=payload):
                result, _ = self.collect('import os;os.write(2,'+repr(payload)+');raise SystemExit(1)')
                self.assertEqual(result['status'], 'NONZERO'); self.assertEqual(result['failure_signal'], 'UNKNOWN')
                self.assertNotIn('SECRET_RAW_PATH',json.dumps(result))

    def test_all_allowlisted_signals_only_return_closed_enums(self):
        cases = {
            b'Cannot connect to the Docker daemon at unix:///run/docker.sock. Is the docker daemon running?': 'DAEMON_ENDPOINT_UNREACHABLE',
            b'Error response from daemon: secret': 'DAEMON_RESPONSE_ERROR', b'unknown shorthand flag: secret': 'CLI_ARGUMENT_REJECTED',
            b'unable to resolve docker endpoint: secret': 'CLIENT_ENDPOINT_RESOLUTION_FAILED',
            b'client version is too old. Minimum supported API version is secret': 'API_NEGOTIATION_FAILED',
            b'context not found: secret': 'CONTEXT_RESOLUTION_FAILED'}
        for raw, expected in cases.items(): self.assertEqual(self.module['failure_signal'](raw), expected)
        self.assertEqual(self.module['failure_signal'](b'x'*16385),'UNKNOWN')

    def test_stdout_error_and_excess_counts_do_not_become_success(self):
        for source in ["print('SECRET_INVALID_STDOUT')", "print(('c'*64+'\\n')*129)", "print(('c'*64+'\\n')*2)"]:
            result,_=self.collect(source);self.assertEqual(result['status'],'INVALID_OUTPUT');self.assertIsNone(result['container_count'])

    def test_output_cap_and_timeout_fail_closed_and_reap(self):
        result,_=self.collect("import os;os.write(2,b'SECRET'+b'x'*32768)")
        self.assertEqual(result['status'],'OUTPUT_LIMIT');self.assertLessEqual(result['stderr_bytes'],16385)
        old_command,old_outer=self.module['COMMAND_SECONDS'],self.module['OUTER_SECONDS']
        self.module.update(COMMAND_SECONDS=0.08,OUTER_SECONDS=0.5)
        try: result,_=self.collect('import time;time.sleep(10)')
        finally:self.module.update(COMMAND_SECONDS=old_command,OUTER_SECONDS=old_outer)
        self.assertEqual(result['status'],'TIMED_OUT');self.assertIsNone(result['container_count'])

    def test_nonroot_missing_untrusted_paths_do_not_execute(self):
        import stat
        with patch.object(os,'geteuid',return_value=1),patch.object(self.module['subprocess'],'Popen') as run:
            result=self.module['collect']();self.assertEqual(result['failure_signal'],'ROOT_REQUIRED');run.assert_not_called()
        for target,signal in [('/usr/bin/docker','CLI_MISSING'),('/run/docker.sock','SOCKET_MISSING')]:
            def metadata(path):
                if path==target:raise FileNotFoundError()
                return self.metadata(path)
            result,calls=self.collect('pass',metadata=metadata);self.assertEqual(result['failure_signal'],signal);self.assertEqual(calls,[])
        for target,signal in [('/usr/bin','FIXED_PARENT_UNTRUSTED'),('/usr/bin/docker','CLI_UNTRUSTED'),('/run/docker.sock','SOCKET_UNTRUSTED')]:
            def metadata(path):
                value=self.metadata(path)
                if path==target:value.st_mode=stat.S_IFLNK|0o777
                return value
            result,calls=self.collect('pass',metadata=metadata);self.assertEqual(result['failure_signal'],signal);self.assertEqual(calls,[])

    def test_changed_fixed_identity_cannot_pass(self):
        count={}
        def metadata(path):
            value=self.metadata(path);count[path]=count.get(path,0)+1
            if path=='/usr/bin/docker' and count[path]>1:value.st_ino+=1
            return value
        result,_=self.collect('pass',metadata=metadata);self.assertEqual(result['status'],'UNSTABLE');self.assertIsNone(result['container_count'])

    def test_cleanup_and_metadata_permission_uncertainty_cannot_pass(self):
        with patch.object(os, 'killpg', side_effect=PermissionError()):
            result, _ = self.collect('pass')
        self.assertEqual(result['status'], 'CLEANUP_UNCONFIRMED'); self.assertIsNone(result['container_count'])
        for target in ['/usr/bin/docker','/run/docker.sock']:
            def metadata(path):
                if path == target: raise PermissionError()
                return self.metadata(path)
            result, calls = self.collect('pass', metadata=metadata)
            self.assertEqual(result['failure_signal'], 'EXECUTION_UNAVAILABLE'); self.assertEqual(calls, [])

    def test_schema_rejects_extra_secret_and_false_success_fields(self):
        valid,_=self.collect('pass')
        for changes in [{'raw_stderr':'SECRET'}, {'production_mutation':True}, {'deployment_authorized':True},
                        {'container_count':True}, {'failure_signal':'SECRET'}, {'root_cause':'DAEMON_STOPPED'}]:
            with self.assertRaises((ValueError,TypeError)):self.module['validate_report']({**valid,**changes})

    def transport_case(self, payload, code=0):
        import subprocess,sys
        real_popen=subprocess.Popen
        def popen(argv,**kwargs):
            self.assertEqual(argv[0],'/usr/bin/ssh');self.assertEqual(argv[-1],'python3 -I -')
            self.assertIn('StrictHostKeyChecking=yes',argv);self.assertIn('BatchMode=yes',argv)
            child='import sys;sys.stdin.buffer.read();sys.stdout.buffer.write('+repr(payload)+');raise SystemExit('+str(code)+')'
            return real_popen([sys.executable,'-I','-c',child],**kwargs)
        with tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'PROD_HOST':'fixture','DEFAULT_HOST':'fixture','SSH_USER_SECRET':'fixture','PROD_PORT':'22','HOME':tmp}),patch.object(subprocess,'Popen',side_effect=popen):
            path=Path(tmp)/'envelope.json'
            result=self.transport['execute'](self.sources['SIGNAL'],'b'*40,path)
            self.assertEqual(json.loads(path.read_text()),result)
            self.assertNotIn('SECRET',path.read_text())
            return result

    def test_transport_accepts_only_exact_closed_success_with_exit_binding(self):
        valid,_=self.collect('pass')
        result=self.transport_case(json.dumps(valid).encode(),0);self.assertTrue(result['passed'])
        result=self.transport_case(json.dumps(valid).encode(),1);self.assertFalse(result['passed']);self.assertEqual(result['transport_status'],'INVALID_REMOTE_REPORT')

    def test_transport_rejects_raw_errors_extra_keys_and_ssh_failure(self):
        valid,_=self.collect('pass')
        for payload,code,status in [(b'SECRET_RAW_STDERR',1,'INVALID_REMOTE_REPORT'),
                (json.dumps({**valid,'secret':'SECRET'}).encode(),0,'INVALID_REMOTE_REPORT'),
                (b'',255,'NONZERO'),(b'x'*5000,1,'OUTPUT_LIMIT')]:
            result=self.transport_case(payload,code);self.assertEqual(result['transport_status'],status);self.assertFalse(result['passed'])

    def test_transport_owned_timeout_and_uncertain_cleanup_are_failed(self):
        import subprocess,sys
        real_popen=subprocess.Popen
        def popen(argv,**kwargs):
            return real_popen([sys.executable,'-I','-c','import time;time.sleep(10)'],**kwargs)
        previous=self.transport['TRANSPORT_SECONDS'];self.transport['TRANSPORT_SECONDS']=2.1
        try:
            with tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'PROD_HOST':'fixture','DEFAULT_HOST':'fixture','SSH_USER_SECRET':'fixture','PROD_PORT':'22','HOME':tmp}),patch.object(subprocess,'Popen',side_effect=popen):
                result=self.transport['execute'](self.sources['SIGNAL'],'b'*40,Path(tmp)/'envelope.json')
                self.assertFalse(result['passed']);self.assertIn(result['transport_status'],['TIMED_OUT','CLEANUP_UNCONFIRMED'])
        finally:self.transport['TRANSPORT_SECONDS']=previous
        valid,_=self.collect('pass')
        with patch.object(os,'killpg',side_effect=PermissionError()):
            result=self.transport_case(json.dumps(valid).encode(),0)
        self.assertEqual(result['transport_status'],'CLEANUP_UNCONFIRMED');self.assertIsNone(result['diagnostic'])

    def test_unknown_remote_result_is_retained_as_failure_not_acceptance(self):
        result,_=self.collect("raise SystemExit(1)")
        envelope=self.transport_case(json.dumps(result).encode(),1)
        self.assertEqual(envelope['transport_status'],'VALIDATED_REMOTE_REPORT');self.assertFalse(envelope['passed'])
        self.assertEqual(envelope['diagnostic']['failure_signal'],'UNKNOWN')

    def test_legacy_broad_diagnostic_steps_and_upload_are_statically_unreachable(self):
        job=self.workflow.split('\n  diagnose:\n',1)[1].split('\n\n  inspect:\n',1)[0]
        for name in ['Prepare bounded preservation preflight payload','Prepare bounded capacity profile payload',
                'Collect read-only storage and runtime evidence','Build bounded diagnostic summary','Publish diagnostic evidence']:
            block=job.split('      - name: '+name+'\n',1)[1].split('\n      - ',1)[0]
            self.assertIn('        if: ${{ false }}',block)
            self.assertEqual(block.count('\n        if:'),0)
        self.assertIn('if: ${{ false }} # Historical broad artifact is never uploaded.',job)
        self.assertNotIn('docker version >/dev/null',job)
        newjob=job.split('      - name: Collect one closed Docker admission signal\n',1)[1].split('      - name: Prepare bounded preservation',1)[0]
        self.assertNotIn('remote-stderr.txt',newjob);self.assertNotIn('shell=True',newjob)
        self.assertIn('closed-diagnostic-candidate.json',newjob)
        upload=job.split('name: production-docker-closed-admission-',1)[1].split('\n      - ',1)[0]
        self.assertIn('/closed-diagnostic.json',upload);self.assertNotIn('path: artifacts/production-docker-headroom-diagnostic\n',upload)

    def summary_case(self, envelope, expected=True, missing=False):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);out=root/'evidence';out.mkdir()
            (root/'closed-docker-signal.py').write_text(self.sources['SIGNAL'])
            path=root/'closed-diagnostic-candidate.json'
            if not missing:path.write_text(json.dumps(envelope))
            with patch.dict(os.environ,{'RUNNER_TEMP':str(root),'EVIDENCE_DIR':str(out),'TARGET_SHA':'b'*40,'GITHUB_STEP_SUMMARY':str(root/'step.md')}):
                if expected:exec(compile(self.sources['SUMMARY'],'<actual-closed-summary>','exec'),{'__name__':'closed_summary_test'})
                else:
                    with self.assertRaises((SystemExit,ValueError,TypeError)):exec(compile(self.sources['SUMMARY'],'<actual-closed-summary>','exec'),{'__name__':'closed_summary_test'})
            if expected:
                self.assertTrue((out/'closed-diagnostic.json').is_file());self.assertTrue((out/'closed-issue-record.md').is_file())
                self.assertNotIn('SECRET',''.join(p.read_text() for p in out.iterdir()))
            else:self.assertFalse((out/'closed-diagnostic.json').exists())

    def test_publication_validates_before_copy_and_handles_missing_observation(self):
        valid,_=self.collect('pass');envelope={'schema':'pc.closed-docker-diagnostic-envelope.v2','target':'b'*40,'transport_status':'VALIDATED_REMOTE_REPORT','diagnostic':valid,'passed':True,'production_mutation':False,'deployment_authorized':False,'local_cleanup_attestation':'OWNED_ANCESTRY_REAPED'}
        self.summary_case(envelope)
        self.summary_case(None,missing=True)
        for changes in [{'raw':'SECRET'},{'target':'SECRET'},{'deployment_authorized':True}, {'diagnostic':{**valid,'stderr':'SECRET'}}]:
            self.summary_case({**envelope,**changes},expected=False)


class ClosedDockerR2OwnershipContract(unittest.TestCase):
    HARNESS = r'''
import ctypes, json, os, re, signal, stat, subprocess, sys, tempfile, textwrap, time
from pathlib import Path
from unittest.mock import patch
workflow = Path(sys.argv[1]).read_text()
sources = {}
for key in ('SIGNAL', 'TRANSPORT'):
    found = re.search(r"^          (?:cat > .* <<'|python3 .* <<')PY_CLOSED_DOCKER_" + key + "'\n", workflow, re.M)
    end = workflow.index('          PY_CLOSED_DOCKER_' + key + '\n', found.end())
    sources[key] = textwrap.dedent(workflow[found.end():end])
module = {'__name__': 'isolated_ownership_control'}
exec(compile(sources['SIGNAL'], '<actual-R2-signal>', 'exec'), module)
transport = {'__name__': 'isolated_transport_control'}
exec(compile(sources['TRANSPORT'], '<actual-R2-transport>', 'exec'), transport)
libc = ctypes.CDLL(None, use_errno=True)
def subreaper():
    flag = ctypes.c_int(-1)
    assert libc.prctl(37, ctypes.byref(flag), 0, 0, 0) == 0
    return flag.value
assert subreaper() == 0
assert signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL
try:
    os.waitid(os.P_ALL, 0, os.WEXITED | os.WNOWAIT | os.WNOHANG | 0x40000000)
except ChildProcessError:
    pass
else:
    raise AssertionError('harness is not fresh')
real_popen, real_killpg, real_waitid = subprocess.Popen, os.killpg, os.waitid
events, processes, released = [], [], set()
def tracked_waitid(kind, identity, options):
    value = real_waitid(kind, identity, options)
    if kind == os.P_ALL and not options & os.WNOWAIT and value is not None:
        assert value.si_pid not in [p.pid for p in processes], 'leader was reaped by ancestry drain'
        events.append('adopted_descendant_reaped')
    return value

def tracked_killpg(pgid, signum):
    assert signum == signal.SIGKILL, 'unapproved group signal'
    assert pgid in [p.pid for p in processes], 'not the owned leader group'
    assert pgid not in released, 'group syscall after final reap'
    real_waitid(os.P_PID, pgid, os.WEXITED | os.WNOWAIT | os.WNOHANG | 0x40000000)
    events.append('owned_group_signal_before_reap')
    return real_killpg(pgid, signum)

def wrap_process(proc):
    processes.append(proc)
    original_wait = proc.wait
    def wait(*args, **kwargs):
        events.append('final_leader_reap_started')
        value = original_wait(*args, **kwargs)
        released.add(proc.pid)
        events.append('leader_reaped')
        return value
    proc.wait = wait
    proc.poll = lambda: (_ for _ in ()).throw(AssertionError('poll may reap early'))
    return proc

operation, scenario = sys.argv[2:4]
if operation in ('collect', 'transport'):
    remote = {'schema': module['SCHEMA'], 'status': 'SUCCESS', 'failure_signal': 'NONE',
        'elapsed_ms': 1, 'stdout_bytes': 0, 'stderr_bytes': 0, 'container_count': 0,
        'root_cause': 'NOT_ESTABLISHED', 'production_mutation': False, 'deployment_authorized': False,
        'cleanup_attestation': 'OWNED_ANCESTRY_REAPED'}
    if operation == 'collect':
        if scenario == 'normal': code = "print('c'*64)"
        elif scenario == 'failure': code = "import os;os.write(2,b'Error response from daemon: PRIVATE_NOT_EXPORTED');raise SystemExit(1)"
        else:
            code = 'import time;time.sleep(10)'
            module.update(COMMAND_SECONDS=0.08, OUTER_SECONDS=0.5)
    else:
        if scenario == 'timeout':
            code = 'import sys,time;sys.stdin.buffer.read();time.sleep(10)'
            transport['TRANSPORT_SECONDS'] = 2.1
        else:
            if scenario == 'failure': remote.update(status='NONZERO',failure_signal='UNKNOWN',container_count=None)
            code = 'import sys;sys.stdin.buffer.read();print('+repr(json.dumps(remote))+');raise SystemExit('+str(1 if scenario == 'failure' else 0)+')'
    def popen(argv, **kwargs):
        if operation == 'collect':
            assert tuple(argv) == module['ARGV']
            assert kwargs['env'] == module['ENV']
        else:
            assert argv[0] == '/usr/bin/ssh' and argv[-1] == 'python3 -I -'
        return wrap_process(real_popen([sys.executable, '-I', '-c', code], **kwargs))
    def metadata(path):
        from types import SimpleNamespace
        mode = stat.S_IFDIR | 0o755
        if path == '/usr/bin/docker': mode = stat.S_IFREG | 0o755
        if path == '/run/docker.sock': mode = stat.S_IFSOCK | 0o660
        return SimpleNamespace(st_dev=1,st_ino=hash(path),st_mode=mode,st_uid=0,st_gid=0,st_size=1,st_mtime_ns=1,st_ctime_ns=1)
    with tempfile.TemporaryDirectory() as tmp, patch.object(subprocess,'Popen',side_effect=popen), patch.object(os,'killpg',side_effect=tracked_killpg), patch.object(os,'waitid',side_effect=tracked_waitid):
        if operation == 'collect':
            with patch.object(os,'geteuid',return_value=0), patch.object(os,'lstat',side_effect=metadata):
                result = module['collect']()
            assert result['cleanup_attestation'] == 'OWNED_ANCESTRY_REAPED'
            assert result['status'] == {'normal':'SUCCESS','failure':'NONZERO','timeout':'TIMED_OUT'}[scenario], result
        else:
            with patch.dict(os.environ,{'PROD_HOST':'fixture','DEFAULT_HOST':'fixture','SSH_USER_SECRET':'fixture','PROD_PORT':'22','HOME':tmp}):
                result = transport['execute'](sources['SIGNAL'],'b'*40,Path(tmp)/'envelope.json')
            assert result['local_cleanup_attestation'] == 'OWNED_ANCESTRY_REAPED'
            assert result['passed'] == (scenario == 'normal')
    assert events.count('owned_group_signal_before_reap') == 1
    assert events.index('owned_group_signal_before_reap') < events.index('leader_reaped')
    assert events[-1] == 'leader_reaped'
elif operation == 'ancestry':
    lease = module['OwnedChildLease']()
    child = 'import time;time.sleep(10)'
    leader = 'import subprocess,sys,os;p=subprocess.Popen([sys.executable,"-I","-c",'+repr(child)+'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session='+str(scenario == 'escaped')+');print(p.pid,flush=True);os._exit(0)'
    proc = wrap_process(real_popen([sys.executable,'-I','-c',leader],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True))
    child_pid = int(proc.stdout.readline())
    # This pidfd exists only in an isolated fixture harness; production uses no pidfd or outside-group signal.
    child_fd = os.pidfd_open(child_pid)
    try:
        assert lease.wait_without_reap(proc,time.monotonic()+2) == 0
        with patch.object(os,'killpg',side_effect=tracked_killpg), patch.object(os,'waitid',side_effect=tracked_waitid):
            cleaned = lease.close(proc,time.monotonic()+0.3)
        assert cleaned == (scenario == 'same-group'), (cleaned,events)
        assert events.index('owned_group_signal_before_reap') < events.index('leader_reaped')
        assert events.count('owned_group_signal_before_reap') == 1
        if scenario == 'same-group': assert 'adopted_descendant_reaped' in events
        else:
            # Cleanup only our still-owned escaped fixture by its held pidfd, never by a recycled numeric group ID.
            signal.pidfd_send_signal(child_fd,signal.SIGKILL)
            os.waitpid(child_pid,0)
    finally:
        os.close(child_fd)
elif operation == 'existing-child':
    fixture = real_popen([sys.executable,'-I','-c','import time;time.sleep(10)'])
    fd = os.pidfd_open(fixture.pid)
    try:
        try: module['OwnedChildLease']()
        except ValueError as error: assert str(error) == 'CHILD_PARENT_HAS_CHILDREN'
        else: raise AssertionError('preexisting child accepted')
    finally:
        signal.pidfd_send_signal(fd,signal.SIGKILL);fixture.wait();os.close(fd)
elif operation == 'prior-subreaper':
    assert libc.prctl(36,1,0,0,0) == 0
    try:
        try: module['OwnedChildLease']()
        except ValueError as error: assert str(error) == 'CHILD_PARENT_SUBREAPER_STATE'
        else: raise AssertionError('prior subreaper accepted')
        assert subreaper() == 1
    finally: assert libc.prctl(36,0,0,0,0) == 0
elif operation == 'ignored-sigchld':
    signal.signal(signal.SIGCHLD,signal.SIG_IGN)
    try:
        try: module['OwnedChildLease']()
        except ValueError as error: assert str(error) == 'CHILD_PARENT_NOT_FRESH'
        else: raise AssertionError('ignored SIGCHLD accepted')
    finally: signal.signal(signal.SIGCHLD,signal.SIG_DFL)
else:
    raise AssertionError('unknown ownership control')
assert subreaper() == 0
try:
    real_waitid(os.P_ALL,0,os.WEXITED|os.WNOWAIT|os.WNOHANG|0x40000000)
except ChildProcessError:
    pass
else:
    raise AssertionError('isolated fixture left a child')
print(json.dumps({'operation':operation,'scenario':scenario,'events':events,'subreaper_restored':True,'owned_children_absent':True}))
'''

    def ownership(self, operation, scenario='none'):
        import subprocess,sys
        workflow = Path(__file__).parents[1] / '.github/workflows/production-docker-headroom-diagnostic.yml'
        result = subprocess.run([sys.executable,'-I','-c',self.HARNESS,str(workflow),operation,scenario],
                                capture_output=True,text=True,timeout=8)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        proof=json.loads(result.stdout)
        self.assertTrue(proof['subreaper_restored']);self.assertTrue(proof['owned_children_absent'])
        return proof

    def test_actual_normal_completion_keeps_leader_identity_until_groupsignal(self):
        for operation in ['collect','transport']:self.ownership(operation,'normal')

    def test_actual_failed_completion_keeps_leader_identity_until_groupsignal(self):
        for operation in ['collect','transport']:self.ownership(operation,'failure')

    def test_actual_timeouts_kill_and_reap_before_ancestry_absence(self):
        for operation in ['collect','transport']:self.ownership(operation,'timeout')

    def test_actual_same_group_descendant_is_killed_and_reaped(self):
        self.ownership('ancestry','same-group')

    def test_actual_escaped_descendant_is_unknown_without_outside_group_signal(self):
        self.ownership('ancestry','escaped')

    def test_fresh_parent_rejects_preexisting_child_and_subeaper_state(self):
        self.ownership('existing-child');self.ownership('prior-subreaper');self.ownership('ignored-sigchld')

    def test_v1_replay_and_unattested_success_are_rejected(self):
        ClosedDockerFailureContract.setUpClass()
        module=ClosedDockerFailureContract.module
        value={'schema':module['SCHEMA'],'status':'SUCCESS','failure_signal':'NONE','elapsed_ms':1,'stdout_bytes':0,'stderr_bytes':0,'container_count':0,'root_cause':'NOT_ESTABLISHED','production_mutation':False,'deployment_authorized':False,'cleanup_attestation':'OWNED_ANCESTRY_REAPED'}
        self.assertEqual(module['validate_report'](value),value)
        for changes in [{'schema':'pc.closed-docker-failure-signal.v1'},{'cleanup_attestation':'NOT_ATTESTED'}, {'cleanup_attestation':'NOT_STARTED'}]:
            with self.assertRaises(ValueError):module['validate_report']({**value,**changes})



if __name__ == '__main__':
    unittest.main()
