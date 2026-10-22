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
                          "github.event.comment.body == '/production preserve-stopped-data current-main'",
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
        _, source = workflow_step('Execute only the separately accepted cold-preservation stage')
        failed = {'schemaVersion': 'pc.cold-preservation.v1', 'passed': False,
                  'errorCode': 'POST_COPY_RUNTIME_DRIFT', 'runtimeRestored': False,
                  'mutationOutcome': 'RECONCILIATION_REQUIRED_IF_STARTED'}
        cases = [(valid_terminal(), 0, SHA, 'success'), (valid_terminal(), 255, SHA, 'unknown'),
                 (valid_terminal(), 1, SHA, 'unknown'), (valid_terminal(), 0, 'b' * 40, 'unknown'),
                 ({**valid_terminal(), 'injected': 'SYNTHETIC_SECRET'}, 0, SHA, 'unknown'),
                 (failed, 1, SHA, 'failure'), (failed, 0, SHA, 'unknown'), (None, 255, SHA, 'unknown')]
        for value, status, post, outcome in cases:
            with self.subTest(status=status, post=post, outcome=outcome), tempfile.TemporaryDirectory() as name:
                root = Path(name)
                commands = root / 'bin'
                commands.mkdir()
                scripts = root / 'scripts'
                scripts.mkdir()
                for filename in ('production_cold_preservation.py', 'production_stopped_runtime_headroom.py'):
                    (scripts / filename).write_bytes(Path(__file__).with_name(filename).read_bytes())
                output = root / 'evidence'
                output.mkdir()
                fixture = root / 'output'
                fixture.write_text('' if value is None else json.dumps(value))
                programs = {
                    'git': "import os,sys,pathlib\na=sys.argv[1:]\nif a[0]=='fetch':sys.exit(0)\nif a==['rev-parse','origin/main']:print(os.environ['FIXTURE_POST'] if pathlib.Path(os.environ['FIXTURE_DONE']).exists() else os.environ['TARGET_SHA'])\nelse:sys.exit(9)\n",
                    'ssh': "import os,sys,pathlib\npathlib.Path(os.environ['FIXTURE_DONE']).touch()\nsys.stdout.write(pathlib.Path(os.environ['FIXTURE_OUTPUT']).read_text())\nsys.exit(int(os.environ['FIXTURE_STATUS']))\n"}
                for command, code in programs.items():
                    path = commands / command
                    path.write_text('#!' + sys.executable + '\n' + code)
                    path.chmod(0o755)
                env = {**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH'],
                       'TARGET_SHA': SHA, 'GITHUB_RUN_ID': '12345', 'EVIDENCE_DIR': str(output),
                       'SSH_USER_SECRET': 'fixture', 'PROD_HOST': '127.0.0.1', 'PROD_PORT': '1',
                       'FIXTURE_DONE': str(root / 'done'), 'FIXTURE_POST': post,
                       'FIXTURE_STATUS': str(status), 'FIXTURE_OUTPUT': str(fixture)}
                result = subprocess.run(['bash', '-ceu', source], cwd=root, env=env, capture_output=True)
                body = (output / 'issue-record.md').read_text()
                self.assertNotIn('SYNTHETIC_SECRET', body)
                self.assertEqual(result.returncode == 0, outcome == 'success', result.stderr.decode())
                if outcome == 'unknown':
                    self.assertIn('`UNKNOWN`', body)
                    self.assertFalse((output / 'result.json').exists())
                else:
                    self.assertNotIn('`UNKNOWN`', body)
                    self.assertTrue((output / 'result.json').is_file())


if __name__ == '__main__':
    unittest.main()
