#!/usr/bin/env python3
"""Rejection tests for the additional classifier, not FGIS/provider acceptance."""
import contextlib
import argparse
import hashlib
import importlib.util
import io
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
    if args.verify_admitted_compatibility:
        suite.addTests(loader.loadTestsFromTestCase(AdmittedCompatibilityPreservation))
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(main())
