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
        for name in ('production-stopped-runtime-headroom.yml',
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
        expected = {'production-full-stack-exact-sha.yml',
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
        for raw, accepted in (('',False), ('UNTRUSTED_SECRET',False),
                              (json.dumps({**valid,'injected':'UNTRUSTED_SECRET'}),False),
                              (json.dumps(valid),True)):
            with self.subTest(raw_kind='valid' if accepted else 'rejected'):
                with tempfile.TemporaryDirectory() as root_name:
                    root = Path(root_name)
                    result = subprocess.run([sys.executable,'-',TARGET,str(root)],input=pending,
                        text=True,capture_output=True)
                    self.assertEqual(result.returncode,0,result.stderr)
                    source = root/'input.txt';source.write_text(raw)
                    result = subprocess.run([sys.executable,'-',str(source),TARGET,str(root)],
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


if __name__ == '__main__':
    unittest.main()
