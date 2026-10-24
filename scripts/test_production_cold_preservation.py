#!/usr/bin/env python3
"""Synthetic local files only: no Docker socket, production host or credential."""
import copy
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
import unittest
from unittest.mock import patch

import production_cold_preservation as cold

SHA = 'a' * 40


def workflow_step(name):
    here = Path(__file__).parent
    path = here / 'production-cold-preservation.yml'
    if not path.is_file():
        path = here.parent / '.github/workflows/production-cold-preservation.yml'
    text = path.read_text()
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



def valid_stopped_terminal():
    return {'schemaVersion': 'pc.ir20-stopped-copy.v1', 'targetSha': SHA, 'runId': '12345',
            'passed': True, 'classification': 'ISOLATED_PHYSICAL_COPY_RECOVERY_VERIFIED_NOT_RELEASE_ACCEPTANCE',
            'sourceUnchanged': True, 'runtimeUnchanged': True, 'cloneByteCopyVerified': True,
            'cloneRecoveryVerified': True, 'selectedDatabaseLogicalScan': 'VERIFIED',
            'amcheck': 'SUPPORTED_RELATIONS_VERIFIED', 'checksums': 'VERIFIED', 'disposableCleanup': 'VERIFIED',
            'sourceBinding': 'HISTORICAL_POSTGRES_NOT_CANONICAL_API_VERIFIED',
            'databaseIntegrity': 'NOT_FULLY_ATTESTED', 'runtimeRestored': False, 'startupAuthorized': False,
            'fullDrAcceptance': 'NOT_PROVEN', 'offHostRecovery': 'NOT_ESTABLISHED'}

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

    def test_actual_gnu_tar_gpg_roundtrip_preserves_source_and_private_evidence(self):
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

    def test_actual_workflow_permissions_owner_gate_and_shared_queue(self):
        workflow, _ = workflow_step('Bind accepted exact main and evidence journal')
        global_part, jobs = workflow.split('\njobs:\n', 1)
        contract, recovery = jobs.split('\n  recover:\n', 1)
        self.assertNotIn('secrets.', global_part + contract)
        self.assertNotIn('issues: write', global_part + contract)
        self.assertNotIn('concurrency:', global_part + contract)
        for condition in ["github.event_name == 'issue_comment'", 'github.event.issue.number == 4637',
                          "github.event.comment.body == '/production validate-stopped-pg16 current-main'",
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

    def test_actual_event_binding_rejects_stale_workflow_checkout_and_main(self):
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

    def test_actual_bash_transport_never_publishes_success_for_unknown_outcome(self):
        import sys
        _, source = workflow_step('Execute only the accepted isolated stopped-copy stage')
        valid = valid_stopped_terminal()
        failed = {'schemaVersion': 'pc.ir20-stopped-copy.v1', 'passed': False,
                  'errorCode': 'POST_COPY_RUNTIME_DRIFT', 'runtimeRestored': False, 'startupAuthorized': False,
                  'mutationOutcome': 'RECONCILIATION_REQUIRED_IF_STARTED'}
        cases = [(valid, 0, SHA, SHA, True),
                 ({**valid, 'checksums': 'NOT_ENABLED'}, 0, SHA, SHA, True),
                 (valid, 255, SHA, SHA, False), (valid, 124, SHA, SHA, False),
                 (valid, 137, SHA, SHA, False), (valid, 1, SHA, SHA, False),
                 (valid, 0, 'b' * 40, SHA, False), (valid, 0, SHA, 'b' * 40, False),
                 (failed, 1, SHA, SHA, False), (failed, 0, SHA, SHA, False),
                 (None, 255, SHA, SHA, False), (b'\xff', 0, SHA, SHA, False),
                 (b' ' * 16385, 0, SHA, SHA, False),
                 (json.dumps(valid)[:-1] + ', "passed":true}', 0, SHA, SHA, False)]
        for change in ({'injected': 'SYNTHETIC_SECRET'}, {'targetSha': 'b' * 40}, {'runId': '54321'},
                       {'sourceUnchanged': 1}, {'runtimeUnchanged': False}, {'cloneByteCopyVerified': False},
                       {'cloneRecoveryVerified': False}, {'startupAuthorized': True}, {'runtimeRestored': True},
                       {'checksums': 'NOT_CHECKED'}, {'databaseIntegrity': 'FULL'}, {'fullDrAcceptance': 'PROVEN'},
                       {'offHostRecovery': 'ESTABLISHED'}, {'selectedDatabaseLogicalScan': 'SKIPPED'},
                       {'amcheck': 'SKIPPED'}, {'sourceBinding': 'CANONICAL'}, {'disposableCleanup': 'UNKNOWN'},
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
                engine_path = 'scripts/release/ir20-restore-drill.sh'
                engine = root / engine_path
                engine.parent.mkdir()
                engine.write_text("#!/usr/bin/env bash\npython3 - <<'PY_STOPPED_SOURCE'\n# synthetic transport fixture, never executed\nPY_STOPPED_SOURCE\n")
                state = root / 'docs/platform-v7/autopilot/autopilot-state.json'
                state.parent.mkdir(parents=True)
                state.write_text(json.dumps({'coordinationAdmissions': {'ir20-stopped-copy-source-20261023': {
                    'dependencySha256': deps, 'sourcePins': [{'path': engine_path,
                    'sha256': hashlib.sha256(engine.read_bytes()).hexdigest()}]}}}))
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
                (output / 'result.json').write_text(json.dumps(valid_stopped_terminal()))
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

    def test_actual_binding_archive_roundtrip_preserves_all_sources_and_old_key(self):
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

    def test_actual_owner_binding_route_disables_the_spent_original_command(self):
        import ast
        import re
        from types import SimpleNamespace as NS
        workflow, _ = workflow_step('Bind accepted exact main and evidence journal')
        conditions = []
        for job in ('contract', 'recover'):
            block = workflow.split('\n  ' + job + ':\n', 1)[1].split('\n    runs-on:', 1)[0]
            expression = ' '.join(re.search(r'\n    if: >-\n((?:      [^\n]*\n)+)', '\n' + block + '\n')[1].split())
            conditions.append(compile(ast.parse(expression.replace('&&', ' and ').replace('||', ' or '), mode='eval'), '<route>', 'eval'))
        def route(event='issue_comment', issue=4637, body='/production validate-stopped-pg16 current-main',
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
                       {'body': '/production validate-stopped-pg16 current-main\n'}):
            self.assertEqual(route(**update), (False, False))
        for update in ({'author': 'other'}, {'actor': 'other'}, {'triggering': 'other'}, {'association': 'NONE'},
                       {'result': 'failure'}, {'result': 'skipped'}):
            self.assertEqual(route(**update), (True, False))

    def test_actual_source_binding_rejects_missing_pins_wrong_operation_and_payload_drift(self):
        import sys
        workflow, _ = workflow_step('Bind accepted exact main and evidence journal')
        code = textwrap.dedent(workflow.split("          python3 - <<'PY_BIND'\n", 1)[1].split('          PY_BIND', 1)[0])
        names = ['.github/workflows/production-cold-preservation.yml',
                 'scripts/test_production_cold_preservation.py', 'docs/ops/production-cold-preservation.md']
        dependencies = ['scripts/production_stopped_runtime_headroom.py', 'scripts/production_cold_preservation.py']
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
                       'engine-extra', 'duplicate')
        for alteration in alterations:
            with self.subTest(alteration=alteration), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                for name in names + dependencies:
                    p = root / name
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_bytes((base / name).read_bytes())
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
                    'authorityBaseExactMain': SHA, 'ownerDecision': '#5469#issuecomment-6377184068',
                    'operationName': 'ir20-stopped-copy-20261023', 'isolatedCopyInvocationAuthorized': True,
                    'productionAcceptance': False, 'originalStartupAuthorized': False,
                    'sourcePins': [{'path': name, 'mode': '100644', 'sha256': hashlib.sha256((root / name).read_bytes()).hexdigest()}
                                   for name in names],
                    'limits': 'One serialized no-network volatile PG16 copy. Original runtime, archives and keys retained; no transfer or new cost.'}
                engine = {
                    'authorityBaseExactMain': SHA,
                    'dependencySha256': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in dependencies},
                    'limits': 'Six-path source-only stopped PG16 volatile-copy prerequisite. No host dispatch, original startup, transfer or new cost.',
                    'owner': 'ACCOUNT_1_CORE', 'ownerDecision': '#5469#issuecomment-6354447020',
                    'productionAcceptance': False, 'productionInvocationAuthorized': False,
                    'sourceBranch': 'ops/ir20-isolated-restore-20260919', 'sourcePins': engine_pins,
                    'writerHandoff': '#5469#issuecomment-6368785509'}
                state_value = {'coordinationAdmissions': {'ir20-stopped-copy-controller-20261024': purpose,
                                                         'ir20-stopped-copy-source-20261023': engine},
                               'approvedConcurrentScopes': {purpose['sourceBranch']: source_vector,
                                                            engine['sourceBranch']: engine_names}}
                if alteration == 'missing': del state_value['coordinationAdmissions']['ir20-stopped-copy-controller-20261024']
                if alteration == 'owner': purpose['owner'] = 'OTHER'
                if alteration == 'operation': purpose['operationName'] = cold.BINDINGS_OPERATION
                if alteration == 'decision': purpose['ownerDecision'] = 'candidate-owned'
                if alteration == 'invocation': purpose['isolatedCopyInvocationAuthorized'] = False
                if alteration == 'acceptance': purpose['productionAcceptance'] = True
                if alteration == 'startup': purpose['originalStartupAuthorized'] = True
                if alteration == 'vector': purpose['sourcePins'].append(dict(purpose['sourcePins'][0]))
                if alteration == 'hash': (root / names[0]).write_bytes(b'unadmitted controller')
                if alteration == 'mode': (root / names[0]).chmod(0o755)
                if alteration == 'link':
                    (root / names[0]).unlink()
                    (root / names[0]).symlink_to(base / names[0])
                if alteration == 'dependency': (root / dependencies[0]).write_bytes(b'changed helper')
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



if __name__ == '__main__':
    unittest.main()
