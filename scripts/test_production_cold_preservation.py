#!/usr/bin/env python3
"""Retained preservation/config regressions plus separately named bootstrap contracts.
Real Docker wire acceptance runs only with explicit --require-native-docker in native CI.
No production host or protected credentials are used by these fixtures.
"""
import copy
import ast
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import tarfile
import tempfile
import textwrap
import sys
import time
import types
import unittest
from unittest.mock import patch

import production_cold_preservation as cold

SHA = 'a' * 40

import base64
import zlib
# Exact public accepted observer workflow, compressed only as a golden fixture.
# Its old command is retired; these tests exercise historical safe primitives.
_RETAINED_WORKFLOW = zlib.decompress(base64.b64decode('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')).decode()
assert hashlib.sha256(_RETAINED_WORKFLOW.encode()).hexdigest() == 'cf0f6664d59ff4f633497da09c23d1bc8c5e1692174a76215fd89c58bb774467'
REQUIRE_NATIVE_DOCKER = '--require-native-docker' in sys.argv
if REQUIRE_NATIVE_DOCKER:
    sys.argv.remove('--require-native-docker')
CONFIG_FIELDS = ('image', 'environment', 'command', 'entrypoint', 'user', 'workingDirectory',
                 'mounts', 'networkNames', 'ports', 'restart', 'privileged', 'readOnly',
                 'capAdd', 'capDrop', 'securityOptions')
REQUIRE_NATIVE_COMPOSE = '--require-native-compose' in sys.argv
if REQUIRE_NATIVE_COMPOSE:
    sys.argv.remove('--require-native-compose')


def vendor_fixture_bytes():
    path = os.environ.get('PC_CROP_TEST_COMPOSE_BINARY')
    if not path:
        if REQUIRE_NATIVE_COMPOSE:
            raise AssertionError('mandatory verified native vendor parser is missing')
        raise unittest.SkipTest('verified public Compose parser unavailable; mandatory in native contract')
    raw = Path(path).read_bytes()
    if len(raw) != 32663526 or hashlib.sha256(raw).hexdigest() != '40343e21ca777173e69cff5dbafeb37c6f81f3b0d57d9e597f036e95eb63e76a':
        raise AssertionError('native vendor parser identity mismatch')
    return raw


def workflow_step(name):
    here = Path(__file__).parent
    path = here / 'production-cold-preservation.yml'
    if not path.is_file():
        path = here.parent / '.github/workflows/production-cold-preservation.yml'
    text = _RETAINED_WORKFLOW
    block = text.split('      - name: ' + name + '\n', 1)[1].split('\n      - ', 1)[0]
    return text, textwrap.dedent(block.split('        run: |\n', 1)[1])


def valid_terminal():
    return {'schemaVersion': 'pc.cold-preservation.v1', 'targetSha': SHA, 'runId': '12345',
            'passed': True, 'status': 'ENCRYPTED_COLD_PRESERVATION_VERIFIED',
            'ciphertextBytes': 1234, 'ciphertextSha256': 'd' * 64, 'entries': 3000,
            'sourceBytes': 1048576, 'volumes': 19, 'sourceUnchanged': True,
            'runtimeUnchanged': True, 'runtimeRestored': False, 'databaseIntegrity': 'NOT_ATTESTED',
            'restoreVerification': 'NOT_PERFORMED', 'offHostRecovery': 'NOT_ESTABLISHED'}


def valid_bindings_terminal():
    result = valid_terminal()
    result.pop('volumes')
    result.update(schemaVersion=cold.BINDINGS_SCHEMA, status='ENCRYPTED_BINDINGS_PRESERVATION_VERIFIED',
                  selectedRoots=16, bindReferences=8, composeFiles=8, startupAuthorized=False,
                  currentComposeParity='NOT_ATTESTED', environmentFilesCovered=False)
    return result



def valid_configuration_terminal():
    return {'schemaVersion': 'pc.stopped-configuration.v2', 'targetSha': SHA, 'runId': '12345',
            'passed': True, 'classification': 'READ_ONLY_CONFIGURATION_OBSERVED_NOT_STARTUP_ACCEPTANCE',
            'readOnly': True, 'runtimeRestored': False, 'startupAuthorized': False,
            'canonicalApiBinding': 'NOT_PROVEN', 'fullComposeParity': 'NOT_FULLY_ATTESTED',
            'databaseIntegrity': 'NOT_FULLY_ATTESTED', 'sourceRuntimeUnchanged': True,
            'privateInputsUnchanged': True, 'plaintextTransfer': False, 'composeVersion': '5.6.0',
            'comparedServiceCount': 3, 'missingServiceCount': 0, 'extraServiceCount': 0,
            'comparedFields': list(CONFIG_FIELDS), 'mismatchCounts': dict.fromkeys(CONFIG_FIELDS, 0),
            'unprovedCounts': dict.fromkeys(CONFIG_FIELDS, 0),
            'inputCoverage': {'composeFiles': 1, 'projectEnvPresent': True,
                              'declaredEnvFiles': 1, 'labelFileSetsEqual': True, 'savedHostConfigs': 11},
            'observedFieldsAgreement': 'MATCH', 'savedApiDeclaredTarget': 'DIRECT_POSTGRES_CONFIGURATION_MATCH',
            'serviceDispositions': [{'roleClass': role, 'disposition': 'COMPARED', 'mismatchFields': [], 'unprovedFields': []}
                                    for role in ('api', 'web', 'postgres')]}


def embedded_configuration_profile():
    _, shell = workflow_step('Inspect only the accepted stopped configuration')
    code = shell.split("<<'PY_PAYLOAD'\n", 1)[1].split('\nPY_PAYLOAD\n', 1)[0]
    values = [ast.literal_eval(node.value) for node in ast.parse(code).body if isinstance(node, ast.Assign)
              and any(isinstance(target, ast.Name) and target.id == 'profile' for target in node.targets)]
    if len(values) != 1:
        raise AssertionError('one literal observer is required')
    module = types.ModuleType('configuration_fixture')
    exec(compile(values[0], '<actual-configuration-profile>', 'exec'), module.__dict__)
    return module


def inspector_workflow_bytes():
    _, shell = active_workflow_step('Restore only the accepted historical core')
    code = shell.split("<<'PY_PAYLOAD'\n", 1)[1].split('\nPY_PAYLOAD\n', 1)[0]
    node = next(n for n in ast.parse(code).body if isinstance(n, ast.FunctionDef) and n.name == 'verified_inspector_workflow')
    scope = {}
    exec(compile(ast.Module(body=[node], type_ignores=[]), '<actual-inspector-identity>', 'exec'), scope)
    path = Path(__file__).resolve().parent.parent / '.github/workflows/production-docker-headroom-diagnostic.yml'
    return scope[node.name](path.read_bytes())


def retained_inspector_workflow_bytes():
    return inspector_workflow_bytes()[:191427]


def accepted_inspector_fixture(refs):
    raw = inspector_workflow_bytes()
    parts = []
    for name in ('PY_INSPECTION_0', 'PY_INSPECTION_1', 'PY_INSPECTION_2'):
        begin = ("<<'" + name + "'\n").encode()
        end = ('\n          ' + name + '\n').encode()
        parts.append(textwrap.dedent(raw.split(begin, 1)[1].split(end, 1)[0].decode()))
    module = types.ModuleType('actual_inspector_fixture')
    module.__file__ = '<actual-inspector-fixture>'
    module.EXPECTED_REFS = refs
    exec(compile('\n'.join(parts), '<actual-accepted-inspector>', 'exec'), module.__dict__)
    return module

class Host:
    def __init__(self):
        self.calls = 0
        self.drift_at = None
        self.state = ((), (b'database',), (), frozenset(), frozenset())

    def observe(self):
        self.calls += 1
        if self.calls == self.drift_at:
            return self.state[:-1] + (frozenset({'unexpected'}),)
        return self.state


class PreservationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'docker'
        self.backup = Path(self.temp.name) / 'backups'
        self.root.mkdir(mode=0o700)
        self.backup.mkdir(mode=0o700)
        (self.root / 'containers').mkdir()
        (self.root / 'containers' / 'metadata').write_bytes(b'private synthetic configuration')
        self.data = self.root / 'volumes' / 'database' / '_data'
        self.data.mkdir(parents=True)
        self.payload = self.data / '-данные\n name'
        self.payload.write_bytes(b'\0synthetic customer fixture\xff')
        self.payload.chmod(0o640)
        os.setxattr(self.payload, 'user.binary', b'\0\xff\nfixture')
        os.link(self.payload, self.data / 'hardlink')
        with (self.data / 'sparse').open('wb') as handle:
            handle.seek(1024 * 1024)
            handle.write(b'end')
        self.age()
        self.host = Host()

    def tearDown(self):
        self.temp.cleanup()

    def age(self):
        for parent, directories, files in os.walk(self.root):
            for name in [*directories, *files]:
                os.utime(Path(parent) / name, ns=(946684800123456789, 978307200123456789))
        os.utime(self.root, ns=(946684800123456789, 978307200123456789))

    def preserve(self, **options):
        return cold.preserve(self.host, SHA, '12345', source_root=str(self.root),
                             backup_root=str(self.backup), owner_uid=os.geteuid(),
                             runtime_probe=options.pop('runtime_probe', lambda: None), **options)

    def snapshot(self):
        with cold.SourceSnapshot(self.root, ['database'], owner_uid=os.geteuid()) as snapshot:
            snapshot.capture()
            return copy.deepcopy(snapshot.entries)

    def test_retained_gnu_tar_gpg_roundtrip_preserves_source_and_private_evidence(self):
        before = self.snapshot()
        result = self.preserve()
        self.assertEqual(before, self.snapshot())
        self.assertEqual(self.host.calls, 3)
        operation = self.backup / cold.OPERATION_NAME
        cipher = operation / 'preservation.tar.gpg'
        self.assertTrue(result['passed'])
        self.assertFalse(result['runtimeRestored'])
        self.assertEqual(result['databaseIntegrity'], 'NOT_ATTESTED')
        self.assertEqual(result['restoreVerification'], 'NOT_PERFORMED')
        self.assertEqual(result['ciphertextSha256'], hashlib.sha256(cipher.read_bytes()).hexdigest())
        self.assertEqual(result, json.loads((operation / 'receipt.json').read_text()))
        self.assertEqual(stat.S_IMODE(operation.stat().st_mode), 0o700)
        for name in ('passphrase', 'preservation.tar.gpg', 'receipt.json'):
            self.assertEqual(stat.S_IMODE((operation / name).stat().st_mode), 0o600)
        self.assertFalse(list(operation.rglob('S.gpg-agent*')))
        self.assertEqual({p.name for p in operation.iterdir()},
                         {'gnupg', 'passphrase', 'preservation.tar.gpg', 'receipt.json'})
        self.assertNotIn('private synthetic configuration', json.dumps(result))
        self.assertNotIn('user.binary', json.dumps(result))
        key = os.open(operation / 'passphrase', os.O_RDONLY)
        try:
            with cipher.open('rb') as source:
                decrypted = subprocess.run(cold.gpg_arguments(str(operation / 'gnupg'), key) +
                                           ['--decrypt', '--output', '-'], stdin=source,
                                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                           pass_fds=(key,), check=True, env=cold.CHILD_ENV).stdout
        finally:
            os.close(key)
        # Verify real extraction as well as the production content verifier.
        restored = Path(self.temp.name) / 'restored'
        restored.mkdir()
        subprocess.run(['/usr/bin/tar', '--extract', '--xattrs', '--acls', '--sparse',
                        '--same-permissions', '--file', '-', '--directory', str(restored)],
                       input=decrypted, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       check=True, env=cold.CHILD_ENV)
        output = restored / self.payload.relative_to(self.root)
        self.assertEqual(output.read_bytes(), b'\0synthetic customer fixture\xff')
        self.assertEqual(os.getxattr(output, 'user.binary'), b'\0\xff\nfixture')
        self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o640)
        self.assertEqual(output.stat().st_ino, (output.parent / 'hardlink').stat().st_ino)
        self.assertLess((output.parent / 'sparse').stat().st_blocks * 512, 1024 * 1024)

    def test_corrupt_ciphertext_never_reaches_archive_parser_or_success_receipt(self):
        real_run = subprocess.run
        def corrupt_before_authentication(argv, **options):
            if '--decrypt' in argv:
                fd = options['stdin']
                last = os.fstat(fd).st_size - 1
                value = os.pread(fd, 1, last)
                os.pwrite(fd, bytes([value[0] ^ 1]), last)
            return real_run(argv, **options)
        with patch.object(cold.subprocess, 'run', side_effect=corrupt_before_authentication), \
             patch.object(cold, 'verify_archive', side_effect=AssertionError('UNAUTHENTICATED_PARSE')):
            with self.assertRaisesRegex(cold.PreservationError, 'ARCHIVE_AUTHENTICATION_FAILED'):
                self.preserve()
        operation = self.backup / cold.OPERATION_NAME
        self.assertTrue((operation / 'passphrase').is_file())
        self.assertTrue((operation / 'preservation.tar.gpg').is_file())
        self.assertFalse((operation / 'receipt.json').exists())

    def test_more_than_2048_files_are_completely_profiled_and_global_bound_is_enforced(self):
        for i in range(2051):
            (self.data / str(i)).touch()
        complete = self.snapshot()
        self.assertIn('volumes/database/_data/2050', complete)
        with patch.object(cold, 'MAX_ENTRIES', 100):
            with self.assertRaisesRegex(cold.PreservationError, 'SOURCE_ENTRY_LIMIT'):
                self.preserve()
        self.assertEqual(list(self.backup.iterdir()), [])

    def test_symlink_special_file_missing_data_and_source_byte_limit_block_before_write(self):
        unsafe = self.data / 'unsafe'
        for kind in ('symlink', 'fifo'):
            with self.subTest(kind=kind):
                if kind == 'symlink':
                    unsafe.symlink_to('/etc/passwd')
                else:
                    os.mkfifo(unsafe)
                with self.assertRaisesRegex(cold.PreservationError, 'SOURCE_LINK_OR_SPECIAL'):
                    self.preserve()
                unsafe.unlink()
                self.assertEqual(list(self.backup.iterdir()), [])
        with patch.object(cold, 'MAX_SOURCE_BYTES', 10):
            with self.assertRaisesRegex(cold.PreservationError, 'SOURCE_BYTE_LIMIT'):
                self.preserve()
        self.data.rename(self.data.with_name('missing'))
        with self.assertRaises(FileNotFoundError):
            self.preserve()
        self.assertEqual(list(self.backup.iterdir()), [])

    def test_readonly_preconditions_and_runtime_drift_never_create_an_operation(self):
        self.host.drift_at = 2
        with self.assertRaisesRegex(cold.PreservationError, 'PRE_WRITE_RUNTIME_DRIFT'):
            self.preserve()
        self.assertEqual(list(self.backup.iterdir()), [])
        def running():
            raise cold.PreservationError('POSTGRES_PROCESS_PRESENT_OR_UNKNOWN')
        with self.assertRaisesRegex(cold.PreservationError, 'POSTGRES_PROCESS_PRESENT_OR_UNKNOWN'):
            self.preserve(runtime_probe=running)
        self.assertEqual(list(self.backup.iterdir()), [])
        self.backup.chmod(0o755)
        with self.assertRaisesRegex(cold.PreservationError, 'BACKUP_ROOT_IDENTITY'):
            self.preserve()
        self.assertEqual(list(self.backup.iterdir()), [])

    def test_existing_operation_is_never_overwritten_or_replayed(self):
        operation = self.backup / cold.OPERATION_NAME
        operation.mkdir(mode=0o700)
        sentinel = operation / 'passphrase'
        sentinel.write_bytes(b'synthetic preserved recovery key')
        with self.assertRaisesRegex(cold.PreservationError, 'OPERATION_ALREADY_EXISTS_RECONCILE'):
            self.preserve()
        self.assertEqual(sentinel.read_bytes(), b'synthetic preserved recovery key')
        self.assertEqual(list(operation.iterdir()), [sentinel])

    def test_post_copy_runtime_or_source_drift_preserves_cipher_key_without_success_receipt(self):
        self.host.drift_at = 3
        with self.assertRaisesRegex(cold.PreservationError, 'POST_COPY_RUNTIME_DRIFT'):
            self.preserve()
        operation = self.backup / cold.OPERATION_NAME
        self.assertTrue((operation / 'passphrase').is_file())
        self.assertTrue((operation / 'preservation.tar.gpg').is_file())
        self.assertFalse((operation / 'receipt.json').exists())

    def test_key_durability_failure_never_starts_archive(self):
        real_sync = cold.sync
        def reject_key(fd):
            if stat.S_ISREG(os.fstat(fd).st_mode):
                raise OSError('synthetic sync failure')
            return real_sync(fd)
        with patch.object(cold, 'sync', side_effect=reject_key), \
             patch.object(cold, 'make_encrypted_archive') as archive:
            with self.assertRaises(OSError):
                self.preserve()
            archive.assert_not_called()
        self.assertFalse((self.backup / cold.OPERATION_NAME / 'receipt.json').exists())

    def test_receipt_durability_failure_never_returns_success(self):
        real_sync = cold.sync
        def reject_receipt(fd):
            link = os.readlink('/proc/self/fd/' + str(fd))
            if link.endswith('/receipt.pending'):
                raise OSError('synthetic receipt sync failure')
            return real_sync(fd)
        with patch.object(cold, 'sync', side_effect=reject_receipt):
            with self.assertRaises(OSError):
                self.preserve()
        operation = self.backup / cold.OPERATION_NAME
        self.assertTrue((operation / 'passphrase').is_file())
        self.assertTrue((operation / 'preservation.tar.gpg').is_file())
        self.assertFalse((operation / 'receipt.json').exists())

    def test_host_postgres_probe_rejects_unknown_and_nonempty_output(self):
        for status, output in [(2, b''), (0, b'12\n'), (1, b'not-pids'), (0, b'1' * 16385)]:
            with self.subTest(status=status, output_length=len(output)):
                with patch.object(cold.subprocess, 'run', return_value=subprocess.CompletedProcess([], status, output)):
                    with self.assertRaises(cold.PreservationError):
                        cold.no_postgres_processes()
        with patch.object(cold.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, b'')):
            cold.no_postgres_processes()

    def test_publication_rejects_extra_fields_false_claims_bad_counts_and_transport(self):
        valid = valid_terminal()
        self.assertEqual(cold.validate_terminal(json.dumps(valid).encode(), SHA, '12345', 0), valid)
        mutations = [{'injected': 'SYNTHETIC_SECRET'}, {'targetSha': 'b' * 40}, {'runId': '999'},
                     {'runtimeRestored': True}, {'databaseIntegrity': 'VERIFIED'},
                     {'restoreVerification': 'PERFORMED'}, {'offHostRecovery': 'ESTABLISHED'},
                     {'sourceUnchanged': False}, {'entries': True}, {'entries': cold.MAX_ENTRIES + 1},
                     {'sourceBytes': cold.MAX_SOURCE_BYTES + 1}, {'volumes': 18},
                     {'ciphertextSha256': 'SECRET'}, {'ciphertextBytes': 0}]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                with self.assertRaises(cold.PreservationError):
                    cold.validate_terminal(json.dumps({**valid, **mutation}).encode(), SHA, '12345', 0)
        for status in (1, 2, 124, 255):
            with self.assertRaises(cold.PreservationError):
                cold.validate_terminal(json.dumps(valid).encode(), SHA, '12345', status)

    def test_retained_workflow_permissions_owner_gate_and_shared_queue(self):
        workflow, _ = workflow_step('Bind accepted exact main and evidence journal')
        global_part, jobs = workflow.split('\njobs:\n', 1)
        contract, recovery = jobs.split('\n  recover:\n', 1)
        self.assertNotIn('secrets.', global_part + contract)
        self.assertNotIn('issues: write', global_part + contract)
        self.assertNotIn('concurrency:', global_part + contract)
        for condition in ["github.event_name == 'issue_comment'", 'github.event.issue.number == 4637',
                          "github.event.comment.body == '/production inspect-stopped-configuration current-main'",
                          'github.event.comment.user.login == github.repository_owner',
                          "github.event.comment.author_association == 'OWNER'",
                          'github.actor == github.repository_owner',
                          'github.triggering_actor == github.repository_owner',
                          "needs.contract.result == 'success'"]:
            self.assertIn(condition, recovery)
        self.assertIn('group: production-full-stack-exact-sha\n      cancel-in-progress: false\n      queue: max', recovery)
        self.assertIn('ref: ${{ github.sha }}', recovery)
        self.assertNotIn('ref: main\n', recovery)

    def test_public_artifact_selects_only_three_bounded_receipts(self):
        workflow, _ = workflow_step('Bind accepted exact main and evidence journal')
        upload = workflow.split('      - uses: actions/upload-artifact@', 1)[1]
        self.assertIn('retention-days: 90', upload)
        block = upload.split('          path: |\n', 1)[1].split('\n          if-no-files-found:', 1)[0]
        paths = [line.strip() for line in block.splitlines()]
        wanted = {'target-sha.txt', 'issue-record.md', 'result.json'}
        self.assertEqual(paths, ['artifacts/production-cold-preservation/' + name
                                for name in ['target-sha.txt', 'issue-record.md', 'result.json']])
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            evidence = base / 'artifacts/production-cold-preservation'
            evidence.mkdir(parents=True)
            forbidden = {'passphrase', 'preservation.tar.gpg', 'manifest.json',
                         'remote-stderr.txt', 'ssh-key-fingerprint.txt', 'ssh-auth.txt',
                         'customer-records.json'}
            for name in wanted | forbidden:
                (evidence / name).write_text('synthetic fixture only')
            selected = {path.name for pattern in paths for path in base.glob(pattern)}
            self.assertEqual(selected, wanted)

    def test_retained_event_binding_rejects_stale_workflow_checkout_and_main(self):
        import sys
        _, source = workflow_step('Bind accepted exact main and evidence journal')
        prefix = source.split("python3 - <<'PY_BIND'\n", 1)[0]
        for override in ({}, {'GITHUB_WORKFLOW_SHA': 'b' * 40}, {'FIXTURE_HEAD': 'b' * 40},
                         {'FIXTURE_MAIN': 'b' * 40}, {'FIXTURE_API': 'b' * 40},
                         {'GITHUB_WORKFLOW_REF': 'fixture/repo/.github/workflows/wrong.yml@refs/heads/main'}):
            with self.subTest(override=override), tempfile.TemporaryDirectory() as name:
                root = Path(name)
                commands = root / 'bin'
                commands.mkdir()
                programs = {
                    'git': "import os,sys\na=sys.argv[1:]\nif a[0]=='fetch':sys.exit(0)\nif a==['rev-parse','HEAD']:print(os.environ['FIXTURE_HEAD'])\nelif a==['rev-parse','origin/main']:print(os.environ['FIXTURE_MAIN'])\nelse:sys.exit(9)\n",
                    'gh': "import os\nprint(os.environ['FIXTURE_API'])\n"}
                for command, code in programs.items():
                    path = commands / command
                    path.write_text('#!' + sys.executable + '\n' + code)
                    path.chmod(0o755)
                env = {**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH'],
                       'GITHUB_SHA': SHA, 'GITHUB_WORKFLOW_SHA': SHA, 'GITHUB_REPOSITORY': 'fixture/repo',
                       'GITHUB_WORKFLOW_REF': 'fixture/repo/.github/workflows/production-cold-preservation.yml@refs/heads/main',
                       'FIXTURE_HEAD': SHA, 'FIXTURE_MAIN': SHA, 'FIXTURE_API': SHA,
                       'EVIDENCE_DIR': str(root / 'evidence'), 'GITHUB_ENV': str(root / 'env'), **override}
                result = subprocess.run(['bash', '-ceu', prefix], cwd=root, env=env, capture_output=True)
                self.assertEqual(result.returncode == 0, not override)

    def test_retained_observer_fixture_is_exact_and_rejects_source_drift(self):
        path = Path(__file__).resolve().parent.parent / '.github/workflows/production-docker-headroom-diagnostic.yml'
        raw = path.read_bytes()
        retained = retained_inspector_workflow_bytes()
        self.assertEqual(len(retained), 191427)
        self.assertEqual(hashlib.sha256(retained).hexdigest(), '09ae88f0bfcf48b93e5f5dea5302d663d5dd5a709507503701014e4c17d27f5a')
        for changed in (bytes([raw[0] ^ 1]) + raw[1:], raw[:-1] + bytes([raw[-1] ^ 1]), raw[:-1], raw + b'\n'):
            with self.subTest(length=len(changed)), patch.object(Path, 'read_bytes', return_value=changed):
                with self.assertRaises(AssertionError):
                    retained_inspector_workflow_bytes()

    def test_retained_bash_transport_never_publishes_success_for_unknown_outcome(self):
        import sys
        _, source = workflow_step('Inspect only the accepted stopped configuration')
        vendor_fixture_bytes()
        valid = valid_configuration_terminal()
        failed = {'schemaVersion': 'pc.stopped-configuration.v2', 'passed': False,
                  'errorCode': 'CONFIG_INPUT_DRIFT', 'readOnly': True,
                  'runtimeRestored': False, 'startupAuthorized': False}
        cases = [(valid, 0, SHA, SHA, True),
                 ({**valid, 'savedApiDeclaredTarget': 'NOT_PROVEN'}, 0, SHA, SHA, True),
                 (valid, 255, SHA, SHA, False), (valid, 124, SHA, SHA, False),
                 (valid, 137, SHA, SHA, False), (valid, 1, SHA, SHA, False),
                 (valid, 0, 'b' * 40, SHA, False), (valid, 0, SHA, 'b' * 40, False),
                 (failed, 1, SHA, SHA, False), (failed, 0, SHA, SHA, False),
                 (None, 255, SHA, SHA, False), (b'\xff', 0, SHA, SHA, False),
                 (b' ' * 16385, 0, SHA, SHA, False),
                 (json.dumps(valid)[:-1] + ', "passed":true}', 0, SHA, SHA, False)]
        for change in ({'injected': 'SYNTHETIC_SECRET'}, {'targetSha': 'b' * 40}, {'runId': '54321'},
                       {'sourceRuntimeUnchanged': 1}, {'privateInputsUnchanged': False},
                       {'readOnly': False}, {'plaintextTransfer': True}, {'startupAuthorized': True},
                       {'runtimeRestored': True}, {'databaseIntegrity': 'FULL'}, {'fullComposeParity': 'FULL'},
                       {'canonicalApiBinding': 'VERIFIED'}, {'comparedServiceCount': True},
                       {'comparedServiceCount': 12}, {'missingServiceCount': -1},
                       {'comparedFields': []}, {'inputCoverage': {}}, {'composeVersion': '1.29.2'},
                       {'observedFieldsAgreement': 'MISMATCH'}, {'savedApiDeclaredTarget': 'LIVE'},
                       {'classification': 'RELEASE_ACCEPTED'}):
            cases.append(({**valid, **change}, 0, SHA, SHA, False))
        for value, status, post, api_post, success in cases:
            with self.subTest(status=status, post=post, api_post=api_post, success=success), tempfile.TemporaryDirectory() as name:
                root = Path(name)
                commands = root / 'bin'
                commands.mkdir()
                deps = {}
                for filename in ('production_cold_preservation.py', 'production_stopped_runtime_headroom.py'):
                    p = root / 'scripts' / filename
                    p.parent.mkdir(exist_ok=True)
                    p.write_bytes(Path(__file__).with_name(filename).read_bytes())
                    deps['scripts/' + filename] = hashlib.sha256(p.read_bytes()).hexdigest()
                diagnostic = root / '.github/workflows/production-docker-headroom-diagnostic.yml'
                diagnostic.parent.mkdir(parents=True)
                diagnostic.write_bytes(retained_inspector_workflow_bytes())
                state = root / 'docs/platform-v7/autopilot/autopilot-state.json'
                state.parent.mkdir(parents=True)
                state.write_text(json.dumps({'coordinationAdmissions': {'stopped-configuration-controller-20261024': {
                    'inspectionSha256': hashlib.sha256(diagnostic.read_bytes()).hexdigest(),
                    'composeParserVersion': '5.6.0', 'composeParserBytes': 32663526,
                    'composeParserSha256': '40343e21ca777173e69cff5dbafeb37c6f81f3b0d57d9e597f036e95eb63e76a'}}}))
                output = root / 'evidence'
                output.mkdir()
                fixture = root / 'output'
                data = b'' if value is None else (value if isinstance(value, bytes) else
                       (value.encode() if isinstance(value, str) else json.dumps(value).encode()))
                fixture.write_bytes(data)
                programs = {
                    'git': "import os,sys,pathlib\na=sys.argv[1:]\nroot=pathlib.Path(os.environ['FIXTURE_ROOT'])\nif a[0]=='fetch':sys.exit(0)\nif a==['rev-parse','origin/main']:print(os.environ['FIXTURE_POST'] if pathlib.Path(os.environ['FIXTURE_DONE']).exists() else os.environ['TARGET_SHA'])\nelif a[0]=='show':sys.stdout.buffer.write((root/a[1].split(':',1)[1]).read_bytes())\nelse:sys.exit(9)\n",
                    'gh': "import os,pathlib\nprint(os.environ['FIXTURE_API_POST'] if pathlib.Path(os.environ['FIXTURE_DONE']).exists() else os.environ['TARGET_SHA'])\n",
                    'ssh': "import os,sys,pathlib\nsys.stdin.buffer.read()\npathlib.Path(os.environ['FIXTURE_DONE']).touch()\nsys.stdout.buffer.write(pathlib.Path(os.environ['FIXTURE_OUTPUT']).read_bytes())\nsys.exit(int(os.environ['FIXTURE_STATUS']))\n"}
                for command, code in programs.items():
                    p = commands / command
                    p.write_text('#!' + sys.executable + '\n' + code)
                    p.chmod(0o755)
                env = {**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH'],
                       'TARGET_SHA': SHA, 'GITHUB_RUN_ID': '12345', 'GITHUB_REPOSITORY': 'fixture/repo',
                       'COMPOSE_PARSER_FILE': os.environ['PC_CROP_TEST_COMPOSE_BINARY'],
                       'EVIDENCE_DIR': str(output), 'SSH_USER_SECRET': 'fixture', 'PROD_HOST': '127.0.0.1', 'PROD_PORT': '1',
                       'FIXTURE_ROOT': str(root), 'FIXTURE_DONE': str(root / 'done'), 'FIXTURE_POST': post,
                       'FIXTURE_API_POST': api_post, 'FIXTURE_STATUS': str(status), 'FIXTURE_OUTPUT': str(fixture)}
                result = subprocess.run(['bash', '-ceu', source], cwd=root, env=env, capture_output=True, timeout=15)
                body = (output / 'issue-record.md').read_text()
                self.assertNotIn('SYNTHETIC_SECRET', body)
                self.assertEqual(result.returncode == 0, success, result.stderr.decode())
                if success:
                    self.assertNotIn(chr(96) + 'UNKNOWN' + chr(96), body)
                    self.assertEqual(json.loads((output / 'result.json').read_text()), value)
                else:
                    self.assertIn(chr(96) + 'UNKNOWN' + chr(96), body)
                    self.assertFalse((output / 'result.json').exists())

    def test_failed_step_publication_invalidates_a_surviving_positive_file(self):
        import sys
        workflow, source = workflow_step('Publish bounded terminal evidence')
        self.assertIn("steps.publish-evidence.outcome == 'success'", workflow)
        self.assertIn("env.EVIDENCE_INITIALIZED == '1'", workflow)
        for outcome in ('failure', 'cancelled', 'skipped'):
            with self.subTest(outcome=outcome), tempfile.TemporaryDirectory() as name:
                root = Path(name)
                output = root / 'evidence'
                output.mkdir()
                (output / 'result.json').write_text(json.dumps(valid_configuration_terminal()))
                (output / 'issue-record.md').write_text('SYNTHETIC_SECRET surviving positive report')
                commands = root / 'bin'
                commands.mkdir()
                gh = commands / 'gh'
                gh.write_text('#!' + sys.executable + '\nimport pathlib,sys\nprint(pathlib.Path(sys.argv[-1]).read_text())\n')
                gh.chmod(0o755)
                env = {**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH'],
                       'TARGET_SHA': SHA, 'EVIDENCE_DIR': str(output), 'EXECUTION_OUTCOME': outcome,
                       'GITHUB_REPOSITORY': 'fixture/repo'}
                result = subprocess.run(['bash', '-ceu', source], cwd=root, env=env, capture_output=True, timeout=10)
                self.assertEqual(result.returncode, 0, result.stderr.decode())
                self.assertFalse((output / 'result.json').exists())
                self.assertIn(b'UNKNOWN', result.stdout)
                self.assertNotIn(b'SYNTHETIC_SECRET', result.stdout)



class BindingPreservationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.filesystem = self.root / 'filesystem'
        self.configs = self.filesystem / 'etc'
        self.configs.mkdir(parents=True)
        self.docker = self.root / 'docker'
        (self.docker / 'containers').mkdir(parents=True)
        self.backup = self.root / 'backups'
        self.backup.mkdir(mode=0o700)
        self.old = self.backup / cold.OPERATION_NAME
        self.old.mkdir(mode=0o700)
        (self.old / 'passphrase').write_bytes(b'old key must remain unchanged')
        (self.old / 'preservation.tar.gpg').write_bytes(b'old ciphertext must remain unchanged')
        self.files = ['/etc/compose-%d.yml' % i for i in range(8)]
        self.binds = ['/etc/binding-%d' % i for i in range(8)]
        for name in self.files + self.binds:
            (self.filesystem / name[1:]).write_bytes(b'private fixture\0\xff: ' + name.encode())
        self.values = []
        for index in range(11):
            self.values.append({'ID': format(index + 1, '064x'), 'Image': 'sha256:' + 'd' * 64,
                                'MountPoints': ({'mount': {'Type': 'bind', 'RW': False,
                                                         'Source': self.binds[index]}}
                                                if index < 8 else {}),
                                'Config': {'Labels': ({'com.docker.compose.project.config_files': ','.join(self.files),
                                                      'com.docker.compose.project.working_dir': '/etc'}
                                                     if index == 0 else {})}})
        self.host = Host()
        self.write_records()
        for parent, directories, files in os.walk(self.filesystem):
            for name in directories + files:
                os.utime(Path(parent) / name, ns=(946684800123456789, 978307200123456789))
        self.original = {p.name: p.read_bytes() for p in self.old.iterdir()}

    def tearDown(self):
        self.temp.cleanup()

    def write_records(self):
        self.raw = [json.dumps(value, separators=(',', ':')).encode() for value in self.values]
        self.hashes = tuple((value['ID'], value['Image'], hashlib.sha256(raw).hexdigest())
                            for value, raw in zip(self.values, self.raw))
        for value, raw in zip(self.values, self.raw):
            parent = self.docker / 'containers' / value['ID']
            parent.mkdir(exist_ok=True)
            (parent / 'config.v2.json').write_bytes(raw)
        self.host.state = (self.hashes, (b'database',), (), frozenset(), frozenset())

    def preserve(self):
        return cold.preserve_bindings(self.host, SHA, '12345', source_root=str(self.docker),
                                      filesystem_root=str(self.filesystem), backup_root=str(self.backup),
                                      owner_uid=os.geteuid(), runtime_probe=lambda: None)

    def assert_no_new_operation(self):
        self.assertEqual(list(self.backup.iterdir()), [self.old])
        self.assertEqual(self.original, {p.name: p.read_bytes() for p in self.old.iterdir()})

    def test_retained_binding_archive_roundtrip_preserves_all_sources_and_old_key(self):
        paths, compose = cold.configuration_paths(self.raw, self.hashes)
        with cold.ConfigurationSnapshot(str(self.filesystem), paths, compose,
                                         owner_uid=os.geteuid()) as before:
            before.capture()
            entries = copy.deepcopy(before.entries)
        result = self.preserve()
        with cold.ConfigurationSnapshot(str(self.filesystem), paths, compose,
                                         owner_uid=os.geteuid()) as after:
            after.capture()
            self.assertEqual(entries, after.entries)
        self.assertEqual(cold.validate_bindings_terminal(json.dumps(result).encode(), SHA, '12345', 0), result)
        self.assertEqual(self.host.calls, 3)
        self.assertEqual(result['selectedRoots'], 16)
        self.assertEqual(result['bindReferences'], result['composeFiles'])
        self.assertFalse(result['startupAuthorized'])
        self.assertFalse(result['environmentFilesCovered'])
        operation = self.backup / cold.BINDINGS_OPERATION
        self.assertEqual(result, json.loads((operation / 'receipt.json').read_bytes()))
        self.assertEqual(self.original, {p.name: p.read_bytes() for p in self.old.iterdir()})
        self.assertNotIn('private fixture', json.dumps(result))
        for p in operation.iterdir():
            if p.is_file():
                self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o600)
        with self.assertRaisesRegex(cold.PreservationError, 'OPERATION_ALREADY_EXISTS_RECONCILE'):
            self.preserve()

    def test_record_and_selection_drift_rejected_before_writes(self):
        for mutate in (
                lambda v: v[0]['MountPoints']['mount'].update(RW=True),
                lambda v: v[0]['MountPoints']['mount'].update(Type='unexpected'),
                lambda v: v[0]['MountPoints']['mount'].update(Source='/etc/../private'),
                lambda v: v[0]['MountPoints']['mount'].update(Source='/etc/bad\0name'),
                lambda v: v[0]['MountPoints']['mount'].update(Source='/var'),
                lambda v: v[0]['MountPoints']['mount'].update(Source='/var/run/docker.sock'),
                lambda v: v[0]['MountPoints']['mount'].update(Source='/etc'),
                lambda v: v[0]['Config']['Labels'].update({'com.docker.compose.project.config_files': ','.join(self.files[:7])}),
                lambda v: v[0]['Config']['Labels'].update({'com.docker.compose.project.config_files': ','.join(self.files + ['/etc/ninth.yml'])}),
                lambda v: v[0]['MountPoints'].clear()):
            with self.subTest(mutate=mutate):
                values = copy.deepcopy(self.values)
                mutate(values)
                raw = [json.dumps(v).encode() for v in values]
                hashes = [(v['ID'], v['Image'], hashlib.sha256(r).hexdigest()) for v, r in zip(values, raw)]
                with self.assertRaises(cold.PreservationError):
                    cold.configuration_paths(raw, hashes)
                self.assert_no_new_operation()
        with self.assertRaisesRegex(cold.PreservationError, 'CONFIG_RECORD_DRIFT'):
            cold.configuration_paths([b' ' + self.raw[0], *self.raw[1:]], self.hashes)

    def test_relative_compose_names_resolve_without_reading_or_guessing_dotenv(self):
        self.values[0]['Config']['Labels']['com.docker.compose.project.config_files'] = ','.join(
            name.rsplit('/', 1)[1] for name in self.files)
        self.write_records()
        paths, compose = cold.configuration_paths(self.raw, self.hashes)
        self.assertEqual(compose, frozenset(self.files))
        self.assertEqual(set(paths), set(self.files + self.binds))

    def test_file_link_special_mode_and_parent_link_block_before_write(self):
        target = self.filesystem / self.binds[0][1:]
        old = target.read_bytes()
        for kind in ('symlink', 'fifo', 'writable'):
            with self.subTest(kind=kind):
                target.unlink()
                if kind == 'symlink':
                    target.symlink_to(self.configs / 'compose-0.yml')
                elif kind == 'fifo':
                    os.mkfifo(target)
                else:
                    target.write_bytes(old)
                    target.chmod(0o666)
                with self.assertRaises(cold.PreservationError):
                    self.preserve()
                self.assert_no_new_operation()
        target.unlink()
        target.write_bytes(old)
        self.configs.rename(self.filesystem / 'elsewhere')
        self.configs.symlink_to(self.filesystem / 'elsewhere', target_is_directory=True)
        with self.assertRaises(OSError):
            self.preserve()
        self.assert_no_new_operation()

    def test_complete_bounds_and_runtime_drift_reject_before_writes(self):
        for attribute, value in (('entry_limit', 1), ('source_limit', 1), ('path_limit', 1), ('manifest_limit', 1)):
            with self.subTest(attribute=attribute), patch.object(cold.ConfigurationSnapshot, attribute, value):
                with self.assertRaises(cold.PreservationError):
                    self.preserve()
                self.assert_no_new_operation()
        self.host.drift_at = self.host.calls + 2
        with self.assertRaisesRegex(cold.PreservationError, 'PRE_WRITE_RUNTIME_DRIFT'):
            self.preserve()
        self.assert_no_new_operation()

    def test_post_copy_failure_retains_new_ciphertext_and_key_without_success(self):
        self.host.drift_at = 3
        with self.assertRaisesRegex(cold.PreservationError, 'POST_COPY_RUNTIME_DRIFT'):
            self.preserve()
        operation = self.backup / cold.BINDINGS_OPERATION
        self.assertTrue((operation / 'passphrase').is_file())
        self.assertTrue((operation / 'preservation.tar.gpg').is_file())
        self.assertFalse((operation / 'receipt.json').exists())
        self.assertEqual(self.original, {p.name: p.read_bytes() for p in self.old.iterdir()})

    def test_closed_binding_publication_rejects_forged_transport_and_authority(self):
        value = valid_bindings_terminal()
        for update in ({'startupAuthorized': True}, {'environmentFilesCovered': True},
                       {'databaseIntegrity': 'PASS'}, {'currentComposeParity': 'PASS'},
                       {'bindReferences': 7}, {'composeFiles': 9}, {'selectedRoots': True},
                       {'entries': cold.BINDINGS_ENTRIES + 1}, {'sourceBytes': cold.BINDINGS_SOURCE_BYTES + 1},
                       {'ciphertextBytes': cold.BINDINGS_ARCHIVE_BYTES + 1}, {'secret': 'NEVER_PUBLISH'},
                       {'targetSha': 'b' * 40}, {'runId': '2'}):
            with self.subTest(update=update), self.assertRaises(cold.PreservationError):
                cold.validate_bindings_terminal(json.dumps({**value, **update}).encode(), SHA, '12345', 0)
        for status in (1, 255):
            with self.assertRaises(cold.PreservationError):
                cold.validate_bindings_terminal(json.dumps(value).encode(), SHA, '12345', status)
        duplicated = json.dumps(value)[:-1] + ', "passed": true}'
        with self.assertRaisesRegex(cold.PreservationError, 'OUTPUT_DUPLICATE'):
            cold.validate_bindings_terminal(duplicated.encode(), SHA, '12345', 0)

    def test_short_space_or_failed_key_sync_cannot_start_an_archive(self):
        from types import SimpleNamespace
        with patch.object(cold.os, 'fstatvfs', return_value=SimpleNamespace(f_bavail=1, f_frsize=4096)):
            with self.assertRaisesRegex(cold.PreservationError, 'PRESERVATION_SPACE_INSUFFICIENT'):
                self.preserve()
        self.assert_no_new_operation()
        real_sync = cold.sync
        def refuse_key(fd):
            if os.readlink('/proc/self/fd/' + str(fd)).endswith('/passphrase'):
                raise OSError('fixture only')
            real_sync(fd)
        with patch.object(cold, 'sync', side_effect=refuse_key), patch.object(cold, 'make_encrypted_archive') as archive:
            with self.assertRaises(OSError):
                self.preserve()
            archive.assert_not_called()
        self.assertFalse((self.backup / cold.BINDINGS_OPERATION / 'receipt.json').exists())
        self.assertEqual(self.original, {p.name: p.read_bytes() for p in self.old.iterdir()})

    def test_changed_binding_after_encryption_never_receives_a_success_receipt(self):
        real_archive = cold.make_encrypted_archive
        def change(*args):
            result = real_archive(*args)
            (self.filesystem / self.binds[0][1:]).write_bytes(b'fixture changed after archive')
            return result
        with patch.object(cold, 'make_encrypted_archive', side_effect=change):
            with self.assertRaisesRegex(cold.PreservationError, 'POST_COPY_SOURCE_DRIFT'):
                self.preserve()
        operation = self.backup / cold.BINDINGS_OPERATION
        self.assertTrue((operation / 'preservation.tar.gpg').is_file())
        self.assertFalse((operation / 'receipt.json').exists())

    def test_retained_owner_binding_route_disables_the_spent_original_command(self):
        import ast
        import re
        from types import SimpleNamespace as NS
        workflow, _ = workflow_step('Bind accepted exact main and evidence journal')
        conditions = []
        for job in ('contract', 'recover'):
            block = workflow.split('\n  ' + job + ':\n', 1)[1].split('\n    runs-on:', 1)[0]
            expression = ' '.join(re.search(r'\n    if: >-\n((?:      [^\n]*\n)+)', '\n' + block + '\n')[1].split())
            conditions.append(compile(ast.parse(expression.replace('&&', ' and ').replace('||', ' or '), mode='eval'), '<route>', 'eval'))
        def route(event='issue_comment', issue=4637, body='/production inspect-stopped-configuration current-main',
                  author='owner', actor='owner', triggering='owner', association='OWNER', result='success'):
            context = {'github': NS(event_name=event, repository_owner='owner', actor=actor, triggering_actor=triggering,
                                    event=NS(issue=NS(number=issue), comment=NS(body=body, author_association=association,
                                                                            user=NS(login=author)))),
                       'needs': NS(contract=NS(result=result))}
            return tuple(bool(eval(expression, {'__builtins__': {}}, context)) for expression in conditions)
        self.assertEqual(route(), (True, True))
        self.assertEqual(route(event='pull_request'), (True, False))
        for update in ({'event': 'push'}, {'issue': 5469}, {'body': '/production preserve-stopped-data current-main'},
                       {'body': '/production preserve-stopped-bindings current-main'},
                       {'body': '/production validate-stopped-pg16 current-main'},
                       {'body': '/production inspect-stopped-configuration current-main\n'}):
            self.assertEqual(route(**update), (False, False))
        for update in ({'author': 'other'}, {'actor': 'other'}, {'triggering': 'other'}, {'association': 'NONE'},
                       {'result': 'failure'}, {'result': 'skipped'}):
            self.assertEqual(route(**update), (True, False))

    def test_retained_source_binding_rejects_missing_pins_wrong_operation_and_payload_drift(self):
        import sys
        workflow, _ = workflow_step('Bind accepted exact main and evidence journal')
        code = textwrap.dedent(workflow.split("          python3 - <<'PY_BIND'\n", 1)[1].split('          PY_BIND', 1)[0])
        names = ['.github/workflows/production-cold-preservation.yml',
                 'scripts/test_production_cold_preservation.py', 'docs/ops/production-cold-preservation.md']
        dependencies = ['scripts/production_stopped_runtime_headroom.py', 'scripts/production_cold_preservation.py']
        inspector = '.github/workflows/production-docker-headroom-diagnostic.yml'
        engine_names = ['scripts/release/ir20-restore-drill.sh', 'scripts/release/test-ir20-restore-drill.py',
                        'scripts/release/test-ir20-restore-drill-integration.sh', '.github/workflows/ir20-restore-drill.yml',
                        'docs/ops/ir20-isolated-restore.md', 'docs/platform-v7/autopilot/scopes/ir20-isolated-restore-20260919.json']
        source_vector = ['scripts/production_cold_preservation.py', 'scripts/test_production_cold_preservation.py',
                         '.github/workflows/production-cold-preservation.yml', 'docs/ops/production-cold-preservation.md',
                         'scripts/test_production_stopped_runtime_headroom.py']
        base = Path(__file__).resolve().parent.parent
        alterations = ('none', 'missing', 'owner', 'operation', 'decision', 'invocation', 'acceptance', 'startup',
                       'vector', 'hash', 'mode', 'link', 'dependency', 'ancestry', 'extra', 'controller-scope',
                       'engine-missing', 'engine-grant', 'engine-scope', 'engine-vector', 'engine-hash',
                       'engine-extra', 'duplicate', 'readonly', 'inspector-hash', 'inspector-drift', 'inspector-mode', 'parser-version', 'parser-size', 'parser-hash')
        for alteration in alterations:
            with self.subTest(alteration=alteration), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                for name in names + dependencies + [inspector]:
                    p = root / name
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_bytes(retained_inspector_workflow_bytes() if name == inspector else (base / name).read_bytes())
                    p.chmod(0o644)
                engine_pins = []
                for i, name in enumerate(engine_names):
                    p = root / name
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_bytes(('synthetic binding-only payload %d\n' % i).encode())
                    p.chmod(0o755 if i < 3 else 0o644)
                    engine_pins.append({'path': name, 'mode': '100755' if i < 3 else '100644',
                                        'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
                purpose = {
                    'owner': 'ACCOUNT_1_CORE', 'sourceBranch': 'ops/production-cold-preservation-20261022',
                    'authorityBaseExactMain': SHA, 'ownerDecision': '#5469#issuecomment-6381707914',
                    'operationName': 'stopped-configuration-20261024', 'configurationObservationAuthorized': True,
                    'readOnly': True, 'inspectionSha256': hashlib.sha256((root / inspector).read_bytes()).hexdigest(),
                    'composeParserVersion': '5.6.0', 'composeParserBytes': 32663526,
                    'composeParserSha256': '40343e21ca777173e69cff5dbafeb37c6f81f3b0d57d9e597f036e95eb63e76a',
                    'productionAcceptance': False, 'originalStartupAuthorized': False,
                    'sourcePins': [{'path': name, 'mode': '100644', 'sha256': hashlib.sha256((root / name).read_bytes()).hexdigest()}
                                   for name in names],
                    'limits': 'One serialized read-only observation with pinned public Compose parser in sealed memory; no startup, private transfer, install or new cost.'}
                engine = {
                    'authorityBaseExactMain': SHA,
                    'dependencySha256': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in dependencies},
                    'limits': 'Six-path source-only stopped PG16 volatile-copy prerequisite. No host dispatch, original startup, transfer or new cost.',
                    'owner': 'ACCOUNT_1_CORE', 'ownerDecision': '#5469#issuecomment-6354447020',
                    'productionAcceptance': False, 'productionInvocationAuthorized': False,
                    'sourceBranch': 'ops/ir20-isolated-restore-20260919', 'sourcePins': engine_pins,
                    'writerHandoff': '#5469#issuecomment-6368785509'}
                state_value = {'coordinationAdmissions': {'stopped-configuration-controller-20261024': purpose,
                                                         'ir20-stopped-copy-source-20261023': engine},
                               'approvedConcurrentScopes': {purpose['sourceBranch']: source_vector,
                                                            engine['sourceBranch']: engine_names}}
                if alteration == 'missing': del state_value['coordinationAdmissions']['stopped-configuration-controller-20261024']
                if alteration == 'owner': purpose['owner'] = 'OTHER'
                if alteration == 'operation': purpose['operationName'] = cold.BINDINGS_OPERATION
                if alteration == 'decision': purpose['ownerDecision'] = 'candidate-owned'
                if alteration == 'invocation': purpose['configurationObservationAuthorized'] = False
                if alteration == 'acceptance': purpose['productionAcceptance'] = True
                if alteration == 'startup': purpose['originalStartupAuthorized'] = True
                if alteration == 'vector': purpose['sourcePins'].append(dict(purpose['sourcePins'][0]))
                if alteration == 'hash': (root / names[0]).write_bytes(b'unadmitted controller')
                if alteration == 'mode': (root / names[0]).chmod(0o755)
                if alteration == 'link':
                    (root / names[0]).unlink()
                    (root / names[0]).symlink_to(base / names[0])
                if alteration == 'dependency': (root / dependencies[0]).write_bytes(b'changed helper')
                if alteration == 'parser-version': purpose['composeParserVersion'] = '2.39.1'
                if alteration == 'parser-size': purpose['composeParserBytes'] = True
                if alteration == 'parser-hash': purpose['composeParserSha256'] = 'b' * 64
                if alteration == 'readonly': purpose['readOnly'] = False
                if alteration == 'inspector-hash': purpose['inspectionSha256'] = 'b' * 64
                if alteration == 'inspector-drift': (root / inspector).write_bytes(b'changed inspector')
                if alteration == 'inspector-mode': (root / inspector).chmod(0o755)
                if alteration == 'extra': purpose['additionalAuthority'] = False
                if alteration == 'controller-scope': state_value['approvedConcurrentScopes'][purpose['sourceBranch']] = source_vector + ['extra']
                if alteration == 'engine-missing': del state_value['coordinationAdmissions']['ir20-stopped-copy-source-20261023']
                if alteration == 'engine-grant': engine['productionInvocationAuthorized'] = True
                if alteration == 'engine-scope': state_value['approvedConcurrentScopes'][engine['sourceBranch']] = engine_names + ['extra']
                if alteration == 'engine-vector': engine['sourcePins'].reverse()
                if alteration == 'engine-hash': (root / engine_names[0]).write_bytes(b'changed engine')
                if alteration == 'engine-extra': engine['additionalAuthority'] = False
                state = root / 'docs/platform-v7/autopilot/autopilot-state.json'
                state.parent.mkdir(parents=True, exist_ok=True)
                raw = json.dumps(state_value)
                if alteration == 'duplicate':
                    raw = raw.replace('"owner": "ACCOUNT_1_CORE"', '"owner": "ACCOUNT_1_CORE", "owner": "OTHER"', 1)
                state.write_text(raw)
                commands = root / 'bin'
                commands.mkdir()
                git = commands / 'git'
                git.write_text('#!' + sys.executable + '\nimport sys\nsys.exit(' + ('1' if alteration == 'ancestry' else '0') + ')\n')
                git.chmod(0o755)
                result = subprocess.run([sys.executable, '-I', '-c', code], cwd=root, capture_output=True, timeout=10,
                                        env={**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH']})
                self.assertEqual(result.returncode == 0, alteration == 'none', result.stderr.decode())



class ConfigurationObservationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profile = embedded_configuration_profile()

    class DirectorySource:
        def open_directory(self, path):
            return os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_NOATIME)

    def test_private_inputs_keep_atime_seal_memory_and_reject_replaced_sources(self):
        import fcntl
        p = self.profile
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'private.env'
            path.write_bytes(b'SYNTHETIC_SECRET=private\n')
            path.chmod(0o600)
            os.utime(path, ns=(946684800000000000, 978307200000000000))
            before = path.stat()
            inputs = p.PrivateInputs(self.DirectorySource(), os.getuid())
            try:
                raw = inputs.read(str(path))
                memory = inputs.stage(raw)
                fd = int(memory.rsplit('/', 1)[1])
                self.assertEqual(fcntl.fcntl(fd, p.GET_SEALS) & p.INPUT_SEALS, p.INPUT_SEALS)
                with self.assertRaises(OSError):
                    os.write(fd, b'changed')
                self.assertEqual(path.stat().st_atime_ns, before.st_atime_ns)
                inputs.recheck()
                path.unlink()
                path.write_bytes(raw)
                path.chmod(0o600)
                with self.assertRaisesRegex(p.ConfigurationError, 'CONFIG_INPUT_DRIFT'):
                    inputs.recheck()
            finally:
                original_fds = [x[0] for x in inputs.originals] + inputs.memory
                inputs.close()
            for fd in original_fds:
                with self.assertRaises(OSError):
                    os.fstat(fd)

    def test_private_input_links_modes_sizes_optional_absence_and_total_bound(self):
        p = self.profile
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'private'
            inputs = p.PrivateInputs(self.DirectorySource(), os.getuid())
            try:
                self.assertIsNone(inputs.read(str(path), optional=True))
                path.symlink_to('/etc/passwd')
                with self.assertRaisesRegex(p.ConfigurationError, 'CONFIG_INPUT_DRIFT'):
                    inputs.recheck()
                with self.assertRaises(OSError): inputs.read(str(path))
                path.unlink()
                os.mkfifo(path, 0o600)
                with self.assertRaisesRegex(p.ConfigurationError, 'CONFIG_INPUT_PROFILE'):
                    inputs.read(str(path))
                path.unlink()
                path.write_bytes(b'fixture')
                path.chmod(0o666)
                with self.assertRaisesRegex(p.ConfigurationError, 'CONFIG_INPUT_PROFILE'):
                    inputs.read(str(path))
                path.chmod(0o600)
                parent = Path(directory) / 'unsafe-parent'
                parent.mkdir()
                nested = parent / 'private'
                nested.write_bytes(b'fixture')
                nested.chmod(0o600)
                parent.chmod(0o777)
                with self.assertRaisesRegex(p.ConfigurationError, 'CONFIG_DIRECTORY_PROFILE'):
                    inputs.read(str(nested))
                parent.chmod(0o700)
                inputs.total = 8 * 1024 * 1024
                with self.assertRaisesRegex(p.ConfigurationError, 'CONFIG_INPUT_BOUND'):
                    inputs.read(str(path))
                inputs.total = 0
                with path.open('wb') as handle: handle.truncate(1024 * 1024 + 1)
                with self.assertRaisesRegex(p.ConfigurationError, 'CONFIG_INPUT_PROFILE'):
                    inputs.read(str(path))
                for forbidden in ('/proc/self/environ', '/sys/x', '/dev/x', '/run/docker.sock',
                                  '/var/lib/docker/private', '/var/lib/pc-release-authority/key',
                                  str(path.parent / '..' / path.name)):
                    with self.assertRaisesRegex(p.ConfigurationError, 'CONFIG_PATH_PROFILE'):
                        inputs.read(forbidden)
            finally:
                inputs.close()

    def test_unexpected_private_exception_is_redacted_at_the_actual_entrypoint(self):
        import contextlib
        p = self.profile
        class Source:
            def inspect(self, *args):
                raise ValueError('SYNTHETIC_SECRET /protected/private/path')
        output = io.StringIO()
        # Inject at the operation boundary; do not bypass or weaken its root
        # gate merely to reach the unexpected-exception redaction branch.
        with contextlib.redirect_stdout(output), patch.object(p.signal, 'signal'), \
                patch.object(p, 'observe_configuration', side_effect=ValueError('SYNTHETIC_SECRET /protected/private/path')):
            status = p.configuration_main([SHA, '12345'], Source(), vendor_fixture_bytes())
        self.assertEqual(status, 1)
        value = json.loads(output.getvalue())
        self.assertEqual(value, {'schemaVersion': 'pc.stopped-configuration.v2', 'passed': False,
                                'errorCode': 'CONFIG_OBSERVATION_UNAVAILABLE', 'readOnly': True,
                                'runtimeRestored': False, 'startupAuthorized': False})
        self.assertNotIn('SYNTHETIC_SECRET', output.getvalue())

    def test_verified_parser_never_weakens_root_gate_and_corrupt_bytes_never_execute(self):
        import contextlib
        p = self.profile
        raw = vendor_fixture_bytes()
        class Source:
            def inspect(self, *args): raise AssertionError('no private observation before root verification')
        output = io.StringIO()
        with contextlib.redirect_stdout(output), patch.object(p.signal, 'signal'), \
                patch.object(p.os, 'getuid', return_value=1), patch.object(p.os, 'geteuid', return_value=1):
            self.assertEqual(p.configuration_main([SHA, '12345'], Source(), raw), 1)
        self.assertEqual(json.loads(output.getvalue())['errorCode'], 'OPERATOR_SOURCE_IDENTITY')
        inputs = p.PrivateInputs(self.DirectorySource(), os.getuid())
        try:
            for invalid in (b'', raw[:-1], bytes([raw[0] ^ 1]) + raw[1:]):
                with self.assertRaisesRegex(p.ConfigurationError, 'COMPOSE_PARSER_IDENTITY'):
                    inputs.stage(invalid, parser=True)
            self.assertEqual(inputs.memory, [])
        finally:
            inputs.close()

    def test_external_yaml_sources_are_rejected_before_compose_can_resolve_them(self):
        p = self.profile
        for raw in (b'include: https://example.invalid/config.yml',
                    b'{services: {api: {extends: remote.yml}}}',
                    b'"include": remote.yml', b"'configs': {}", b'? include\n: remote.yml',
                    b'&key include: remote.yml', b'*key: remote.yml', b'!str include: remote.yml',
                    b'"incl\\u0075de": remote.yml', b'"incl\\x75de": remote.yml',
                    b'"incl\\U00000075de": remote.yml', b'"incl\\\nude": remote.yml',
                    b'services:\n  api:\n    label_file: private', b'provider: {}'):
            with self.subTest(raw=raw), self.assertRaises(p.ConfigurationError):
                p.reject_external_profile(raw)
        p.reject_external_profile(b'services:\n  api:\n    environment:\n      AI_PROVIDER: local\n    ports: !reset []\n')

    def test_real_process_bounds_cleanup_and_private_stderr(self):
        p = self.profile
        self.assertEqual(p.render_command([sys.executable, '-c', 'print("fixture")'], []), b'fixture\n')
        for program, expected in (("import sys;sys.stderr.write('SYNTHETIC_SECRET');sys.exit(3)", 'COMPOSE_RENDER_FAILED'),
                                  ("import sys;sys.stdout.write('x'*2097153)", 'COMPOSE_RENDER_OUTPUT_BOUND'),
                                  ("import sys;sys.stderr.write('x'*65537)", 'COMPOSE_RENDER_OUTPUT_BOUND'),
                                  ("import time;time.sleep(5)", 'COMPOSE_RENDER_TIMEOUT')):
            started = time.monotonic()
            with self.subTest(expected=expected), self.assertRaisesRegex(p.ConfigurationError, expected) as error:
                p.render_command([sys.executable, '-c', program], [], timeout=0.4)
            self.assertLess(time.monotonic() - started, 3)
            self.assertNotIn('SYNTHETIC_SECRET', str(error.exception))
        program = "import os,time;pid=os.fork();print(pid,flush=True) if pid else time.sleep(30)"
        with self.assertRaisesRegex(p.ConfigurationError, 'COMPOSE_RENDER_TIMEOUT'):
            p.render_command([sys.executable, '-c', program], [], timeout=0.4)
        # The whole owned process group is killed even when the parent has
        # exited but a descendant still holds the captured pipes open.
        program = ("import os,time;pid=os.fork();"
                   "print(pid,flush=True) if pid else (os.close(1),os.close(2),time.sleep(30))")
        child = int(p.render_command([sys.executable, '-c', program], [], timeout=1))
        deadline = time.monotonic() + 1
        while True:
            try:
                state = Path('/proc/' + str(child) + '/stat').read_text().split(') ', 1)[1].split()[0]
            except FileNotFoundError:
                break
            if state == 'Z':
                break
            self.assertLess(time.monotonic(), deadline, 'owned descendant survived cleanup')
            time.sleep(0.01)

    def test_closed_terminal_rejects_false_match_unknown_keys_and_false_authority(self):
        _, shell = workflow_step('Inspect only the accepted stopped configuration')
        code = shell.split("<<'PY_RECORD'\n", 1)[1].split('\nPY_RECORD\n', 1)[0]
        module = types.ModuleType('terminal_fixture')
        exec(compile(code.split('\nimport pathlib, sys\n', 1)[0], '<actual-terminal>', 'exec'), module.__dict__)
        validate = lambda value, status='0': module.validate_terminal(json.dumps(value).encode(), SHA, '12345', status)
        good = valid_configuration_terminal()
        self.assertEqual(validate(good), good)
        for count in (20, 176):
            repeated = copy.deepcopy(good)
            repeated['inputCoverage']['composeFiles'] = count
            self.assertEqual(validate(repeated), repeated)
        for count in (0, 177, True):
            invalid = copy.deepcopy(good)
            invalid['inputCoverage']['composeFiles'] = count
            with self.subTest(ordered_reference_count=count), self.assertRaises(ValueError):
                validate(invalid)
        mismatch = copy.deepcopy(good)
        mismatch['mismatchCounts']['image'] = 1
        mismatch['serviceDispositions'][0]['mismatchFields'] = ['image']
        mismatch['observedFieldsAgreement'] = 'MISMATCH'
        self.assertEqual(validate(mismatch), mismatch)
        unproved = copy.deepcopy(good)
        unproved['unprovedCounts']['environment'] = 3
        for row in unproved['serviceDispositions']:
            row['unprovedFields'] = ['environment']
        unproved['observedFieldsAgreement'] = 'UNPROVEN'
        self.assertEqual(validate(unproved), unproved)
        for update in ({'observedFieldsAgreement': 'MATCH'}, {'unprovedCounts': dict.fromkeys(CONFIG_FIELDS, True)},
                       {'startupAuthorized': True}, {'plaintextTransfer': True}, {'privatePath': 'SYNTHETIC_SECRET'}):
            with self.subTest(update=update), self.assertRaises(ValueError):
                validate({**unproved, **update})
        with self.assertRaises(ValueError): validate(good, '255')
        with self.assertRaises(ValueError): module.validate_terminal(b'{"passed":true,"passed":false}', SHA, '12345', '0')

    def test_role_dispositions_redact_unknown_names_and_validate_aggregate_binding(self):
        p = self.profile
        flags = dict.fromkeys(CONFIG_FIELDS, True)
        flags['networkNames'] = False
        flags['environment'] = None
        row = p.disposition_row('api', 'COMPARED', flags)
        self.assertEqual(row, {'roleClass': 'api', 'disposition': 'COMPARED',
                               'mismatchFields': ['networkNames'], 'unprovedFields': ['environment']})
        self.assertEqual(p.disposition_row('SYNTHETIC_SECRET', 'EXTRA'),
                         {'roleClass': 'OTHER', 'disposition': 'EXTRA', 'mismatchFields': [], 'unprovedFields': []})
        _, shell = workflow_step('Inspect only the accepted stopped configuration')
        code = shell.split("<<'PY_RECORD'\n", 1)[1].split('\nPY_RECORD\n', 1)[0]
        module = types.ModuleType('terminal_dispositions')
        exec(compile(code.split('\nimport pathlib, sys\n', 1)[0], '<actual-terminal>', 'exec'), module.__dict__)
        def validate(value):
            return module.validate_terminal(json.dumps(value).encode(), SHA, '12345', '0')
        good = valid_configuration_terminal()
        for mutation in ('private-role', 'private-key', 'unknown-field', 'duplicate-field', 'overlap',
                         'duplicate-role', 'missing-row', 'bad-schema', 'false-aggregate', 'wrong-disposition'):
            value = copy.deepcopy(good)
            row = value['serviceDispositions'][0]
            if mutation == 'private-role': row['roleClass'] = 'SYNTHETIC_SECRET'
            if mutation == 'private-key': row['networkName'] = 'SYNTHETIC_SECRET'
            if mutation == 'unknown-field': row['mismatchFields'] = ['SYNTHETIC_SECRET']
            if mutation == 'duplicate-field': row['mismatchFields'] = ['image', 'image']
            if mutation == 'overlap': row['mismatchFields'] = row['unprovedFields'] = ['image']
            if mutation == 'duplicate-role': row['roleClass'] = 'web'
            if mutation == 'missing-row': value['serviceDispositions'].pop()
            if mutation == 'bad-schema': value['schemaVersion'] = 'pc.stopped-configuration.v1'
            if mutation == 'false-aggregate': value['mismatchCounts']['image'] = 1
            if mutation == 'wrong-disposition': row['disposition'] = 'EXTRA'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate(value)

    def test_ordered_compose_references_reuse_snapshots_and_keep_bounds(self):
        p = self.profile
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first, second = root / 'first.yaml', root / 'second.yaml'
            for file in (first, second):
                file.write_text('services: {api: {image: fixture:1}, web: {image: fixture:1}}\n')
                file.chmod(0o600)
                os.utime(file, ns=(946684800000000000, 978307200000000000))
            before = {str(file): p.file_token(file.stat()) for file in (first, second)}
            shared = {'com.docker.compose.project': 'fixture',
                      'com.docker.compose.project.working_dir': directory,
                      'com.docker.compose.project.config_files': ','.join([str(first), str(second), str(first)] + [str(second)] * 173)}
            records = [{'Config': {'Labels': {**shared, 'com.docker.compose.service': role}}}
                       for role in ('api', 'web')]
            model = {'name': 'fixture', 'services': {'api': {'image': 'fixture:1'}, 'web': {'image': 'fixture:1'}}}
            calls = []
            def runner(argv, descriptors):
                calls.append(list(argv))
                return json.dumps(model).encode()
            inputs = p.PrivateInputs(None, os.getuid())
            try:
                report = p.render_model(None, records, inputs, runner, '/sealed-parser')
                actual = [calls[0][i + 1] for i, word in enumerate(calls[0]) if word == '--file']
                self.assertEqual(len(actual), 176)
                self.assertEqual(actual[0], actual[2])
                self.assertEqual(actual[1], actual[-1])
                self.assertNotEqual(actual[0], actual[1])
                self.assertEqual(len(inputs.originals), 2)
                self.assertEqual(report[3]['composeFiles'], 176)
                inputs.recheck()
                self.assertEqual({str(file): p.file_token(file.stat()) for file in (first, second)}, before)
            finally:
                inputs.close()
            for invalid in (','.join([str(first)] * 177), ','.join(str(root / str(i)) for i in range(17)),
                            str(first) + ',', '', None, str(first) + ',' + str(root / '..' / root.name / 'first.yaml'),
                            str(first) + ',' + str(first) + '\0', 'x' * 8193):
                candidate = copy.deepcopy(records)
                for record in candidate:
                    record['Config']['Labels']['com.docker.compose.project.config_files'] = invalid
                inputs = p.PrivateInputs(None, os.getuid())
                try:
                    with self.subTest(invalid_type=type(invalid).__name__), self.assertRaises(p.ConfigurationError):
                        p.render_model(None, candidate, inputs, runner, '/sealed-parser')
                finally:
                    inputs.close()

    def test_native_compose_resolves_sealed_files_and_actual_environment_without_source_writes(self):
        p = self.profile
        binary_raw = vendor_fixture_bytes()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config, override = root / 'compose.yaml', root / 'override.yaml'
            middle = root / 'middle.yaml'
            config.write_text('''services:
  api:
    image: fixture-api:1
    env_file:
      - path: api.env
      - path: raw.env
        format: raw
      - path: absent.env
        required: false
    environment:
      TOP: ${TOP}
      EXPLICIT: override
      DOLLAR: $$literal
    command: ["app", "$$ARG"]
  web:
    image: fixture-web:1
    entrypoint: ["custom-entry"]
    ports: ["127.0.0.1:8080:80"]
    restart: unless-stopped
    privileged: true
    read_only: true
    cap_drop: [NET_RAW]
    security_opt: ["no-new-privileges:true"]
  postgres:
    image: fixture-pg:1
    environment: {POSTGRES_DB: fixturedb}
    volumes: ["database:/var/lib/postgresql/data"]
volumes:
  database: {external: true, name: fixture_database}
''')
            override.write_text('services:\n  api:\n    environment: {ADDED: from-override}\n')
            middle.write_text('services:\n  api:\n    environment: {ADDED: middle-would-win-if-deduplicated}\n')
            (root / '.env').write_text("TOP='project$literal'\n")
            (root / 'api.env').write_text("EXPLICIT=base\nLOW=from-file\nFROM_TOP=${TOP}\nDOLLAR_ENV='two$$dollars'\nDATABASE_URL=postgresql://postgres:5432/fixturedb\n")
            (root / 'raw.env').write_text('RAW=${TOP}$$literal\n')
            all_files = [config, override, middle, root / '.env', root / 'api.env', root / 'raw.env']
            for file in all_files:
                file.chmod(0o600)
                os.utime(file, ns=(946684800000000000, 978307200000000000))
            before = {str(file): p.file_token(file.stat()) for file in all_files}
            shared = {'com.docker.compose.project': 'fixture',
                      'com.docker.compose.project.working_dir': directory,
                      'com.docker.compose.project.config_files': ','.join(map(str, [config, override, middle, override] + [override] * 16))}
            images = {'fixture-' + name + ':1': {'Id': 'sha256:' + digit * 64,
                      'RepoTags': ['fixture-' + name + ':1'], 'RepoDigests': [],
                      'Config': {'Env': ['PATH=/bin'], 'Cmd': ['image-command'],
                                 'Entrypoint': ['image-entry'], 'User': '1000', 'WorkingDir': '/app'}}
                      for name, digit in (('api', '1'), ('web', '2'), ('pg', '3'))}
            expected_api = {'PATH': '/bin', 'TOP': 'project$literal', 'EXPLICIT': 'override',
                            'DOLLAR': '$literal', 'ADDED': 'from-override', 'LOW': 'from-file',
                            'FROM_TOP': 'project$literal', 'DOLLAR_ENV': 'two$$dollars',
                            'RAW': '${TOP}$$literal', 'DATABASE_URL': 'postgresql://postgres:5432/fixturedb'}
            records = []
            for name, image in (('api', 'fixture-api:1'), ('web', 'fixture-web:1'), ('postgres', 'fixture-pg:1')):
                env = expected_api if name == 'api' else {'PATH': '/bin', **({'POSTGRES_DB': 'fixturedb'} if name == 'postgres' else {})}
                records.append({'Image': images[image]['Id'], 'Config': {
                    'Labels': {**shared, 'com.docker.compose.service': name},
                    'Env': [key + '=' + value for key, value in env.items()],
                    'Cmd': ['app', '$ARG'] if name == 'api' else ([] if name == 'web' else ['image-command']),
                    'Entrypoint': ['custom-entry'] if name == 'web' else ['image-entry'],
                    'User': '1000', 'WorkingDir': '/app'}, 'HostConfig': {
                    'PortBindings': {'80/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '8080'}]} if name == 'web' else {},
                    'RestartPolicy': {'Name': 'unless-stopped' if name == 'web' else 'no', 'MaximumRetryCount': 0},
                    'NetworkMode': 'fixture_default', 'Privileged': name == 'web', 'ReadonlyRootfs': name == 'web',
                    'CapAdd': [], 'CapDrop': ['NET_RAW'] if name == 'web' else [],
                    'SecurityOpt': ['no-new-privileges:true'] if name == 'web' else []},
                    'MountPoints': {'/var/lib/postgresql/data': {'Type': 'volume', 'Name': 'fixture_database',
                                    'Destination': '/var/lib/postgresql/data', 'RW': True}} if name == 'postgres' else {},
                    'NetworkSettings': {'Networks': {'fixture_default': {'Aliases': [name]}}}})
            for index in range(8):
                extra = copy.deepcopy(records[0])
                extra['Config']['Labels'] = {'com.docker.compose.project': 'auxiliary',
                                             'com.docker.compose.service': 'side' + str(index)}
                records.append(extra)
            docker_root = root / 'saved-docker'
            for index, record in enumerate(records, 1):
                record['ID'] = format(index, '064x')
                folder = docker_root / 'containers' / record['ID']
                folder.mkdir(parents=True)
                persisted = copy.deepcopy(record)
                host = persisted.pop('HostConfig')
                for name, value in (('config.v2.json', persisted), ('hostconfig.json', host)):
                    file = folder / name
                    file.write_text(json.dumps(value))
                    all_files.append(file)
            for file in all_files:
                file.chmod(0o600)
                os.utime(file, ns=(946684800000000000, 978307200000000000))
            before = {str(file): p.file_token(file.stat()) for file in all_files}
            refs = tuple((record['ID'], record['Image']) for record in records)
            inspector = accepted_inspector_fixture(refs)
            real_stat = os.stat
            def socket_stat(path, *args, **kwargs):
                if path == '/var/run/docker.sock':
                    return types.SimpleNamespace(st_mode=stat.S_IFSOCK | 0o600, st_uid=0)
                return real_stat(path, *args, **kwargs)
            class Source(self.DirectorySource):
                DOCKER_ROOT = str(docker_root)
                EXPECTED_REFS = refs
                def __init__(self):
                    self.image_queries = []
                    self.drift = False
                def inspect(self, target, run):
                    return {'processes': {'postgres': 0, 'caddy': 0}, 'bindings': {'postgresImage': images['fixture-pg:1']['Id']},
                            'volumes': ['fixture'], 'images': ['fixture']}
                def validate(self, value, target, run, status):
                    if target != SHA or run != '12345' or status != 0: raise AssertionError('identity')
                def metadata(self): return inspector.metadata(root=self.DOCKER_ROOT)
                def api(self, path):
                    owner = self
                    class Connection:
                        def __init__(self, *args, **kwargs): pass
                        def request(self, method, target):
                            if method != 'GET': raise AssertionError('read-only HTTP only')
                            self.target = target
                            owner.image_queries.append(target)
                        def getresponse(self):
                            identity = self.target[len('/images/'):-len('/json')]
                            image = next(value for value in images.values() if value['Id'] == identity)
                            data = json.dumps(image).encode()
                            return types.SimpleNamespace(status=200, read=lambda limit: data[:limit])
                        def close(self): pass
                    # Execute the actual accepted allowlist and response bounds;
                    # replace only its Docker socket transport with fixture data.
                    with patch.object(inspector, 'Connection', Connection), patch.object(inspector.os, 'stat', socket_stat):
                        return inspector.api(path)
            source = Source()
            self.assertTrue(all('HostConfig' not in record for record in source.metadata()))
            with self.assertRaisesRegex(inspector.InspectionError, 'API_PATH'):
                source.api('/images/fixture-api%3A1/json')
            report = p.observe_configuration(SHA, '12345', source, binary_bytes=binary_raw, uid=os.getuid())
            self.assertEqual(report['observedFieldsAgreement'], 'MATCH', report)
            self.assertEqual(report['inputCoverage'], {'composeFiles': 20, 'projectEnvPresent': True,
                                                       'declaredEnvFiles': 3, 'labelFileSetsEqual': True, 'savedHostConfigs': 11})
            self.assertEqual(report['savedApiDeclaredTarget'], 'DIRECT_POSTGRES_CONFIGURATION_MATCH')
            self.assertFalse(report['runtimeRestored'])
            self.assertTrue(source.image_queries)
            self.assertEqual({str(file): p.file_token(file.stat()) for file in all_files}, before)
            serialized = json.dumps(report)
            for private in (directory, 'project$literal', 'DATABASE_URL', 'fixture_database'):
                self.assertNotIn(private, serialized)
            fixture_originals = {str(file): file.read_bytes() for file in all_files}
            try:
                override.write_text('services:\n  api:\n    environment: {ADDED: from-override}\n    networks: [drift]\n  kafka:\n    image: fixture-pg:1\n  SYNTHETIC_SECRET_DESIRED:\n    image: fixture-pg:1\nnetworks:\n  drift:\n    name: fixture_drift\n')
                for index, name in ((3, 'marketing-worker'), (4, 'SYNTHETIC_SECRET_SAVED')):
                    file = docker_root / 'containers' / records[index]['ID'] / 'config.v2.json'
                    saved = json.loads(file.read_bytes())
                    saved['Config']['Labels'] = {**shared, 'com.docker.compose.service': name}
                    file.write_text(json.dumps(saved))
                modified_before = {str(file): p.file_token(file.stat()) for file in all_files}
                drift = p.observe_configuration(SHA, '12345', source, binary_bytes=binary_raw, uid=os.getuid())
                self.assertEqual((drift['missingServiceCount'], drift['extraServiceCount']), (2, 2))
                rows = drift['serviceDispositions']
                self.assertIn({'roleClass': 'api', 'disposition': 'COMPARED', 'mismatchFields': ['networkNames'], 'unprovedFields': []}, rows)
                self.assertIn({'roleClass': 'marketing-worker', 'disposition': 'MISSING', 'mismatchFields': [], 'unprovedFields': []}, rows)
                self.assertIn({'roleClass': 'kafka', 'disposition': 'EXTRA', 'mismatchFields': [], 'unprovedFields': []}, rows)
                self.assertEqual(sum(row['roleClass'] == 'OTHER' for row in rows), 2)
                self.assertNotIn('SYNTHETIC_SECRET', json.dumps(drift))
                self.assertNotIn('fixture_drift', json.dumps(drift))
                self.assertEqual({str(file): p.file_token(file.stat()) for file in all_files}, modified_before)
            finally:
                for file in all_files:
                    file.write_bytes(fixture_originals[str(file)])
                    os.utime(file, ns=(946684800000000000, 978307200000000000))
            # A missing desired image is unknown, never an accepted match.
            images['fixture-api:1']['RepoTags'] = []
            unknown = p.observe_configuration(SHA, '12345', source, binary_bytes=binary_raw, uid=os.getuid())
            self.assertEqual(unknown['observedFieldsAgreement'], 'UNPROVEN')
            self.assertEqual(unknown['unprovedCounts']['image'], 1)
            self.assertEqual(unknown['mismatchCounts']['image'], 0)
            # Changing current image defaults must compare against the desired
            # image, rather than accepting the saved record's old defaults.
            images['fixture-web:1']['RepoTags'].append('fixture-api:1')
            images['fixture-web:1']['Config']['Env'] = ['PATH=/changed']
            changed = p.observe_configuration(SHA, '12345', source, binary_bytes=binary_raw, uid=os.getuid())
            self.assertEqual(changed['observedFieldsAgreement'], 'MISMATCH')
            self.assertEqual(changed['mismatchCounts']['image'], 1)
            self.assertEqual(changed['mismatchCounts']['environment'], 2)
            host_file = docker_root / 'containers' / records[0]['ID'] / 'hostconfig.json'
            host_file.unlink()
            with self.assertRaisesRegex(p.ConfigurationError, 'CONFIG_INPUT_MISSING'):
                p.observe_configuration(SHA, '12345', source, binary_bytes=binary_raw, uid=os.getuid())



def active_workflow_step(name):
    here=Path(__file__).resolve().parent
    path=here/'production-cold-preservation.yml'
    if not path.is_file(): path=here.parent/'.github/workflows/production-cold-preservation.yml'
    text=path.read_text()
    block=text.split('      - name: '+name+'\n',1)[1].split('\n      - ',1)[0]
    return text,textwrap.dedent(block.split('        run: |\n',1)[1])

def active_payload_literals():
    _,shell=active_workflow_step('Restore only the accepted historical core')
    source=shell.split("<<'PY_PAYLOAD'\n",1)[1].split('\nPY_PAYLOAD\n',1)[0]
    names={'profile','bootstrap_engine','source_attestor','startup_policy','entrypoint'}
    values={n.targets[0].id:ast.literal_eval(n.value) for n in ast.parse(source).body
            if isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name) and n.targets[0].id in names}
    if set(values)!=names: raise AssertionError('actual bootstrap payload literals missing')
    return values

b=types.ModuleType('core_bootstrap')
b.__file__='<actual-bootstrap-engine>'
sys.modules[b.__name__]=b
exec(compile(active_payload_literals()['bootstrap_engine'],b.__file__,'exec'),b.__dict__)

def component_test_module(name, source):
    module=types.ModuleType(name)
    module.__file__='<actual-memory-'+name+'>'
    sys.modules[name]=module
    exec(compile(source,module.__file__,'exec'),module.__dict__)
    return module

component_test_module('bootstrap_source',active_payload_literals()['source_attestor'])
component_test_module('startup_policy',active_payload_literals()['startup_policy'])

import copy
import json
import os
import signal
import socket
import threading
import time
from unittest.mock import patch
from pathlib import Path
import tempfile
import unittest

import core_bootstrap as b

SHA = 'a' * 40


def fixture():
    networks = [{'Name': 'retained' + str(i), 'Id': format(100 + i, '064x'), 'Driver': 'bridge',
                 'Scope': 'local', 'Ingress': False, 'Containers': {}} for i in range(6)]
    volumes = [{'Name': 'v' + str(i), 'Mountpoint': '/var/lib/docker/volumes/v' + str(i) + '/_data',
                'Driver': 'local', 'Options': None, 'Labels': {}, 'Scope': 'local', 'CreatedAt': 'fixed'} for i in range(19)]
    records = []
    for i, role in enumerate(list(b.CORE) + ['pgbouncer', 'auth-mail-worker', 'outbox-worker', 'private1', 'private2']):
        cfg = {'Image': 'old-mutable:tag', 'Env': ['SECRET=value'], 'Cmd': ['unchanged-command'],
               'Entrypoint': ['unchanged-entrypoint'], 'Labels': {'com.docker.compose.service': role,
               'com.docker.compose.project': 'separate-edge' if role == 'caddy' else 'application'}, 'Volumes': {'/data': {}},
               'Healthcheck': {'Test': ['CMD', 'true']}}
        hc = {'NetworkMode': 'retained0', 'RestartPolicy': {'Name': 'unless-stopped', 'MaximumRetryCount': 0},
              'LogConfig': {'Type': 'json-file', 'Config': {}}, 'Binds': ['old-declaration'], 'VolumesFrom': [],
              'Mounts': [], 'PortBindings': {}, 'Privileged': False, 'AutoRemove': False}
        record = {'ID': format(i + 1, '064x'), 'Image': 'sha256:' + format(i + 1, '064x'), 'Config': cfg, 'HostConfig': hc,
                  'MountPoints': {'data': {'Type': 'volume', 'Name': 'v' + str(i), 'Source': volumes[i]['Mountpoint'],
                                         'Destination': '/data', 'RW': True}},
                  'NetworkSettings': {'Networks': {'retained0': {'NetworkID': networks[0]['Id'],
                                      'Aliases': [role], 'IPAddress': '172.16.0.' + str(i + 2),
                                      'EndpointID': 'old-ephemeral', 'MacAddress': 'old-mac', 'IPAMConfig': None}}}}
        records.append(record)
    refs = tuple((r['ID'], r['Image']) for r in records)
    return records, refs, networks, volumes


class Source:
    def __init__(self, records):
        self.data = copy.deepcopy(records)
        self.drift = False
        self.safe = True
        self.foreign_runtime_before_write = False
        self.attested = 0
    def records(self): return copy.deepcopy(self.data)
    def attest(self, sha, refs):
        assert sha == SHA
        b.demand({(r['ID'], r['Image']) for r in self.data} == set(refs), 'SAVED_IDENTITIES')
        self.attested += 1
        return 'immutable-source-proof'
    def recheck(self, token):
        if self.drift: raise b.Refusal('SOURCE_DRIFT')
        assert token == 'immutable-source-proof'
    def before_first_write(self,token):
        self.recheck(token)
        b.demand(not self.foreign_runtime_before_write,'FOREIGN_RUNTIME_BEFORE_WRITE')
    def bind_preserved(self, path): return path == '/retained/readonly'
    def startup_safe(self, role, record, image): return self.safe
    def image(self, identity): return {'Id': identity, 'Os': 'linux', 'Architecture': 'amd64'}


class FakeDocker:
    def __init__(self, records, networks, volumes):
        self.networks, self.volumes = copy.deepcopy(networks), copy.deepcopy(volumes)
        self.images = [{'Id': r['Image']} for r in records]
        self.objects, self.calls, self.plans = {}, [], {}
        self.owned=set()
        self.foreign = False
        self.lose_create = False
        self.lose_start = False
        self.warning = False
        self.extra_volume = False
        self.health_fail = None
    def get(self, path):
        self.calls.append(('GET', path))
        if path == '/containers/json?all=1':
            rows = [{'Id': identity} for identity in self.objects]
            if self.foreign: rows.append({'Id': 'f' * 64})
            return rows
        if path == '/volumes': return {'Volumes': copy.deepcopy(self.volumes)}
        if path == '/networks': return copy.deepcopy(self.networks)
        if path == '/images/json?all=1': return copy.deepcopy(self.images)
        if path.startswith('/networks/'):
            return copy.deepcopy(next(n for n in self.networks if n['Id']==path.split('/')[2]))
        if path.startswith('/containers/') and path.endswith('/json'):
            return copy.deepcopy(self.objects[path.split('/')[2]])
        raise AssertionError('unexpected API request')
    def admit(self, plans): self.plans = {p['name']: p for p in plans}
    def create(self, name, body):
        self.calls.append(('CREATE', name))
        identity = format(1000 + len(self.objects), '064x')
        cfg = copy.deepcopy(body); host = cfg.pop('HostConfig'); networking = cfg.pop('NetworkingConfig')
        mounts = [{'Type': m['Type'], 'Destination': m['Target'], 'RW': not m['ReadOnly'],
                   'Name' if m['Type'] == 'volume' else 'Source': m['Source']} for m in host['Mounts']]
        networks={n:{**v,'NetworkID':next(x['Id'] for x in self.networks if x['Name']==n),'IPAddress':'172.20.0.'+str(10+len(self.objects))} for n,v in networking['EndpointsConfig'].items()}
        self.objects[identity] = {'Id': identity, 'Image': cfg['Image'], 'Name': '/' + name,
            'Config': cfg, 'HostConfig': host, 'Mounts': mounts,
            'NetworkSettings': {'Networks': networks},
            'State': {'Status': 'created', 'Running': False, 'Health': {'Status': 'starting'}}}
        self.owned.add(identity)
        if self.extra_volume:
            self.volumes.append({'Name': 'new-unplanned', 'Driver': 'local'})
        if self.lose_create:
            self.owned.discard(identity)
            raise b.Refusal('DOCKER_TRANSPORT_UNKNOWN')
        return identity
    def start(self, identity):
        self.calls.append(('START', identity))
        assert identity in self.objects
        self.objects[identity]['State'] = {'Status': 'running', 'Running': True, 'Health': {'Status': 'healthy'}}
        if self.lose_start: raise b.Refusal('DOCKER_TRANSPORT_UNKNOWN')
    def created_clean(self, identity):return not self.warning
    def stop(self, identity, seconds=3):
        self.calls.append(('STOP', identity))
        assert identity in self.objects
        self.objects[identity]['State']['Running'] = False


class Readiness:
    def __init__(self, fail=None, supported=True): self.fail, self.is_supported = fail, supported
    def supported(self, role, record): return self.is_supported
    def __call__(self, role, identity, record, api, end):
        state = api.get('/containers/' + identity + '/json')['State']
        return role != self.fail and state['Running'] and state['Health']['Status'] == 'healthy'


class BootstrapEngineTests(unittest.TestCase):
    def setUp(self):
        self.records, self.refs, self.networks, self.volumes = fixture()
        self.source = Source(self.records)
        self.api = FakeDocker(self.records, self.networks, self.volumes)
        self.tmp = tempfile.TemporaryDirectory()
        self.parent = Path(self.tmp.name) / 'private'; self.parent.mkdir(mode=0o700)
        self.operation = self.parent / b.OP
    def tearDown(self): self.tmp.cleanup()
    def journal(self, sha): return b.Journal(self.operation, sha, uid=os.getuid())
    def run_stage(self, readiness=None):
        return b.bootstrap(self.source, self.api, self.refs, SHA, self.journal, readiness or Readiness(), uid=os.getuid())
    def plan(self): return b.build_plan(self.source.records(), b.snapshot(self.api), self.refs, self.source)

    def failing_journal_factory(self, trigger, persistent=False):
        events = []
        def factory(sha):
            journal = self.journal(sha)
            actual = journal.record
            failed = False
            def record(stage, role, identity):
                nonlocal failed
                events.append((stage, role, identity))
                if stage == trigger:
                    failed = True
                if stage == trigger or failed and persistent:
                    raise OSError('SYNTHETIC_PRIVATE_STORAGE_FAILURE')
                actual(stage, role, identity)
            journal.record = record
            return journal
        return factory, events

    def controlled_stage(self, journal, readiness=None):
        return b.controlled_bootstrap(self.source, self.api, self.refs, SHA, journal,
                                      readiness or Readiness(), uid=os.getuid())

    def test_persistent_journal_failure_after_created_started_or_ready_stops_owned(self):
        for trigger in ('CREATED', 'STARTED', 'READY'):
            with self.subTest(trigger=trigger):
                self.api = FakeDocker(self.records, self.networks, self.volumes)
                self.operation = self.parent / (b.OP + '-' + trigger.lower())
                factory, events = self.failing_journal_factory(trigger, persistent=True)
                result = self.controlled_stage(factory)
                self.assertEqual(result['outcome'], 'UNKNOWN')
                self.assertEqual(result['errorCode'], 'BOOTSTRAP_UNKNOWN_RECONCILIATION_REQUIRED')
                self.assertNotIn('SYNTHETIC_PRIVATE', json.dumps(result))
                self.assertEqual(sum(c[0] == 'CREATE' for c in self.api.calls), 1)
                self.assertEqual(sum(c[0] == 'START' for c in self.api.calls), 0 if trigger == 'CREATED' else 1)
                self.assertEqual([c[1] for c in self.api.calls if c[0] == 'STOP'], list(self.api.objects))
                self.assertTrue(all(v['State']['Running'] is False for v in self.api.objects.values()))
                self.assertIn('STOP_INTENT', [e[0] for e in events])
                self.assertIn('STOPPED', [e[0] for e in events])
                self.assertEqual(events[-1][0], 'UNKNOWN')

    def test_cleanup_stop_intent_stopped_and_unknown_failure_cannot_skip_six_owned_stops(self):
        for trigger in ('STOP_INTENT', 'STOPPED', 'UNKNOWN'):
            with self.subTest(trigger=trigger):
                self.api = FakeDocker(self.records, self.networks, self.volumes)
                self.operation = self.parent / (b.OP + '-' + trigger.lower())
                factory, events = self.failing_journal_factory(trigger, persistent=True)
                result = self.controlled_stage(factory, Readiness('caddy'))
                self.assertEqual(result['outcome'], 'UNKNOWN')
                self.assertEqual(result['errorCode'], 'BOOTSTRAP_UNKNOWN_RECONCILIATION_REQUIRED')
                self.assertEqual(len(self.api.objects), 6)
                self.assertEqual({c[1] for c in self.api.calls if c[0] == 'STOP'}, set(self.api.objects))
                self.assertTrue(all(v['State']['Running'] is False for v in self.api.objects.values()))
                self.assertEqual(events[-1][0], 'UNKNOWN')

    def test_stop_failure_and_persistent_journal_failure_still_attempt_other_owned_objects(self):
        factory, events = self.failing_journal_factory('STOP_INTENT', persistent=True)
        actual_stop = self.api.stop
        attempts = []
        def stop(identity, seconds=3):
            attempts.append(identity)
            if len(attempts) == 1:
                raise b.Refusal('DOCKER_TRANSPORT_UNKNOWN')
            actual_stop(identity, seconds)
        self.api.stop = stop
        result = self.controlled_stage(factory, Readiness('caddy'))
        self.assertEqual(result['outcome'], 'UNKNOWN')
        self.assertEqual(set(attempts), set(self.api.objects))
        self.assertEqual(len(attempts), 6)
        self.assertTrue(all(v['State']['Running'] is False for k, v in self.api.objects.items() if k != attempts[0]))
        self.assertEqual(events[-1][0], 'UNKNOWN')

    def test_create_intent_failure_before_first_mutation_is_truthfully_refused(self):
        factory, events = self.failing_journal_factory('CREATE_INTENT', persistent=True)
        result = self.controlled_stage(factory)
        self.assertEqual(result['outcome'], 'REFUSED')
        self.assertEqual(result['errorCode'], 'BOOTSTRAP_PRECONDITION_UNAVAILABLE')
        self.assertFalse(any(c[0] in ('CREATE', 'START', 'STOP') for c in self.api.calls))
        self.assertTrue(self.operation.exists())  # existing one-use operation stays spent

    def test_start_intent_failure_after_create_never_starts_and_remains_unknown(self):
        factory, events = self.failing_journal_factory('START_INTENT', persistent=True)
        result = self.controlled_stage(factory)
        self.assertEqual(result['outcome'], 'UNKNOWN')
        self.assertEqual(sum(c[0] == 'CREATE' for c in self.api.calls), 1)
        self.assertFalse(any(c[0] == 'START' for c in self.api.calls))
        self.assertEqual({c[1] for c in self.api.calls if c[0] == 'STOP'}, set(self.api.objects))

    def test_acknowledged_create_lost_to_caller_stops_only_exact_owned_identity(self):
        factory, events = self.failing_journal_factory('STOP_INTENT', persistent=True)
        actual_create = self.api.create
        foreign = 'f' * 64
        def create(name, body):
            identity = actual_create(name, body)
            self.api.objects[foreign] = copy.deepcopy(self.api.objects[identity])
            self.api.objects[foreign]['Id'] = foreign
            self.api.objects[foreign]['Name'] = '/foreign-original'
            self.api.objects[foreign]['Config']['Labels'][b.OP_LABEL] = 'not-our-operation'
            self.api.owned.add(foreign)  # even a forged capability cannot bypass identity proof
            raise b.Refusal('DOCKER_TRANSPORT_UNKNOWN')
        self.api.create = create
        result = self.controlled_stage(factory)
        self.assertEqual(result['outcome'], 'UNKNOWN')
        stopped = [c[1] for c in self.api.calls if c[0] == 'STOP']
        self.assertEqual(len(stopped), 1)
        self.assertNotIn(foreign, stopped)
        self.assertFalse(any(c[0] == 'START' for c in self.api.calls))
        self.assertEqual(sum(c[0] == 'CREATE' for c in self.api.calls), 1)

    def test_unacknowledged_create_and_ack_lost_start_keep_unknown_when_final_journal_fails(self):
        for operation in ('create', 'start'):
            with self.subTest(operation=operation):
                self.api = FakeDocker(self.records, self.networks, self.volumes)
                self.operation = self.parent / (b.OP + '-lost-' + operation)
                setattr(self.api, 'lose_' + operation, True)
                factory, events = self.failing_journal_factory('UNKNOWN', persistent=True)
                result = self.controlled_stage(factory)
                self.assertEqual(result['outcome'], 'UNKNOWN')
                self.assertEqual(result['errorCode'], 'BOOTSTRAP_UNKNOWN_RECONCILIATION_REQUIRED')
                self.assertEqual(sum(c[0] == 'CREATE' for c in self.api.calls), 1)
                self.assertEqual(sum(c[0] == 'STOP' for c in self.api.calls), 0 if operation == 'create' else 1)
                self.assertEqual(events[-1][0], 'UNKNOWN')

    def test_six_core_from_global_records_caddy_separate_project_and_workers_quarantined(self):
        result = self.run_stage()
        self.assertEqual(result['createdCoreCount'], 6)
        self.assertEqual(result['quarantinedRecordCount'], 5)
        names = [call[1] for call in self.api.calls if call[0] == 'CREATE']
        self.assertEqual(names, ['pc-' + b.OP + '-' + role for role in b.CORE])
        self.assertFalse(any('worker' in name or 'private' in name or 'pgbouncer' in name for name in names))
        caddy = next(x for x in self.api.objects.values() if x['Config']['Labels'][b.ROLE_LABEL] == 'caddy')
        self.assertEqual(caddy['Config']['Labels']['com.docker.compose.project'], 'separate-edge')
        journal = json.loads((self.operation/'journal.json').read_text())
        self.assertEqual(journal['steps'][-1]['stage'], 'COMPLETE')
        self.assertEqual((self.operation/'journal.json').stat().st_mode & 0o777, 0o600)
        for role in b.CORE:
            stages = [s['stage'] for s in journal['steps'] if s['role'] == role]
            self.assertEqual(stages, ['CREATE_INTENT','CREATED','START_INTENT','STARTED','READY'])
        self.assertFalse(result['registrationAccepted'])
        self.assertFalse(result['exactCurrentMainReleased'])
        self.assertFalse(result['dataRollbackClaimed'])

    def test_mutable_image_tags_never_used_and_private_env_remains_in_body_only(self):
        plans = self.plan()
        for p in plans:
            self.assertTrue(b.IMAGE.fullmatch(p['body']['Image']))
            self.assertEqual(p['body']['Env'], ['SECRET=value'])
            self.assertEqual(p['body']['HostConfig']['RestartPolicy']['Name'], 'no')
        self.run_stage()
        self.assertNotIn('SECRET', (self.operation/'journal.json').read_text())
        self.assertNotIn('old-mutable', json.dumps([call for call in self.api.calls if call[0] != 'GET']))

    def test_nocopy_explicit_existing_mounts_and_no_ephemeral_network_fields(self):
        for p in self.plan():
            self.assertEqual(p['body']['HostConfig']['Binds'], [])
            self.assertTrue(p['body']['HostConfig']['Mounts'][0]['VolumeOptions']['NoCopy'])
            ep = p['body']['NetworkingConfig']['EndpointsConfig']['retained0']
            self.assertEqual(set(ep), {'NetworkID', 'Aliases'})
            self.assertEqual(ep['NetworkID'], next(n['Id'] for n in self.networks if n['Name'] == 'retained0'))
            self.assertNotIn('old-ephemeral', json.dumps(ep))

    def test_created_network_identity_is_exact_before_start(self):
        plan = self.plan()[0]
        self.api.admit([plan])
        identity = self.api.create(plan['name'], plan['body'])
        b.verify_created(self.api, plan, identity)
        endpoint = self.api.objects[identity]['NetworkSettings']['Networks']['retained0']
        for wrong in ('', 'f' * 64):
            endpoint['NetworkID'] = wrong
            with self.subTest(network_id=wrong), self.assertRaisesRegex(b.Refusal, 'CREATED_NETWORK_BINDING'):
                b.verify_created(self.api, plan, identity)
        self.assertFalse(any(c[0] == 'START' for c in self.api.calls))

    def test_readonly_bind_preserved_and_no_create_mountpoint(self):
        self.source.data[0]['MountPoints']['bind']={'Type':'bind','Source':'/retained/readonly','Destination':'/config','RW':False}
        mount=self.plan()[0]['body']['HostConfig']['Mounts'][1]
        self.assertTrue(mount['ReadOnly'])
        self.assertFalse(mount['BindOptions']['CreateMountpoint'])
        self.source.data[0]['MountPoints']['bind']['RW']=True
        with self.assertRaises(b.Refusal): self.plan()

    def test_unsupported_profiles_refuse_before_any_journal_or_create(self):
        mutations = {
            'anonymous': lambda r: r['Config']['Volumes'].update({'/new':{}}),
            'missing-volume': lambda r: r['MountPoints']['data'].update(Name='missing'),
            'volume-source': lambda r: r['MountPoints']['data'].update(Source='/wrong'),
            'static-ip': lambda r: r['NetworkSettings']['Networks']['retained0'].update(IPAMConfig={'IPv4Address':'172.16.0.99'}),
            'unknown-network': lambda r: r['HostConfig'].update(NetworkMode='not-there'),
            'old-container-network': lambda r: r['HostConfig'].update(NetworkMode='container:'+'a'*64),
            'privileged': lambda r: r['HostConfig'].update(Privileged=True),
            'auto-remove': lambda r: r['HostConfig'].update(AutoRemove=True),
            'host-pid': lambda r: r['HostConfig'].update(PidMode='host'),
            'runtime': lambda r: r['HostConfig'].update(Runtime='other'),
            'new-capability': lambda r: r['HostConfig'].update(CapAdd=['SYS_ADMIN']),
            'device': lambda r: r['HostConfig'].update(Devices=[{'PathOnHost':'/dev/sda'}]),
            'remote-log': lambda r: r['HostConfig'].update(LogConfig={'Type':'fluentd'}),
            'unknown-host-key': lambda r: r['HostConfig'].update(FutureMutator='unsafe'),
            'public-pg': lambda r: r['HostConfig'].update(PortBindings={'5432/tcp':[{'HostIp':'0.0.0.0','HostPort':'5432'}]}),
        }
        for name, mutate in mutations.items():
            with self.subTest(name=name):
                self.source.data=copy.deepcopy(self.records); mutate(self.source.data[0])
                with self.assertRaises(b.Refusal): self.run_stage()
                self.assertFalse(self.operation.exists())
                self.assertFalse(any(c[0] in ('CREATE','START') for c in self.api.calls))

    def test_missing_duplicate_or_changed_global_core_identity_refuses_before_write(self):
        for mutate in (lambda rs: rs.pop(), lambda rs: rs[0].update(Image='sha256:'+'f'*64),
                       lambda rs: rs[7]['Config']['Labels'].update({'com.docker.compose.service':'postgres'})):
            self.source.data=copy.deepcopy(self.records);mutate(self.source.data)
            with self.assertRaises(b.Refusal): self.run_stage()
            self.assertFalse(self.operation.exists())

    def test_source_or_startup_or_readiness_unknown_refuses_before_write(self):
        self.source.drift=True
        with self.assertRaises(b.Refusal): self.run_stage()
        self.assertFalse(self.operation.exists())
        self.source.drift=False;self.source.safe=False
        with self.assertRaises(b.Refusal): self.run_stage()
        self.assertFalse(self.operation.exists())
        self.source.safe=True
        with self.assertRaises(b.Refusal): self.run_stage(Readiness(supported=False))
        self.assertFalse(self.operation.exists())

    def test_existing_journal_forbids_replay_before_any_create(self):
        b.Journal(self.operation,SHA,uid=os.getuid())
        with self.assertRaises(FileExistsError): self.run_stage()
        self.assertFalse(any(c[0]=='CREATE' for c in self.api.calls))

    def test_create_response_loss_is_unknown_no_retry_no_start_and_no_delete(self):
        self.api.lose_create=True
        with self.assertRaisesRegex(b.Refusal,'UNKNOWN_RECONCILIATION'): self.run_stage()
        self.assertEqual(sum(c[0]=='CREATE' for c in self.api.calls),1)
        self.assertFalse(any(c[0] in ('START','STOP','DELETE') for c in self.api.calls))
        data=json.loads((self.operation/'journal.json').read_text())
        self.assertEqual([s['stage'] for s in data['steps']],['PLANNED','CREATE_INTENT','UNKNOWN'])
        self.assertEqual(len(self.api.objects),1)

    def test_unexpected_volume_creation_detected_before_start(self):
        self.api.extra_volume=True
        with self.assertRaisesRegex(b.Refusal,'UNKNOWN_RECONCILIATION'):self.run_stage()
        self.assertFalse(any(c[0]=='START' for c in self.api.calls))

    def test_start_response_loss_stops_the_just_started_owned_postgres(self):
        self.api.lose_start=True
        with self.assertRaisesRegex(b.Refusal,'UNKNOWN_RECONCILIATION'):self.run_stage()
        started=[c[1] for c in self.api.calls if c[0]=='START']
        stopped=[c[1] for c in self.api.calls if c[0]=='STOP']
        self.assertEqual(started,stopped)
        self.assertEqual(len(started),1)
        self.assertFalse(self.api.objects[started[0]]['State']['Running'])

    def test_create_warning_acknowledges_id_then_stops_owned_without_start(self):
        self.api.warning=True
        with self.assertRaisesRegex(b.Refusal,'UNKNOWN_RECONCILIATION'):self.run_stage()
        self.assertEqual(sum(c[0]=='CREATE' for c in self.api.calls),1)
        self.assertFalse(any(c[0]=='START' for c in self.api.calls))
        self.assertEqual(sum(c[0]=='STOP' for c in self.api.calls),1)

    def test_image_declared_volume_cannot_be_implicitly_created(self):
        self.source.image=lambda identity:{'Id':identity,'Os':'linux','Architecture':'amd64','Config':{'Volumes':{'/other':{}}}}
        with self.assertRaises(b.Refusal):self.run_stage()
        self.assertFalse(self.operation.exists())

    def test_actual_sigterm_after_accepted_start_enters_unknown_owned_cleanup(self):
        actual=self.api.start
        def interrupted(identity):
            actual(identity)
            os.kill(os.getpid(),signal.SIGTERM)
        self.api.start=interrupted
        old=signal.getsignal(signal.SIGTERM)
        result=b.controlled_bootstrap(self.source,self.api,self.refs,SHA,self.journal,Readiness(),uid=os.getuid())
        self.assertFalse(result['passed'])
        self.assertEqual(result['outcome'],'UNKNOWN')
        self.assertEqual([c[1] for c in self.api.calls if c[0]=='START'],[c[1] for c in self.api.calls if c[0]=='STOP'])
        self.assertEqual(signal.getsignal(signal.SIGTERM),old)

    def test_unexpected_exception_does_not_publish_private_values(self):
        self.source.attest=lambda *a:(_ for _ in ()).throw(ValueError('/PRIVATE_PATH password=SYNTHETIC_SECRET'))
        result=b.controlled_bootstrap(self.source,self.api,self.refs,SHA,self.journal,Readiness(),uid=os.getuid())
        self.assertFalse(result['passed'])
        self.assertNotIn('PRIVATE',json.dumps(result))
        self.assertNotIn('SECRET',json.dumps(result))

    def test_postgres_started_failure_stops_owned_only_preserves_objects_and_no_data_rollback(self):
        with self.assertRaisesRegex(b.Refusal,'UNKNOWN_RECONCILIATION'):self.run_stage(Readiness(fail='api'))
        started=[c[1] for c in self.api.calls if c[0]=='START']
        stopped=[c[1] for c in self.api.calls if c[0]=='STOP']
        self.assertEqual(stopped,list(reversed(started)))
        self.assertEqual(len(self.api.objects),4)
        self.assertNotIn('DELETE',[c[0] for c in self.api.calls])
        self.assertEqual(json.loads((self.operation/'journal.json').read_text())['steps'][-1]['stage'],'UNKNOWN')

    def test_nonzero_foreign_runtime_refuses_before_write(self):
        self.api.foreign=True
        with self.assertRaises(b.Refusal):self.run_stage()
        self.assertFalse(self.operation.exists())

    def test_journal_first_record_is_fsynced_private_and_closed(self):
        j=b.Journal(self.operation,SHA,uid=os.getuid())
        j.record('CREATE_INTENT','postgres',None)
        self.assertEqual((self.operation/'journal.json').stat().st_mode&0o777,0o600)
        with self.assertRaises(b.Refusal):j.record('PRUNE',None,None)
        self.assertFalse((self.operation/'next.json').exists())

    def test_docker_mutation_interface_has_no_delete_pull_restart_or_create_network_volume(self):
        self.assertFalse(any(hasattr(b.LocalDocker,n) for n in ('delete','pull','restart','create_volume','create_network')))

    def native_probe_fixture(self,role):
        index=list(b.CORE).index(role)
        self.source.data[index]['Config']['ExposedPorts']={'6379/tcp':{}} if role=='redis' else {'9000/tcp':{}}
        self.source.data[index]['Config']['Healthcheck']={'Test':['NONE']}
        self.api.networks[0]['IPAM']={'Config':[{'Subnet':'172.20.0.0/24'}]}
        plan=self.plan()[index]
        identity=self.api.create(plan['name'],plan['body']);self.api.start(identity)
        ready=b.NativeReadiness('xn----8sbjf4befbjgs9b.xn--p1ai','195.19.12.120')
        return identity,self.source.data[index],ready

    def test_minio_actual_bounded_http_probe_on_verified_owned_subnet(self):
        identity,record,ready=self.native_probe_fixture('minio')
        client,server=socket.socketpair();client.settimeout(2);server.settimeout(2)
        requests=[]
        def serve():
            try:
                data=b''
                while b'\r\n\r\n' not in data:data+=server.recv(4096)
                requests.append(data)
                server.sendall(b'HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
            finally:server.close()
        thread=threading.Thread(target=serve);thread.start()
        with patch.object(b.socket,'create_connection',return_value=client) as connect:
            self.assertTrue(ready('minio',identity,record,self.api,time.monotonic()+3))
            self.assertEqual(connect.call_args.args[0],('172.20.0.10',9000))
        thread.join(3);self.assertFalse(thread.is_alive())
        self.assertTrue(requests[0].startswith(b'GET /minio/health/ready HTTP/1.1\r\n'))

    def test_redis_actual_resp_auth_ping_not_tcp_liveness(self):
        identity,record,ready=self.native_probe_fixture('redis')
        record['Config']['Cmd']=['redis-server','--requirepass','fixture-secret']
        client,server=socket.socketpair();client.settimeout(2);server.settimeout(2)
        received=[]
        def serve():
            try:
                stream=server.makefile('rb')
                for expected,response in ((b.resp_array(['AUTH','fixture-secret']),b'+OK\r\n'),(b.resp_array(['PING']),b'+PONG\r\n')):
                    data=stream.read(len(expected));received.append(data);server.sendall(response)
                stream.close()
            finally:server.close()
        thread=threading.Thread(target=serve);thread.start()
        with patch.object(b.socket,'create_connection',return_value=client):
            self.assertTrue(ready('redis',identity,record,self.api,time.monotonic()+3))
        thread.join(3);self.assertFalse(thread.is_alive())
        self.assertEqual(received,[b.resp_array(['AUTH','fixture-secret']),b.resp_array(['PING'])])

    def test_probe_network_id_or_subnet_drift_blocks_before_socket(self):
        identity,record,ready=self.native_probe_fixture('minio')
        self.api.networks[0]['IPAM']['Config'][0]['Subnet']='10.5.0.0/24'
        with patch.object(b.socket,'create_connection') as connect,self.assertRaises(b.Refusal):
            ready('minio',identity,record,self.api,time.monotonic()+1)
        connect.assert_not_called()
        self.api.objects[identity]['NetworkSettings']['Networks']['retained0']['NetworkID']='f'*64
        with self.assertRaises(b.Refusal):b.owned_ipv4(self.api,identity,record)

    def test_redis_unknown_config_or_conflicting_password_is_not_supported(self):
        cfg={'Env':[],'Cmd':['redis-server','/private/redis.conf']}
        self.assertIs(b.redis_auth(cfg),False)
        cfg={'Env':['REDIS_PASSWORD=other'],'Cmd':['redis-server','--requirepass','fixture-secret']}
        self.assertIs(b.redis_auth(cfg),False)

    def test_local_exec_only_accepts_frozen_readiness_program(self):
        identity='a'*64;record=copy.deepcopy(self.records[list(b.CORE).index('api')])
        client=b.LocalDocker.__new__(b.LocalDocker);client.owned={identity};client.probes={identity:b.probe_command('api',record)}
        calls=[]
        def request(method,path,*args,**kwargs):
            calls.append((method,path))
            if path.endswith('/exec'):return {'Id':'b'*64}
            if path.endswith('/start'):return b''
            return {'Running':False,'ExitCode':0}
        client._request=request
        with self.assertRaises(b.Refusal):client.exec_exit(identity,['sh','-c','unsafe'])
        self.assertEqual(calls,[])
        command,env=b.probe_command('api',record)
        self.assertEqual(client.exec_exit(identity,command,env),0)
        self.assertEqual(len(calls),3)

    def test_default_console_size_is_dropped_without_forwarding_host_options(self):
        self.source.data[0]['HostConfig']['ConsoleSize']=[0,0]
        plan=self.plan()[0]
        self.assertNotIn('ConsoleSize',plan['body']['HostConfig'])
        self.source.data[0]['HostConfig']['ConsoleSize']=[20,80]
        with self.assertRaises(b.Refusal):self.plan()

    def test_postgres_probe_pins_own_loopback_and_disables_libpq_redirect_inputs(self):
        record=copy.deepcopy(self.records[0]);record['Config']['Env']=['POSTGRES_USER=fixture','POSTGRES_DB=fixture','POSTGRES_PASSWORD=fixture-secret','PGHOST=external.invalid']
        command,env=b.probe_command('postgres',record)
        self.assertEqual(command[command.index('--host')+1],'127.0.0.1')
        self.assertEqual(command[command.index('--port')+1],'5432')
        self.assertIn('PGHOSTADDR=127.0.0.1',env)
        self.assertEqual(command[:4],['/usr/bin/env','-u','PGSERVICE','psql'])
        self.assertFalse(any(item.startswith('PGSERVICE=') for item in env))
        self.assertIn('PGOPTIONS=',env)

    def test_create_config_or_security_drift_refuses_before_start(self):
        for mutation in ('env','entrypoint','health','port','capability'):
            self.api=FakeDocker(self.records,self.networks,self.volumes)
            actual=self.api.create
            def changed(name,body):
                identity=actual(name,body);obj=self.api.objects[identity]
                if mutation=='env':obj['Config']['Env']=['PRIVATE_CHANGED=value']
                if mutation=='entrypoint':obj['Config']['Entrypoint']=['wrong']
                if mutation=='health':obj['Config']['Healthcheck']={'Test':['CMD','wrong']}
                if mutation=='port':obj['HostConfig']['PortBindings']={'9000/tcp':[{'HostIp':'0.0.0.0','HostPort':'9000'}]}
                if mutation=='capability':obj['HostConfig']['CapAdd']=['SYS_ADMIN']
                return identity
            self.api.create=changed
            operation=self.parent/(b.OP+'-'+mutation)
            factory=lambda sha:b.Journal(operation,sha,uid=os.getuid())
            with self.subTest(mutation=mutation),self.assertRaises(b.Refusal):
                b.bootstrap(self.source,self.api,self.refs,SHA,factory,Readiness(),uid=os.getuid())
            self.assertFalse(any(c[0]=='START' for c in self.api.calls))

    def test_poststart_semantic_drift_still_stops_only_known_owned(self):
        for mutation in ('env','network','foreign-label'):
            self.api=FakeDocker(self.records,self.networks,self.volumes)
            actual=self.api.start
            def changed(identity):
                actual(identity);obj=self.api.objects[identity]
                if mutation=='env':obj['Config']['Env']=['CHANGED_PRIVATE=value']
                if mutation=='network':obj['NetworkSettings']['Networks']={}
                if mutation=='foreign-label':obj['Config']['Labels'][b.OP_LABEL]='other-operation'
            self.api.start=changed
            operation=self.parent/(b.OP+'-after-start-'+mutation)
            factory=lambda sha:b.Journal(operation,sha,uid=os.getuid())
            with self.subTest(mutation=mutation),self.assertRaisesRegex(b.Refusal,'UNKNOWN_RECONCILIATION'):
                b.bootstrap(self.source,self.api,self.refs,SHA,factory,Readiness(),uid=os.getuid())
            stopped=[c[1] for c in self.api.calls if c[0]=='STOP']
            started=[c[1] for c in self.api.calls if c[0]=='START']
            self.assertEqual(stopped,[] if mutation=='foreign-label' else started)
            self.assertEqual(json.loads((operation/'journal.json').read_text())['steps'][-1]['stage'],'UNKNOWN')

    def test_fresh_prewrite_runtime_gate_refuses_without_journal_or_docker_mutation(self):
        original=self.source.recheck
        def concurrent_foreign_runtime(token):
            original(token)
            self.source.foreign_runtime_before_write=True
        self.source.recheck=concurrent_foreign_runtime
        with self.assertRaisesRegex(b.Refusal,'FOREIGN_RUNTIME_BEFORE_WRITE'):self.run_stage()
        self.assertFalse(self.operation.exists())
        self.assertFalse(any(c[0] in ('CREATE','START','STOP') for c in self.api.calls))

    def test_earlier_ready_pg_or_api_exit_while_later_roles_start_never_completes(self):
        for failing_role in ('postgres','api'):
            self.api=FakeDocker(self.records,self.networks,self.volumes)
            actual=self.api.start
            def later_start(identity):
                actual(identity)
                if self.api.objects[identity]['Config']['Labels'][b.ROLE_LABEL]=='caddy':
                    early=next(obj for obj in self.api.objects.values() if obj['Config']['Labels'][b.ROLE_LABEL]==failing_role)
                    early['State']['Running']=False;early['State']['Status']='exited'
            self.api.start=later_start
            operation=self.parent/(b.OP+'-late-exit-'+failing_role)
            factory=lambda sha:b.Journal(operation,sha,uid=os.getuid())
            with self.subTest(role=failing_role),self.assertRaisesRegex(b.Refusal,'UNKNOWN_RECONCILIATION'):
                b.bootstrap(self.source,self.api,self.refs,SHA,factory,Readiness(),uid=os.getuid())
            stages=[s['stage'] for s in json.loads((operation/'journal.json').read_text())['steps']]
            self.assertNotIn('COMPLETE',stages)
            self.assertEqual(stages[-1],'UNKNOWN')
            self.assertEqual(sum(c[0]=='STOP' for c in self.api.calls),6)

    def test_postgres_pinned_vendor_defaults_and_declared_user_database(self):
        ready=b.NativeReadiness('xn----8sbjf4befbjgs9b.xn--p1ai','195.19.12.120')
        cases=((['POSTGRES_PASSWORD=fixture-secret'],'postgres','postgres'),
               (['POSTGRES_USER=declared','POSTGRES_PASSWORD=fixture-secret'],'declared','declared'),
               (['POSTGRES_USER=declared','POSTGRES_DB=grain','POSTGRES_PASSWORD=fixture-secret'],'declared','grain'))
        for env,user,database in cases:
            record=copy.deepcopy(self.records[0]);record['Config']['Env']=env
            self.assertTrue(ready.supported('postgres',record))
            command,probe_env=b.probe_command('postgres',record)
            self.assertEqual(command[command.index('--username')+1],user)
            self.assertEqual(command[command.index('--dbname')+1],database)
            self.assertEqual(command[command.index('--host')+1],'127.0.0.1')
            self.assertEqual(command[command.index('--port')+1],'5432')
            self.assertEqual(command[:4],['/usr/bin/env','-u','PGSERVICE','psql'])
            self.assertFalse(any(item.startswith('PGSERVICE=') for item in probe_env))
        for env in ([],['POSTGRES_PASSWORD_FILE=/unadmitted'],
                    ['POSTGRES_PASSWORD=fixture-secret','POSTGRES_PASSWORD_FILE=/unadmitted'],
                    ['POSTGRES_PASSWORD=fixture-secret','POSTGRES_USER_FILE=/unadmitted'],
                    ['POSTGRES_PASSWORD=fixture-secret','POSTGRES_DB_FILE=/unadmitted']):
            record=copy.deepcopy(self.records[0]);record['Config']['Env']=env
            self.assertFalse(ready.supported('postgres',record))
            self.assertIsNone(b.probe_command('postgres',record))



_bootstrap_source_tests=component_test_module("bootstrap_source_tests",zlib.decompress(base64.b64decode('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')).decode())
BootstrapSourceTests=_bootstrap_source_tests.AdapterProtocols
_bootstrap_policy_tests=component_test_module("startup_policy_tests",zlib.decompress(base64.b64decode('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')).decode())
BootstrapStartupPolicyTests=_bootstrap_policy_tests.StartupPolicyTests

"""Actual runner-only Docker wire acceptance; never a production recovery claim."""
import hashlib
import copy
import json
import os
import re
import signal
import subprocess
import time
import uuid


def native_docker_wire_fixture(engine):
    if os.getuid() != 0 or os.geteuid() != 0:
        raise AssertionError('real Docker fixture requires root, no synthetic fallback')
    image = os.environ.get('PC_CROP_FIXTURE_POSTGRES_IMAGE', '')
    if not re.fullmatch(r'ghcr\.io/pachaninm-lab/ci-postgres@sha256:[0-9a-f]{64}', image):
        raise AssertionError('verified mirrored PostgreSQL fixture image is required')
    marker = 'pc-bootstrap-wire-' + uuid.uuid4().hex
    volume, network, name = marker + '-data', marker + '-net', marker + '-pg'
    label = 'pc.fixture.bootstrap-wire=' + marker
    identity = None
    made_volume = made_network = False
    previous_signals = {sig: signal.getsignal(sig) for sig in (signal.SIGTERM, signal.SIGINT)}
    def interrupted(_signal, _frame):
        raise RuntimeError('native fixture interrupted; owned cleanup required')
    for sig in previous_signals:
        signal.signal(sig, interrupted)
    def docker(*args, timeout=8):
        result = subprocess.run(['docker', *args], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=timeout, check=True)
        return result.stdout
    def inspect_fixture(kind, reference):
        values = json.loads(docker(kind, 'inspect', reference))
        if type(values) is not list or len(values) != 1:
            raise AssertionError('fixture inspection identity')
        return values[0]
    try:
        inspected = json.loads(docker('image', 'inspect', image))
        if len(inspected) != 1 or image not in (inspected[0].get('RepoDigests') or []):
            raise AssertionError('fixture image digest not verified')
        image_id = inspected[0]['Id']
        if not re.fullmatch(r'sha256:[0-9a-f]{64}', image_id):
            raise AssertionError('fixture image ID')
        docker('volume', 'create', '--label', label, volume)
        made_volume = True
        docker('network', 'create', '--internal', '--label', label, network)
        made_network = True
        api = engine.LocalDocker()
        before_volumes = {row['Name'] for row in api.get('/volumes')['Volumes']}
        secret = uuid.uuid4().hex
        body = copy.deepcopy(inspected[0]['Config'])
        env = dict(item.split('=', 1) for item in body.get('Env') or [])
        env.update(POSTGRES_USER='fixture', POSTGRES_DB='fixture', POSTGRES_PASSWORD=secret,
                   PGDATA='/var/lib/postgresql/data')
        body['Env'] = [key + '=' + value for key, value in env.items()]
        body['Image'] = image_id
        body['Labels'] = {**(body.get('Labels') or {}), engine.OP_LABEL: engine.OP,
                          engine.ROLE_LABEL: 'postgres', 'pc.fixture.bootstrap-wire': marker}
        body['HostConfig'] = {'RestartPolicy': {'Name': 'no', 'MaximumRetryCount': 0},
                              'NetworkMode': network, 'Runtime': 'runc',
                              'LogConfig': {'Type': 'json-file', 'Config': {}},
                              'Privileged': False, 'AutoRemove': False,
                              'PublishAllPorts': False, 'ReadonlyRootfs': False,
                              'Mounts': [{'Type': 'volume', 'Source': volume,
                                          'Target': '/var/lib/postgresql/data', 'ReadOnly': False,
                                          'VolumeOptions': {'NoCopy': True}}]}
        network_id = inspect_fixture('network', network)['Id']
        body['NetworkingConfig'] = {'EndpointsConfig': {network: {'NetworkID': network_id, 'Aliases': ['fixture-pg']}}}
        record = {'Config': copy.deepcopy({k: v for k, v in body.items() if k not in ('HostConfig', 'NetworkingConfig')}),
                  'HostConfig': copy.deepcopy(body['HostConfig']),
                  'NetworkSettings': {'Networks': {network: {'NetworkID': network_id, 'Aliases': ['fixture-pg']}}}}
        plan = {'role': 'postgres', 'name': name, 'body': body, 'image': image_id, 'record': record}
        api.admit([plan])
        for action in (lambda: api.start('f' * 64), lambda: api.stop('f' * 64)):
            try:
                action()
            except engine.Refusal:
                pass
            else:
                raise AssertionError('unowned Docker operation accepted')
        identity = api.create(name, body)
        if not api.created_clean(identity):
            raise AssertionError('native Docker create warnings')
        engine.verify_created(api, plan, identity)
        created = api.get('/containers/' + identity + '/json')
        mount_policy = created.get('HostConfig', {}).get('Mounts') or []
        if len(mount_policy) != 1 or mount_policy[0].get('VolumeOptions', {}).get('NoCopy') is not True:
            raise AssertionError('native Docker did not retain explicit NoCopy policy')
        actual = created.get('Mounts')
        if len(actual) != 1 or actual[0]['Type'] != 'volume' or actual[0]['Name'] != volume:
            raise AssertionError('anonymous or unexpected native volume')
        if {row['Name'] for row in api.get('/volumes')['Volumes']} != before_volumes:
            raise AssertionError('native create added an anonymous volume')
        api.start(identity)
        readiness = engine.NativeReadiness('xn----8sbjf4befbjgs9b.xn--p1ai', '195.19.12.120')
        if not readiness('postgres', identity, record, api, time.monotonic() + 90):
            raise AssertionError('real PostgreSQL SQL probe did not become ready')
        # Real libpq16 negative control: empty PGSERVICE is a service name,
        # not an unset variable. Keep output private and assert only a closed
        # fixture result. A second real exec checks a hostile inherited service.
        command, probe_env = engine.probe_command('postgres', record)
        if command[:4] != ['/usr/bin/env', '-u', 'PGSERVICE', 'psql']:
            raise AssertionError('native probe must unset inherited PGSERVICE')
        arguments = ['docker', 'exec']
        for variable in [*probe_env, 'PGSERVICE=']:
            arguments.extend(('-e', variable))
        negative = subprocess.run([*arguments, identity, *command[3:]],
                                  stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, timeout=8, check=False)
        if negative.returncode != 2 or b'definition of service "" not found' not in negative.stderr:
            raise AssertionError('native libpq empty-service negative control failed')
        inherited = subprocess.run([*arguments[:-2], '-e', 'PGSERVICE=pc-bootstrap-unadmitted-fixture-service',
                                    identity, *command],
                                   stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, timeout=8, check=False)
        if inherited.returncode != 0:
            raise AssertionError('native probe did not remove inherited service')
        api.stop(identity, seconds=20)
        stopped = api.get('/containers/' + identity + '/json')
        if stopped['State'].get('Running') is not False:
            raise AssertionError('owned native PostgreSQL stop not verified')
        if {row['Name'] for row in api.get('/volumes')['Volumes']} != before_volumes:
            raise AssertionError('native volume inventory drift')
        print('BOOTSTRAP_NATIVE_DOCKER_WIRE_FIXTURE=PASS (isolated runner only; not production acceptance)')
    finally:
        # The production engine has no remove API. These cleanup commands exist
        # only in the runner fixture and require exact random fixture labels.
        if identity is not None:
            current = json.loads(docker('inspect', identity))[0]
            if current.get('Id') != identity or current.get('Config', {}).get('Labels', {}).get('pc.fixture.bootstrap-wire') != marker:
                raise AssertionError('fixture cleanup ownership')
            docker('stop', '--time', '20', identity, timeout=25)
            docker('rm', identity)
        if made_network:
            current = inspect_fixture('network', network)
            if current.get('Labels', {}).get('pc.fixture.bootstrap-wire') != marker:
                raise AssertionError('network cleanup ownership')
            docker('network', 'rm', network)
        if made_volume:
            current = inspect_fixture('volume', volume)
            if current.get('Labels', {}).get('pc.fixture.bootstrap-wire') != marker:
                raise AssertionError('volume cleanup ownership')
            docker('volume', 'rm', volume)
        for sig, handler in previous_signals.items():
            signal.signal(sig, handler)

_startup_observation_tests=component_test_module("startup_observation_tests",zlib.decompress(base64.b64decode('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')).decode())
_startup_observation_tests.__dict__.update({name:globals()[name] for name in ("active_workflow_step","active_payload_literals","component_test_module","_bootstrap_policy_tests","SHA","b")})

class BootstrapControllerTests(_startup_observation_tests.ObservationContracts,unittest.TestCase):
    def test_generated_web_profile_isolated_and_wired_before_startup(self):
        import contextlib, io, sys
        _, shell = active_workflow_step('Restore only the accepted historical core')
        code = shell.split("<<'PY_PAYLOAD'\n", 1)[1].split('\nPY_PAYLOAD\n', 1)[0]
        base = Path(__file__).resolve().parent.parent
        def read(argv):
            return (base / argv[-1].split(':', 1)[1]).read_bytes()
        output = io.StringIO()
        with patch.object(sys, 'argv', ['generator', SHA]), patch('subprocess.check_output', side_effect=read), contextlib.redirect_stdout(output):
            exec(compile(code, '<actual-generator>', 'exec'), {})
        payload = ast.parse(output.getvalue())
        tail = payload.body.pop()
        self.assertIsInstance(tail, ast.Raise)
        ns = {}
        saved = dict(sys.modules)
        try:
            exec(compile(payload, '<generated-payload>', 'exec'), ns)
            old, current, inspector = (ns[k] for k in ('production_stopped_runtime_headroom', 'bootstrap_stopped_runtime_headroom', 'inspector'))
            prior = ('e643540aecc11ff0158fdca743af410e8746bb7ed408c9cc8b5dd3fccb618d65', 'sha256:4a9a5687ef842f091619ba0c442901c1d760bff225231cd4dbc70b411ce74d49')
            new = ('b97bfde412b4652d208cc679e8278d56fa5697588ef112d7c9056cda0ab415e9', 'sha256:74d2304531d758ff945da74f52c80fbc71126f51a8f108555fabdd319c8d4dd8')
            self.assertEqual(set(old.EXPECTED_REFS) - set(current.EXPECTED_REFS), {prior})
            self.assertEqual(set(current.EXPECTED_REFS) - set(old.EXPECTED_REFS), {new})
            self.assertEqual(current.EXPECTED_REFS, inspector.EXPECTED_REFS)
            self.assertIs(current.Host.observe.__globals__['metadata'], current.metadata)
            self.assertIs(current.metadata.__globals__['EXPECTED_REFS'], current.EXPECTED_REFS)
            self.assertIs(inspector.metadata.__globals__['EXPECTED_REFS'], current.EXPECTED_REFS)
            called = []
            def stage(source, api, refs, *args, **kwargs):
                self.assertIs(source.helper, current)
                self.assertIs(source.inspector, inspector)
                self.assertEqual(refs, current.EXPECTED_REFS)
                called.append(True)
                return {'passed': True}
            with patch.object(ns['core_bootstrap'], 'LocalDocker', return_value=object()), patch.object(ns['core_bootstrap'], 'controlled_bootstrap', side_effect=stage), patch.object(sys, 'argv', ['payload', SHA, '1']), patch('os.getuid', return_value=0), patch('os.geteuid', return_value=0), contextlib.redirect_stdout(io.StringIO()):
                result = eval(compile(ast.Expression(tail.exc), '<actual-tail>', 'eval'), ns)
            self.assertEqual(result.code, 0)
            self.assertEqual(called, [True])
        finally:
            for name in set(sys.modules) - set(saved): del sys.modules[name]
            sys.modules.update(saved)

    def test_api_web_revisions_and_old_web_are_not_interchangeable(self):
        import startup_policy as policy
        for role in ('api', 'web'):
            record, image = _bootstrap_policy_tests.fixture(role)
            image['Config']['Labels']['org.opencontainers.image.revision'] = ('a6784252a57a8a5e14f231bc18a64d67ab0fd274' if role == 'web' else '3de749725b270a810f463bef34e6120f22fb7ce7')
            self.assertFalse(policy.startup_safe(role, record, image))
        record, image = _bootstrap_policy_tests.fixture('web')
        record['Image'] = image['Id'] = 'sha256:4a9a5687ef842f091619ba0c442901c1d760bff225231cd4dbc70b411ce74d49'
        self.assertFalse(policy.startup_safe('web', record, image))

    def test_active_owner_route_retires_all_previous_commands(self):
        import re
        from types import SimpleNamespace as NS
        workflow, _ = active_workflow_step('Bind accepted exact main and evidence journal')
        conditions = []
        for job in ('contract', 'recover'):
            block = workflow.split('\n  ' + job + ':\n', 1)[1].split('\n    runs-on:', 1)[0]
            expression = ' '.join(re.search(r'\n    if: >-\n((?:      [^\n]*\n)+)', '\n' + block + '\n')[1].split())
            conditions.append(compile(ast.parse(expression.replace('&&', ' and ').replace('||', ' or '), mode='eval'), '<active-route>', 'eval'))
        def route(event='issue_comment', issue=4637, body='/production restore-historical-core current-main',
                  author='owner', actor='owner', triggering='owner', association='OWNER', result='success'):
            context = {'github': NS(event_name=event, repository_owner='owner', actor=actor, triggering_actor=triggering,
                       event=NS(issue=NS(number=issue), comment=NS(body=body, author_association=association,
                       user=NS(login=author)))), 'needs': NS(contract=NS(result=result))}
            return tuple(bool(eval(code, {'__builtins__': {}}, context)) for code in conditions)
        self.assertEqual(route(), (True, True))
        self.assertEqual(route(body='/production inspect-core-startup current-main'), (True, True))
        self.assertEqual(route(event='pull_request'), (True, False))
        for body in ('/production inspect-stopped-configuration current-main',
                     '/production preserve-stopped-data current-main',
                     '/production preserve-stopped-bindings current-main',
                     '/production validate-stopped-pg16 current-main',
                     '/production restore-historical-core current-main\n'):
            self.assertEqual(route(body=body), (False, False))
        for change in ({'author': 'other'}, {'actor': 'other'}, {'triggering': 'other'}, {'association': 'NONE'},
                       {'result': 'failure'}, {'result': 'skipped'}):
            self.assertEqual(route(**change), (True, False))
        global_part, jobs = workflow.split('\njobs:\n', 1)
        contract, recover = jobs.split('\n  recover:\n', 1)
        self.assertNotIn('secrets.', global_part + contract)
        self.assertNotIn('issues: write', global_part + contract)
        self.assertIn('group: production-full-stack-exact-sha\n      cancel-in-progress: false\n      queue: max', recover)
        self.assertNotIn('COMPOSE_PARSER_FILE', recover)
        self.assertNotIn('urllib.request', recover)
        self.assertIn('timeout-minutes: 25', recover)

    def test_active_profile_is_exact_historical_profile_exercised_by_regressions(self):
        values = active_payload_literals()
        _, shell = workflow_step('Inspect only the accepted stopped configuration')
        code = shell.split("<<'PY_PAYLOAD'\n", 1)[1].split('\nPY_PAYLOAD\n', 1)[0]
        prior = [ast.literal_eval(node.value) for node in ast.parse(code).body if isinstance(node, ast.Assign)
                 and any(isinstance(t, ast.Name) and t.id == 'profile' for t in node.targets)]
        self.assertEqual(values['profile'], prior[0])
        self.assertEqual(tuple(b.CORE), ('postgres', 'redis', 'minio', 'api', 'web', 'caddy'))
        self.assertNotIn('pgbouncer', b.CORE)

    def test_actual_bootstrap_terminal_is_closed_and_never_promotes_release_registration(self):
        _, shell = active_workflow_step('Restore only the accepted historical core')
        code = shell.split("<<'PY_RECORD'\n", 1)[1].split('\nPY_RECORD\n', 1)[0]
        namespace = {}
        exec(compile(code.split('\nimport pathlib, sys\n', 1)[0], '<active-bootstrap-terminal>', 'exec'), namespace)
        validate = namespace['validate_terminal']
        good = {'schemaVersion': 'pc.core-bootstrap.v1', 'targetSha': SHA, 'runId': '12345', 'passed': True,
                'historicalCoreRestored': True, 'exactCurrentMainReleased': False, 'registrationAccepted': False,
                'createdCoreCount': 6, 'quarantinedRecordCount': 5, 'originalArchivesRetained': True,
                'dataRollbackClaimed': False}
        self.assertEqual(validate(json.dumps(good).encode(), SHA, '12345', '0'), good)
        bad_updates = ({'registrationAccepted': True}, {'exactCurrentMainReleased': True},
                       {'dataRollbackClaimed': True}, {'createdCoreCount': True}, {'createdCoreCount': 7},
                       {'quarantinedRecordCount': 4}, {'originalArchivesRetained': False},
                       {'privatePath': 'SYNTHETIC_SECRET'}, {'targetSha': 'b' * 40}, {'runId': '54321'})
        for update in bad_updates:
            with self.subTest(update=update), self.assertRaises(ValueError):
                validate(json.dumps({**good, **update}).encode(), SHA, '12345', '0')
        for status in ('1', '124', '137', '255'):
            with self.subTest(status=status), self.assertRaises(ValueError):
                validate(json.dumps(good).encode(), SHA, '12345', status)
        for malformed in (b'\xff', b' ' * 16385, json.dumps(good)[:-1].encode() + b',"passed":true}'):
            with self.assertRaises((ValueError, UnicodeError)):
                validate(malformed, SHA, '12345', '0')
        failed = {'schemaVersion': 'pc.core-bootstrap.v1', 'targetSha': SHA, 'runId': '12345', 'passed': False,
                  'outcome': 'UNKNOWN', 'errorCode': 'BOOTSTRAP_UNKNOWN_RECONCILIATION_REQUIRED',
                  'exactCurrentMainReleased': False, 'registrationAccepted': False, 'dataRollbackClaimed': False}
        self.assertEqual(validate(json.dumps(failed).encode(), SHA, '12345', '1'), failed)
        with self.assertRaises(ValueError): validate(json.dumps(failed).encode(), SHA, '12345', '0')

    def test_active_bash_transport_rejects_unknown_stale_or_corrupt_success(self):
        _, shell = active_workflow_step('Restore only the accepted historical core')
        # Exercise the CURRENT actual transport/collector, substituting only
        # SSH and GitHub/Git endpoints with isolated local fixture executables.
        suffix = shell.split('\nPY_PAYLOAD\n', 1)[1]
        good = {'schemaVersion': 'pc.core-bootstrap.v1', 'targetSha': SHA, 'runId': '12345', 'passed': True,
                'historicalCoreRestored': True, 'exactCurrentMainReleased': False, 'registrationAccepted': False,
                'createdCoreCount': 6, 'quarantinedRecordCount': 5, 'originalArchivesRetained': True,
                'dataRollbackClaimed': False}
        cases = [(json.dumps(good).encode(), 0, SHA, SHA, True),
                 (json.dumps(good).encode(), 255, SHA, SHA, False),
                 (json.dumps(good).encode(), 124, SHA, SHA, False),
                 (json.dumps(good).encode(), 137, SHA, SHA, False),
                 (json.dumps(good).encode(), 0, 'b' * 40, SHA, False),
                 (json.dumps(good).encode(), 0, SHA, 'b' * 40, False),
                 (b'', 0, SHA, SHA, False), (b'\xff', 0, SHA, SHA, False),
                 (b' ' * 16385, 0, SHA, SHA, False)]
        for raw_value, rc, fetched, remote_api, accepted in cases:
            with self.subTest(rc=rc, fetched=fetched, api=remote_api, payload_bytes=len(raw_value)), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                commands = root / 'bin'
                commands.mkdir()
                programs = {
                    'ssh': "import os,pathlib,sys\nsys.stdout.buffer.write(pathlib.Path(os.environ['FIXTURE_RAW']).read_bytes());sys.exit(int(os.environ['FIXTURE_RC']))\n",
                    'git': "import os,sys\na=sys.argv[1:]\nif a[0]=='fetch':sys.exit(0)\nif a==['rev-parse','origin/main']:print(os.environ['FIXTURE_MAIN'])\nelse:sys.exit(9)\n",
                    'gh': "import os\nprint(os.environ['FIXTURE_API'])\n"}
                for name, program in programs.items():
                    executable = commands / name
                    executable.write_text('#!' + sys.executable + '\n' + program)
                    executable.chmod(0o755)
                output = root / 'evidence'
                output.mkdir()
                raw_file, payload_file, expected = root / 'raw', root / 'payload', root / 'expected'
                payload_file.write_bytes(b'public fixture source only')
                expected.write_bytes(raw_value)
                environment = {**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH'],
                               'TARGET_SHA': SHA, 'GITHUB_RUN_ID': '12345', 'EVIDENCE_DIR': str(output),
                               'GITHUB_REPOSITORY': 'fixture/repo', 'PROD_PORT': '22', 'PROD_HOST': 'fixture.invalid',
                               'SSH_USER_SECRET': 'fixture', 'FIXTURE_RAW': str(expected), 'FIXTURE_RC': str(rc),
                               'FIXTURE_MAIN': fetched, 'FIXTURE_API': remote_api}
                # Quoted shell assignments are confined to generated fixture paths.
                prefix = 'set -Eeuo pipefail\nraw=' + repr(str(raw_file)) + '\npayload=' + repr(str(payload_file)) + '\n'
                result = subprocess.run(['bash', '-c', prefix + suffix], cwd=root, env=environment,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
                self.assertEqual(result.returncode == 0, accepted, result.stderr.decode())
                self.assertEqual((output / 'result.json').exists(), accepted)

    def test_inspector_rejects_types_and_unknown_same_size_carriers(self):
        for raw in (None, '', bytearray(), b'', b'x' * 370287, b'x' * 400684, b'x' * 411656):
            with self.subTest(kind=type(raw).__name__), patch.object(Path, 'read_bytes', return_value=raw):
                with self.assertRaises(AssertionError):
                    inspector_workflow_bytes()

    def test_current_carrier_recovers_entire_accepted_inspector_prefix(self):
        base = Path(__file__).resolve().parent.parent
        raw = inspector_workflow_bytes()
        self.assertEqual(len(raw), 370287)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), '31b39b0436ef704ff8b066cb3f3d4bb9595c6cccdc5abfcd707934ce5d2e2bd7')
        self.assertEqual(hashlib.sha256(raw[:191427]).hexdigest(), '09ae88f0bfcf48b93e5f5dea5302d663d5dd5a709507503701014e4c17d27f5a')

    def test_active_source_binding_requires_new_purpose_and_cannot_borrow_readonly_authority(self):
        import sys
        _, shell = active_workflow_step('Bind accepted exact main and evidence journal')
        code = shell.split("python3 - <<'PY_BIND'\n", 1)[1].split('\nPY_BIND\n', 1)[0]
        fixed = next(ast.literal_eval(node.value) for node in ast.parse(code).body if isinstance(node, ast.Assign)
                     and any(isinstance(t, ast.Name) and t.id == 'expected_purpose' for t in node.targets))
        base = Path(__file__).resolve().parent.parent
        state = json.loads((base / 'docs/platform-v7/autopilot/autopilot-state.json').read_text())
        new_key, old_key, engine_key = ('stopped-core-bootstrap-20261024',
                                      'stopped-configuration-controller-20261024', 'ir20-stopped-copy-source-20261023')
        controller = ['.github/workflows/production-cold-preservation.yml',
                      'scripts/test_production_cold_preservation.py', 'docs/ops/production-cold-preservation.md']
        source_scope = state['approvedConcurrentScopes'][fixed['sourceBranch']]
        engine = state['coordinationAdmissions'][engine_key]
        paths = set(controller) | set(engine['dependencySha256']) | {'.github/workflows/production-docker-headroom-diagnostic.yml'}
        paths.update(pin['path'] for pin in engine['sourcePins'])
        for alteration in ('none', 'only-old-purpose', 'startup-false', 'workers-true', 'release-true',
                           'unknown-key', 'wrong-operation', 'wrong-decision', 'old-startup-true',
                           'source-hash-drift', 'source-mode-drift', 'duplicate-pin', 'source-scope-drift',
                            'inspector-prefix-drift', 'inspector-tail-drift', 'oversized-controller', 'unknown-inspector', 'stale-inspector-pin'):
            with self.subTest(alteration=alteration), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                for path in paths:
                    destination = root / path
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes((base / path).read_bytes())
                    destination.chmod((base / path).stat().st_mode & 0o777)
                purpose = {**copy.deepcopy(fixed),
                    'inspectionSha256': hashlib.sha256((root / '.github/workflows/production-docker-headroom-diagnostic.yml').read_bytes()).hexdigest(),
                    'sourcePins': [
                    {'path': path, 'mode': '100644', 'sha256': hashlib.sha256((root / path).read_bytes()).hexdigest()}
                    for path in controller]}
                value = {'coordinationAdmissions': {new_key: purpose,
                         old_key: copy.deepcopy(state['coordinationAdmissions'][old_key]), engine_key: copy.deepcopy(engine)},
                         'approvedConcurrentScopes': {fixed['sourceBranch']: list(source_scope),
                                                     engine['sourceBranch']: state['approvedConcurrentScopes'][engine['sourceBranch']]}}
                if alteration == 'only-old-purpose': del value['coordinationAdmissions'][new_key]
                if alteration == 'startup-false': purpose['originalStartupAuthorized'] = False
                if alteration == 'workers-true': purpose['workersAuthorized'] = True
                if alteration == 'release-true': purpose['productionAcceptance'] = True
                if alteration == 'unknown-key': purpose['extra'] = True
                if alteration == 'wrong-operation': purpose['operationName'] = 'stopped-configuration-20261024'
                if alteration == 'wrong-decision': purpose['ownerDecision'] = 'candidate-owned'
                if alteration == 'unknown-inspector': purpose['inspectionSha256'] = '0' * 64
                if alteration == 'stale-inspector-pin':
                    purpose['inspectionSha256'] = fixed['inspectionSha256'] if purpose['inspectionSha256'] != fixed['inspectionSha256'] else '1ab465091393a7d59af6d045415b30c7387db6418d7167710a8221793971773f'
                if alteration == 'old-startup-true': value['coordinationAdmissions'][old_key]['originalStartupAuthorized'] = True
                if alteration == 'source-hash-drift': (root / controller[0]).write_bytes(b'drift')
                if alteration == 'source-mode-drift': (root / controller[0]).chmod(0o755)
                if alteration in ('inspector-prefix-drift', 'inspector-tail-drift'):
                    inspector_path = root / '.github/workflows/production-docker-headroom-diagnostic.yml'
                    raw = bytearray(inspector_path.read_bytes())
                    raw[0 if alteration == 'inspector-prefix-drift' else -1] ^= 1
                    inspector_path.write_bytes(raw)
                if alteration == 'oversized-controller':
                    (root / controller[0]).write_bytes(b'x' * 200001)
                    purpose['sourcePins'][0]['sha256'] = hashlib.sha256((root / controller[0]).read_bytes()).hexdigest()
                if alteration == 'duplicate-pin': purpose['sourcePins'].append(dict(purpose['sourcePins'][0]))
                if alteration == 'source-scope-drift': value['approvedConcurrentScopes'][fixed['sourceBranch']].reverse()
                state_path = root / 'docs/platform-v7/autopilot/autopilot-state.json'
                state_path.parent.mkdir(parents=True, exist_ok=True)
                state_path.write_text(json.dumps(value))
                commands = root / 'bin'
                commands.mkdir()
                git = commands / 'git'
                git.write_text('#!' + sys.executable + '\nimport sys\nsys.exit(0 if sys.argv[1:3]==["merge-base","--is-ancestor"] else 9)\n')
                git.chmod(0o755)
                result = subprocess.run([sys.executable, '-c', code], cwd=root,
                                        env={**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH']},
                                        capture_output=True)
                self.assertEqual(result.returncode == 0, alteration == 'none', result.stderr.decode())


    def test_native_runner_daemon_pin_is_confined_and_production_wire_stays_strict(self):
        workflow, shell = active_workflow_step('Pin runner Docker 28.5.1 for the production API wire contract')
        contract, recover = workflow.split('\n  recover:\n', 1)
        for token in ('GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'github-hosted', 'RUNNER_OS', 'x86_64',
                      'https://download.docker.com/linux/static/stable/x86_64/docker-28.5.1.tgz',
                      '82150845', '5c0d19f31fece1accd0358bb8cff591fe25d7b6cba19f0fd412cbfdc07f75ff6',
                      'systemctl stop docker.service docker.socket', 'systemctl start docker.socket docker.service',
                      'v["Version"]=="28.5.1"', 'v["ApiVersion"]=="1.51"'):
            self.assertIn(token, shell)
        self.assertIn('sudo -n install -m 0755 "$native_docker_dir/docker" /usr/bin/docker', shell)
        self.assertIn('sudo -n install -m 0755 "$native_docker_dir/dockerd" /usr/bin/dockerd', shell)
        self.assertNotIn('install -m 0755 "$native_docker_dir/containerd"', shell)
        self.assertNotIn('download.docker.com', recover)
        self.assertNotIn('systemctl', recover)
        self.assertIn("conn.request(method, '/v1.51' + path", active_payload_literals()['bootstrap_engine'])
        self.assertNotIn('DOCKER_API_VERSION', workflow)
        self.assertIn('timeout-minutes: 6', contract)

class BootstrapNativeWireTests(unittest.TestCase):
    def test_real_runner_postgresql_docker_wire_without_anonymous_volume(self):
        if not REQUIRE_NATIVE_DOCKER:
            raise unittest.SkipTest('real Docker wire fixture is mandatory in native workflow, not local synthetic PASS')
        native_docker_wire_fixture(b)

if __name__ == '__main__':
    unittest.main()
