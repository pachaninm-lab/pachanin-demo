#!/usr/bin/env bash
# Test evidence rejection only; no model inference, network, Kubernetes or production operations.
set -Eeuo pipefail
python3 -I - "$(dirname "$0")/production-like-kubernetes-independent-review.sh" <<'PY_REVIEW_TEST'
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from unittest import mock

script = Path(sys.argv[1]).read_text()
marker = "<<'PY_INDEPENDENT_REVIEW'\n"
assert script.count(marker) == 1
code = script.split(marker, 1)[1].rsplit('\nPY_INDEPENDENT_REVIEW', 1)[0]
agent = {'__name__': 'source_review_evidence_test'}
exec(compile(code, '<independent-source-review>', 'exec'), agent)
SHA, BASE = 'a' * 40, 'b' * 40
CANARY = 'PRIVATE_ERROR_MUST_NOT_APPEAR'


class ReviewEvidenceTests(unittest.TestCase):
    def setUp(self):
        paths = sorted(agent['PATHS']['5430'])
        self.identity = dict(head=SHA, base=BASE, run_id='1', run_attempt='1')
        self.manifest = dict(self.identity, files=paths, line_counts={p: 10000 for p in paths}, prompt_tokens=100)
        analysis = 'Synthetic schema fixture, not a real independent review. It exercises rejection without making a claim about source correctness. ' * 2
        self.candidate = dict(reviewed_head_sha=SHA, reviewed_base_sha=BASE, verdict='PASS',
            tests_executed=False, deployment_approval=False,
            files=[dict(path=p, analysis=analysis, line_refs=[1]) for p in paths],
            areas={a: analysis for a in agent['AREAS']}, findings=[],
            limitations=['Synthetic schema tests do not execute any independent model review.'])
        self.response = dict(stop_type='eos', truncated=False, tokens_evaluated=100)

    def validate(self):
        self.response['content'] = json.dumps(self.candidate)
        return agent['validate'](self.response, self.manifest)

    def test_complete_candidate_remains_source_only(self):
        value = self.validate()
        self.assertFalse(value['tests_executed'])
        self.assertFalse(value['deployment_approval'])
        self.candidate['verdict'] = 'BLOCKED'
        self.assertEqual(self.validate()['verdict'], 'BLOCKED')

    def test_wrong_refs_or_fabricated_execution_are_rejected(self):
        for key, value in [('reviewed_head_sha', BASE), ('reviewed_base_sha', SHA),
                           ('tests_executed', True), ('deployment_approval', True)]:
            with self.subTest(key=key):
                saved = self.candidate[key]; self.candidate[key] = value
                with self.assertRaises(ValueError): self.validate()
                self.candidate[key] = saved

    def test_context_and_generation_truncation_are_not_review(self):
        for key, value in [('tokens_evaluated', 99), ('tokens_evaluated', True),
                           ('stop_type', 'limit'), ('truncated', True)]:
            with self.subTest(key=key):
                saved = self.response[key]; self.response[key] = value
                with self.assertRaises(ValueError): self.validate()
                self.response[key] = saved

    def test_missing_or_duplicate_file_area_or_invalid_lines_are_rejected(self):
        for mode in ('missing', 'duplicate', 'area', 'analysis', 'line', 'bool-line'):
            with self.subTest(mode=mode):
                saved = copy.deepcopy(self.candidate)
                if mode == 'missing': self.candidate['files'].pop()
                elif mode == 'duplicate': self.candidate['files'][0] = self.candidate['files'][1]
                elif mode == 'area': self.candidate['areas'].pop(next(iter(self.candidate['areas'])))
                elif mode == 'analysis': self.candidate['files'][0]['analysis'] = 'PASS'
                elif mode == 'line': self.candidate['files'][0]['line_refs'] = [10001]
                else: self.candidate['files'][0]['line_refs'] = [True]
                with self.assertRaises(ValueError): self.validate()
                self.candidate = saved

    def test_blocking_finding_must_not_be_pass(self):
        finding = dict(path=self.manifest['files'][0], line=1, severity='P1',
            problem='Synthetic blocking finding for validator tests only.',
            fix='Synthetic correction instruction for validator tests only.')
        self.candidate['findings'] = [finding]
        with self.assertRaises(ValueError): self.validate()
        self.candidate['verdict'] = 'BLOCKED'
        self.validate()
        finding['path'] = 'not-in-reviewed-source'
        with self.assertRaises(ValueError): self.validate()

    def test_malformed_response_and_missing_limitations_are_not_review(self):
        for content in ('not-json', '[]', 'x' * 98305, '{"findings":[{"severity":"P1"}],"findings":[]}'):
            self.response['content'] = content
            with self.assertRaises(ValueError): agent['validate'](self.response, self.manifest)
        self.candidate['limitations'] = []
        with self.assertRaises(ValueError): self.validate()

    def test_safe_failure_classification_excludes_private_messages(self):
        errors = [(urllib.error.HTTPError('https://' + CANARY, 503, CANARY, {}, None), 'HTTP_ERROR'),
                  (TimeoutError(CANARY), 'TIMEOUT'), (ValueError(CANARY), 'INVALID_EVIDENCE'),
                  (subprocess.CalledProcessError(23, CANARY, stderr=CANARY), 'COMMAND_FAILED')]
        for error, expected in errors:
            value = agent['classify'](error)
            self.assertEqual(value['category'], expected)
            self.assertNotIn(CANARY, json.dumps(value))

    def test_interruption_stale_identity_tampering_and_incomplete_cleanup_invalidate_candidate(self):
        self.validate()
        for mode in ('success', 'interrupted', 'stale', 'tamper', 'cleanup', 'missing'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temporary:
                out = Path(temporary)
                material = {'manifest': self.manifest, 'messages': []}
                agent['save'](out / 'input.json', material)
                agent['save'](out / 'response.json', self.response)
                agent['save'](out / 'candidate.json', self.candidate)
                record = dict(self.identity, stage='complete', candidate_valid=True, runtime_cleanup_verified=True,
                    independent_review_accepted=True, merge_authorized=True, production_acceptance=True)
                record['artifact_sha256'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir()}
                if mode == 'stale': record['run_id'] = 'old'
                if mode == 'cleanup': record['runtime_cleanup_verified'] = False
                agent['save'](out / 'evidence.json', record)
                if mode == 'tamper': (out / 'candidate.json').write_text('{}')
                if mode == 'missing': (out / 'response.json').unlink()
                result = agent['finalize'](out, self.identity, 'failure' if mode == 'interrupted' else 'success')
                self.assertEqual(result['candidate_valid'], mode == 'success')
                if mode != 'success': self.assertEqual(result['disposition'], 'NOT_REVIEW')
                for key in ('independent_review_accepted', 'merge_authorized', 'production_acceptance'):
                    self.assertFalse(result[key])

    def test_missing_execution_is_retained_as_not_review(self):
        with tempfile.TemporaryDirectory() as temporary:
            result = agent['finalize'](Path(temporary), self.identity, 'skipped')
            self.assertFalse(result['candidate_valid'])
            self.assertEqual(result['disposition'], 'NOT_REVIEW')

    def test_transport_count_and_capacity_are_bounded_without_retry(self):
        self.assertEqual(code.count("response = api('/completion'"), 1)
        self.assertIn('len(tokens) <= CONTEXT - OUTPUT - MARGIN', code)
        self.assertIn('timeout=1800', code)
        self.assertIn("env={'PATH': os.environ['PATH'], 'HOME': str(work), 'LD_LIBRARY_PATH': str(engines[0].parent)}", code)
        self.assertNotIn('OPENAI_API_KEY', code)
        self.assertNotIn('GH_TOKEN', code)

    def test_real_git_source_packet_is_exact_and_rejects_dirty_or_missing_files(self):
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            clean = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root, env=clean, stderr=subprocess.DEVNULL).decode().strip()
            git('init', '-b', 'main'); git('config', 'user.name', 'fixture'); git('config', 'user.email', 'fixture@example.invalid')
            for path in ('AGENTS.md', *agent['CALLERS']):
                target = root / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_text('synthetic policy/context\n')
            git('add', '.'); git('commit', '-m', 'base'); base = git('rev-parse', 'HEAD')
            for path in agent['PATHS']['5430']:
                target = root / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_text('synthetic candidate\n')
            git('add', '.'); git('commit', '-m', 'candidate'); head = git('rev-parse', 'HEAD')
            try:
                os.chdir(root)
                with mock.patch.dict(os.environ, clean, clear=True):
                    manifest, messages = agent['source_packet'](head, base, '5430')
                    self.assertEqual(manifest['head'], head)
                    self.assertEqual(manifest['files'], sorted(agent['PATHS']['5430']))
                    self.assertIn('COMPLETE DIFF', messages[1]['content'])
                    path = root / agent['PATHS']['5430'][0]
                    path.write_text('dirty\n')
                    with self.assertRaises(ValueError): agent['source_packet'](head, base, '5430')
                    path.unlink()
                    with self.assertRaises(FileNotFoundError): agent['source_packet'](head, base, '5430')
            finally: os.chdir(previous)


unittest.main(argv=['independent-review-evidence'], verbosity=2)
PY_REVIEW_TEST
