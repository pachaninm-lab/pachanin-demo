#!/usr/bin/env python3
"""Rejection tests for the additional classifier, not FGIS/provider acceptance."""
import contextlib
import argparse
import hashlib
import importlib.util
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('routing_compat', ROOT / 'scripts/verify-pc-crop-07b-routing-compat.py')
CLASSIFIER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CLASSIFIER)
BASE = '1' * 40
HEAD = '2' * 40


class RoutingCompatibility(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.evidence = Path(self.temporary.name)
        self.env = dict(EVENT_NAME='pull_request', GITHUB_HEAD_REF=CLASSIFIER.BRANCH,
                        EXACT_HEAD=HEAD, PINNED_SCOPE_BASE='origin/main')
        self.calls = {}
        self.calls[('rev-parse', 'origin/main^{commit}')] = (BASE + '\n').encode()
        self.calls[('rev-parse', 'HEAD^{commit}')] = (HEAD + '\n').encode()
        self.calls[('merge-base', '--is-ancestor', BASE, HEAD)] = b''
        self.calls[('diff', '--no-renames', '--name-only', '-z', BASE, HEAD)] = b''.join(
            path.encode() + b'\0' for path in CLASSIFIER.PATHS)
        for path, before, after in (*CLASSIFIER.PINS, (CLASSIFIER.MANIFEST, CLASSIFIER.MANIFEST_BLOB,
                                                    CLASSIFIER.MANIFEST_BLOB)):
            for ref, blob in ((BASE, before), (HEAD, after)):
                self.calls[('ls-tree', ref, '--', path)] = f'100644 blob {blob}\t{path}\n'.encode()
        content = (ROOT / CLASSIFIER.MANIFEST).read_bytes()
        # The fixtures use the real immutable accepted manifest, not an invented authority.
        blob = hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()
        self.assertEqual(blob, CLASSIFIER.MANIFEST_BLOB)
        for ref in (BASE, HEAD):
            self.calls[('show', ref + ':' + CLASSIFIER.MANIFEST)] = content
        self.write_evidence('changed-files.txt', CLASSIFIER.PATHS)
        self.write_evidence('out-of-scope.txt', CLASSIFIER.OUTSIDE_PATHS)

    def write_evidence(self, name, paths):
        (self.evidence / name).write_text(''.join(path + '\n' for path in paths))

    def fake_git(self, *args):
        value = self.calls[args]
        if isinstance(value, Exception):
            raise value
        return value

    def verify(self):
        with patch.object(CLASSIFIER, 'git', self.fake_git):
            return CLASSIFIER.verify(self.env, self.evidence)

    def rejects(self):
        with self.assertRaises((ValueError, subprocess.CalledProcessError, KeyError)):
            self.verify()

    def test_exact_pr_vector(self):
        self.assertEqual(self.verify(), (BASE, HEAD))

    def test_exact_main_push_vector(self):
        self.env.update(EVENT_NAME='push', GITHUB_REF='refs/heads/main', GITHUB_HEAD_REF='')
        self.assertEqual(self.verify(), (BASE, HEAD))

    def test_branch_event_and_ref_rejections(self):
        original = self.env.copy()
        for update in [dict(GITHUB_HEAD_REF='fgis/regulatory-truth-ux-20260921'),
                       dict(GITHUB_HEAD_REF=CLASSIFIER.BRANCH + '-extra'),
                       dict(EVENT_NAME='workflow_dispatch'), dict(EVENT_NAME='pull_request_target'),
                       dict(EVENT_NAME='push', GITHUB_REF='refs/heads/other'),
                       dict(EVENT_NAME='push', GITHUB_REF='refs/tags/main')]:
            with self.subTest(update=update):
                self.env = dict(original, **update)
                self.rejects()

    def test_invalid_exact_head(self):
        for head in ['2' * 39, 'G' * 40, HEAD + '\n', '', 'HEAD']:
            with self.subTest(head=head):
                self.env['EXACT_HEAD'] = head
                self.rejects()

    def test_invalid_resolved_base(self):
        self.calls[('rev-parse', 'origin/main^{commit}')] = b'not-a-commit\n'
        self.rejects()

    def test_checkout_head_mismatch(self):
        self.calls[('rev-parse', 'HEAD^{commit}')] = (BASE + '\n').encode()
        self.rejects()

    def test_missing_base_ancestry(self):
        self.calls[('merge-base', '--is-ancestor', BASE, HEAD)] = subprocess.CalledProcessError(1, 'git')
        self.rejects()

    def test_whole_tree_diff_rejections(self):
        key = ('diff', '--no-renames', '--name-only', '-z', BASE, HEAD)
        exact = self.calls[key]
        for diff in [exact + b'.github/workflows/automerge.yml\0',
                     exact + CLASSIFIER.MANIFEST.encode() + b'\0',
                     exact + b'docs/platform-v7/autopilot/autopilot-state.json\0',
                     b'\0'.join(exact.split(b'\0')[1:]), b'',
                     exact.replace(b'apps/web/middleware.ts', b'apps/web/renamed-middleware.ts')]:
            with self.subTest(diff=diff):
                self.calls[key] = diff
                self.rejects()

    def test_forged_partial_reordered_evidence(self):
        for name, paths in [('changed-files.txt', CLASSIFIER.PATHS),
                            ('out-of-scope.txt', CLASSIFIER.OUTSIDE_PATHS)]:
            for altered in [paths[:-1], paths + ['apps/api/extra.ts'], list(reversed(paths))]:
                with self.subTest(name=name, paths=altered):
                    self.write_evidence(name, altered)
                    self.rejects()
            self.write_evidence(name, paths)

    def test_wrong_before_or_after_pin_and_missing_leaf(self):
        for path, _, _ in CLASSIFIER.PINS:
            for ref in (BASE, HEAD):
                key = ('ls-tree', ref, '--', path)
                original = self.calls[key]
                for value in [f'100644 blob {"0" * 40}\t{path}\n'.encode(), b'']:
                    with self.subTest(path=path, ref=ref, missing=not value):
                        self.calls[key] = value
                        self.rejects()
                self.calls[key] = original

    def test_wrong_modes_and_object_types(self):
        for path, _, _ in CLASSIFIER.PINS:
            for ref in (BASE, HEAD):
                key = ('ls-tree', ref, '--', path)
                original = self.calls[key]
                for value in [original.replace(b'100644', b'100755'),
                              original.replace(b'100644', b'120000'),
                              original.replace(b'blob', b'tree')]:
                    with self.subTest(path=path, ref=ref, value=value):
                        self.calls[key] = value
                        self.rejects()
                self.calls[key] = original

    def test_candidate_or_base_manifest_blob_rejected(self):
        for ref in (BASE, HEAD):
            key = ('ls-tree', ref, '--', CLASSIFIER.MANIFEST)
            original = self.calls[key]
            self.calls[key] = original.replace(CLASSIFIER.MANIFEST_BLOB.encode(), b'0' * 40)
            self.rejects()
            self.calls[key] = original

    def test_candidate_manifest_bytes_rejected(self):
        key = ('show', HEAD + ':' + CLASSIFIER.MANIFEST)
        self.calls[key] += b'\n'
        self.rejects()

    def test_missing_evidence_and_transport_failure(self):
        (self.evidence / 'out-of-scope.txt').unlink()
        with self.assertRaises(FileNotFoundError):
            self.verify()
        self.write_evidence('out-of-scope.txt', CLASSIFIER.OUTSIDE_PATHS)
        self.calls[('rev-parse', 'origin/main^{commit}')] = subprocess.CalledProcessError(128, 'git')
        self.rejects()

    def test_cli_failure_is_closed_and_redacted(self):
        output = io.StringIO()
        with patch.dict(os.environ, {}, clear=True), contextlib.redirect_stderr(output):
            self.assertEqual(CLASSIFIER.main(), 1)
        self.assertEqual(output.getvalue(), 'PC_CROP_07B_PINNED_ROUTING_REJECTED\n')


class CombinedCompatibility(unittest.TestCase):
    """The combined vector uses real accepted-manifest bytes and full leaf pins."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.evidence = Path(self.temporary.name)
        self.env = dict(EVENT_NAME='pull_request', GITHUB_HEAD_REF=CLASSIFIER.COMBINED_BRANCH,
                        EXACT_HEAD=HEAD, PINNED_SCOPE_BASE='origin/main')
        self.authority = (ROOT / CLASSIFIER.COMBINED_MANIFEST).read_bytes()
        self.working = self.authority
        self.scope = json.loads(self.authority)
        self.calls = {
            ('rev-parse', '--verify', '--end-of-options', 'origin/main^{commit}'): (BASE + '\n').encode(),
            ('rev-parse', 'HEAD^{commit}'): (HEAD + '\n').encode(),
            ('merge-base', '--is-ancestor', BASE, HEAD): b'',
            ('diff', '--no-renames', '--name-only', '-z', BASE, HEAD): b''.join(
                p.encode() + b'\0' for p in sorted(CLASSIFIER.COMBINED_ALLOWED_PATHS)),
        }
        self.set_authority(self.authority)
        for path in CLASSIFIER.COMBINED_ALLOWED_PATHS:
            self.calls[('ls-tree', HEAD, '--', path)] = f'100644 blob {"3" * 40}\t{path}\n'.encode()
        for pin in self.scope['pinnedCompatibilitySource']:
            # Replay the admitted immutable leaf. Future FGIS edits must not
            # inherit this repair's historical whole-file preservation rule.
            content = subprocess.check_output(['git', 'cat-file', 'blob', pin['afterBlob']], cwd=ROOT)
            self.assertEqual(hashlib.sha256(content).hexdigest(), pin['sha256'])
            self.calls[('ls-tree', HEAD, '--', pin['path'])] = f"100644 blob {pin['afterBlob']}\t{pin['path']}\n".encode()
            self.calls[('show', HEAD + ':' + pin['path'])] = content
        self.write_evidence('changed-files.txt', sorted(CLASSIFIER.COMBINED_ALLOWED_PATHS))
        self.write_evidence('out-of-scope.txt', CLASSIFIER.COMBINED_OUTSIDE_PATHS)

    def set_authority(self, content):
        blob = hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()
        self.working = content
        for ref in (BASE, HEAD):
            self.calls[('show', ref + ':' + CLASSIFIER.COMBINED_MANIFEST)] = content
            self.calls[('ls-tree', ref, '--', CLASSIFIER.COMBINED_MANIFEST)] = \
                f'100644 blob {blob}\t{CLASSIFIER.COMBINED_MANIFEST}\n'.encode()

    def write_evidence(self, name, paths):
        (self.evidence / name).write_text(''.join(path + '\n' for path in paths))

    def fake_git(self, *args):
        value = self.calls[args]
        if isinstance(value, Exception):
            raise value
        return value

    def verify(self):
        with patch.object(CLASSIFIER, 'git', self.fake_git), \
                patch.object(CLASSIFIER, 'regular_working_manifest', return_value=self.working):
            return CLASSIFIER.verify_combined(self.env, self.evidence)

    def rejects(self):
        with self.assertRaises((ValueError, subprocess.CalledProcessError, KeyError)):
            self.verify()

    def test_exact_combined_pr(self):
        self.assertEqual(self.verify(), (BASE, HEAD))

    def test_exact_combined_main_push(self):
        self.env.update(EVENT_NAME='push', GITHUB_REF='refs/heads/main', GITHUB_HEAD_REF='')
        self.assertEqual(self.verify(), (BASE, HEAD))

    def test_other_branch_event_and_ref_reject(self):
        original = self.env.copy()
        for update in [dict(GITHUB_HEAD_REF=CLASSIFIER.BRANCH),
                       dict(GITHUB_HEAD_REF=CLASSIFIER.COMBINED_BRANCH + '-extra'),
                       dict(EVENT_NAME='workflow_dispatch'), dict(EVENT_NAME='pull_request_target'),
                       dict(EVENT_NAME='push', GITHUB_REF='refs/heads/other'),
                       dict(EVENT_NAME='push', GITHUB_REF='refs/tags/main')]:
            with self.subTest(update=update):
                self.env = dict(original, **update)
                self.rejects()

    def test_malformed_and_stale_refs_reject(self):
        original = self.env.copy()
        for head in ['2' * 39, 'G' * 40, HEAD + '\n', '', 'HEAD']:
            self.env = dict(original, EXACT_HEAD=head)
            self.rejects()
        self.env = original
        key = ('rev-parse', '--verify', '--end-of-options', 'origin/main^{commit}')
        for base in ['not-a-commit', HEAD]:
            self.calls[key] = (base + '\n').encode()
            self.rejects()

    def test_checkout_and_nonancestor_reject(self):
        self.calls[('rev-parse', 'HEAD^{commit}')] = (BASE + '\n').encode()
        self.rejects()
        self.calls[('rev-parse', 'HEAD^{commit}')] = (HEAD + '\n').encode()
        self.calls[('merge-base', '--is-ancestor', BASE, HEAD)] = subprocess.CalledProcessError(1, 'git')
        self.rejects()

    def test_complete_tree_rejects_extra_partial_empty_and_renamed(self):
        key = ('diff', '--no-renames', '--name-only', '-z', BASE, HEAD)
        exact = self.calls[key]
        for diff in [b'', exact.split(b'\0', 1)[1], exact + b'apps/api/src/app.module.ts\0',
                     exact + CLASSIFIER.COMBINED_MANIFEST.encode() + b'\0',
                     exact.replace(b'scripts/p7-source-controlled-scope.mjs', b'scripts/renamed.mjs')]:
            self.calls[key] = diff
            self.rejects()

    def test_supplied_scope_evidence_cannot_replace_whole_tree(self):
        for name, paths in [('changed-files.txt', sorted(CLASSIFIER.COMBINED_ALLOWED_PATHS)),
                            ('out-of-scope.txt', CLASSIFIER.COMBINED_OUTSIDE_PATHS)]:
            for altered in [paths[:-1], paths + ['apps/api/extra.ts'], list(reversed(paths))]:
                self.write_evidence(name, altered)
                self.rejects()
            self.write_evidence(name, paths)

    def test_base_head_and_working_authority_must_match(self):
        for ref in (BASE, HEAD):
            key = ('ls-tree', ref, '--', CLASSIFIER.COMBINED_MANIFEST)
            original = self.calls[key]
            for value in [b'', original.replace(b'100644', b'120000'),
                          original.replace(b'blob', b'tree'), original.replace(b'100644', b'100755')]:
                self.calls[key] = value
                self.rejects()
            self.calls[key] = original
        key = ('show', HEAD + ':' + CLASSIFIER.COMBINED_MANIFEST)
        self.calls[key] += b'\n'
        self.rejects()
        self.calls[key] = self.authority
        self.working += b'\n'
        self.rejects()

    def test_wrong_schema_owner_status_branch_or_paths_reject(self):
        for update in [dict(schemaVersion='foreign'), dict(owner='ACCOUNT_2_PRODUCT'),
                       dict(contributor='foreign'), dict(status='retired'), dict(branch='other'),
                       dict(allowedPaths=CLASSIFIER.COMBINED_ALLOWED_PATHS + ['apps/api/src/app.module.ts'])]:
            self.set_authority(json.dumps(dict(self.scope, **update)).encode())
            self.rejects()

    def test_fixed_workflow_and_assertion_pins_cannot_expand(self):
        for index in [0, 3]:
            scope = json.loads(self.authority)
            scope['pinnedCompatibilitySource'][index]['afterBlob'] = '0' * 40
            self.set_authority(json.dumps(scope).encode())
            self.rejects()

    def test_all_source_leaves_require_regular_modes(self):
        for path in CLASSIFIER.COMBINED_ALLOWED_PATHS:
            key = ('ls-tree', HEAD, '--', path)
            original = self.calls[key]
            for value in [b'', original.replace(b'100644', b'100755'),
                          original.replace(b'100644', b'120000'), original.replace(b'blob', b'tree')]:
                self.calls[key] = value
                self.rejects()
            self.calls[key] = original

    def test_all_four_script_workflow_and_test_pins_verified(self):
        for pin in self.scope['pinnedCompatibilitySource']:
            key = ('ls-tree', HEAD, '--', pin['path'])
            original = self.calls[key]
            self.calls[key] = f"100644 blob {'0' * 40}\t{pin['path']}\n".encode()
            self.rejects()
            self.calls[key] = original
            key = ('show', HEAD + ':' + pin['path'])
            original = self.calls[key]
            self.calls[key] += b'\n'
            self.rejects()
            self.calls[key] = original

    def test_missing_evidence_and_git_failure_reject(self):
        (self.evidence / 'out-of-scope.txt').unlink()
        with self.assertRaises(FileNotFoundError):
            self.verify()
        self.write_evidence('out-of-scope.txt', CLASSIFIER.COMBINED_OUTSIDE_PATHS)
        key = ('show', BASE + ':' + CLASSIFIER.COMBINED_MANIFEST)
        self.calls[key] = subprocess.CalledProcessError(128, 'git')
        self.rejects()

    def test_working_authority_must_be_a_regular_file(self):
        file = self.evidence / 'working.json'
        file.write_bytes(self.authority)
        with patch.object(CLASSIFIER, 'COMBINED_MANIFEST', str(file)):
            self.assertEqual(CLASSIFIER.regular_working_manifest(), self.authority)
            file.unlink()
            file.symlink_to(ROOT / 'docs/platform-v7/autopilot/scopes/pc-crop-predecessor-5580-20261011.json')
            with self.assertRaises(ValueError):
                CLASSIFIER.regular_working_manifest()


class AdmittedCompatibilityPreservation(unittest.TestCase):
    """Whole-file preservation belongs only to this admitted compatibility PR."""

    def test_login_assertion_accepts_both_syntaxes_and_rejects_other_destinations(self):
        path = 'apps/web/tests/unit/platformV7IntegrationControlTower.test.ts'
        original = subprocess.check_output(['git', 'show',
            '755eb770b7fcaef0261bf314e30f6edc6306f45d:' + path], cwd=ROOT).decode()
        candidate = (ROOT / path).read_text()
        old_line = '    expect(page).toContain("redirect(\'/platform-v7/login");'
        new_line = '    expect(page).toMatch(/redirect\\([\'"`]\\/platform-v7\\/login\\?/);'
        self.assertEqual(original.count(old_line), 1)
        self.assertEqual(candidate, original.replace(old_line, new_line))
        pattern = re.compile(re.search(r'expect\(page\)\.toMatch\(/(.*)/\);', candidate).group(1))
        for source in ["redirect('/platform-v7/login?next=/platform-v7/integrations');",
                       'redirect(`/platform-v7/login?${target.toString()}`);']:
            self.assertIsNotNone(pattern.search(source))
        for source in ["redirect('/staff/login?next=/platform-v7/integrations');",
                       "redirect('/platform-v7/login-other?next=x');",
                       "redirect('https://example.invalid/platform-v7/login?next=x');",
                       "redirect('/platform-v7/login');", 'return null;']:
            self.assertIsNone(pattern.search(source))

    def test_original_quartet_and_all_substantive_steps_unchanged(self):
        original = subprocess.check_output(['git', 'show',
            '755eb770b7fcaef0261bf314e30f6edc6306f45d:.github/workflows/pc-crop-07b.yml'], cwd=ROOT).decode()
        candidate = (ROOT / '.github/workflows/pc-crop-07b.yml').read_text()
        def quartet(text):
            return text.split("<<'PY_PINNED_TEST_CONFIG'\n", 1)[1].split('\n          PY_PINNED_TEST_CONFIG', 1)[0]
        self.assertEqual(quartet(candidate), quartet(original))
        marker = '      - uses: pnpm/action-setup@v4\n'
        self.assertEqual(candidate.split(marker, 1)[1], original.split(marker, 1)[1])
        self.assertIn('python3 scripts/test-pc-crop-07b-routing-compat.py', candidate)
        self.assertIn('python3 scripts/verify-pc-crop-07b-routing-compat.py', candidate)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-admitted-compatibility', action='store_true',
                        help='also verify the historical preservation constraints of this compatibility PR')
    args = parser.parse_args()
    loader = unittest.defaultTestLoader
    suite = loader.loadTestsFromTestCase(RoutingCompatibility)
    suite.addTests(loader.loadTestsFromTestCase(CombinedCompatibility))
    if args.verify_admitted_compatibility:
        suite.addTests(loader.loadTestsFromTestCase(AdmittedCompatibilityPreservation))
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(main())
