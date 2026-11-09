#!/usr/bin/env bash
# Synthetic Git/Node regression fixtures; no network, Kubernetes or production access.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 -I - "$ROOT" "$@" <<'PY_SOURCE_TEST'
from pathlib import Path
import tempfile, subprocess, os, json, hashlib, zipfile, unittest

import sys, signal, time
from unittest import mock

WORKFLOW = Path(sys.argv.pop(1)) / '.github/workflows/production-like-kubernetes-acceptance.yml'
source = WORKFLOW.read_text()
start = "          python3 -I - <<'PY_SOURCE_PREFLIGHT'\n"
end = "          PY_SOURCE_PREFLIGHT\n"
assert source.count(start) == 1 and source.count(end) == 1
block = source.split(start, 1)[1].split(end, 1)[0]
assert all(not line or line.startswith('          ') for line in block.splitlines())
collector = '\n'.join(line[10:] for line in block.splitlines()) + '\n'
SCRIPT_DIRECTORY = tempfile.TemporaryDirectory(prefix='source-preflight-tests-')
SCRIPT = Path(SCRIPT_DIRECTORY.name) / 'preflight.sh'
SCRIPT.write_text("python3 -I - <<'PY_SOURCE_PREFLIGHT'\n" + collector + end.strip() + '\n')
GUARD = 'scripts/p7-autopilot-guard.sh'
TEST = 'scripts/p7-autopilot-guard.test.mjs'
FIXED = ['AGENTS.md', '.github/workflows/platform-v7-autopilot-guard.yml',
'.github/workflows/production-like-kubernetes-acceptance.yml', GUARD, TEST,
'scripts/p7-source-controlled-scope.mjs', 'docs/platform-v7/autopilot/autopilot-state.json',
'docs/platform-v7/autopilot/scopes/fixture.json']

class SourceBudgetChecks(unittest.TestCase):
    def expected_owned_guard_seconds(self, ref):
        return 420 if ref in ('fix/gekta-k8s-retained-capacity-20261009', 'codex/gekta-security-review', 'test/bank-acceptance-contract-6085', 'fix/bank-acceptance-preflight-budget-6089', 'fix/codeql-v2-26-3-upstream-lock-4072', 'agent/ir-sec-transitive-runtime-remediation', 'fix/gekta-anonymous-document-evidence-20261009') else 300

    def fixture(self, root, test_fail=False, guard_fail=False):
            repo=root/'repo';repo.mkdir();out=root/'runner';out.mkdir()
            def git(*args):
                return subprocess.check_output(['git',*args],cwd=repo,stderr=subprocess.DEVNULL).decode().strip()
            git('init','-b','main');git('config','user.email','fixture@example.invalid');git('config','user.name','fixture')
            for name in FIXED:
                p=repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{}\n')
            (repo/GUARD).write_text('#!/bin/bash\nexit '+str(1 if guard_fail else 0)+'\n')
            (repo/TEST).write_text("import test from 'node:test'; import assert from 'node:assert/strict';\n"
                 + "test('source fixture', () => { assert.equal(1, "+str(2 if test_fail else 1)+"); });\n")
            git('add','.');git('commit','-m','base');base=git('rev-parse','HEAD')
            git('checkout','-b','ir/k8s-production-like-2659');(repo/'AGENTS.md').write_text('public candidate\n')
            git('add','.');git('commit','-m','candidate');head=git('rev-parse','HEAD')
            env=dict(os.environ,EXACT_HEAD=head,EXACT_BASE=base,RUNNER_TEMP=str(out),GITHUB_RUN_ID='123',GITHUB_RUN_ATTEMPT='1',GITHUB_HEAD_REF='ir/k8s-production-like-2659')
            return repo,out,env,git

    def execute_collector(self, behavior='pass', head_ref='fix/public-registration-final-copy-4916',
                          guard_seconds=300, head_repository='fixture/repository',
                          repository='fixture/repository'):
        with tempfile.TemporaryDirectory(prefix='source-budget-contract-') as temp:
            directory = Path(temp)
            repo, out, env, git = self.fixture(directory)
            env.update(GITHUB_HEAD_REF=head_ref, GITHUB_REPOSITORY=repository,
                       SOURCE_BUDGET_HEAD_REPOSITORY=head_repository)
            namespace = {'__name__': 'source_budget_contract_probe'}
            exec(compile(collector, str(WORKFLOW) + ':embedded-python', 'exec'), namespace)
            original_run = subprocess.run
            original_temporary_file = tempfile.TemporaryFile
            calls, raw_files = [], []
            group_proof = {}

            def temporary_file(*args, **kwargs):
                value = original_temporary_file(*args, **kwargs)
                raw_files.append(value)
                return value

            def run_group_timeout(stdout):
                # Scale only the test adapter's clock, after observing the
                # unchanged production --kill-after=5s and selected budget.
                # GNU timeout still signals an actual separate process group.
                probe = directory / 'owned-process-group'
                probe.mkdir()
                child_source = r"""
import json, os, signal, sys, time
from pathlib import Path
root = Path(sys.argv[1])
def stopped(signum, frame):
    (root / 'child.term').write_text(str(signum))
    sys.exit(0)
signal.signal(signal.SIGTERM, stopped)
(root / 'child.json').write_text(json.dumps({'pid': os.getpid(), 'group': os.getpgrp()}))
while True:
    time.sleep(0.01)
"""
                parent_source = r"""
import json, os, signal, subprocess, sys, time
from pathlib import Path
root = Path(sys.argv[1])
child = None
def stopped(signum, frame):
    (root / 'parent.term').write_text(str(signum))
    if child is not None:
        child.wait(timeout=1)
    sys.exit(0)
signal.signal(signal.SIGTERM, stopped)
child = subprocess.Popen([sys.executable, '-c', sys.argv[2], str(root)])
(root / 'parent.json').write_text(json.dumps({'pid': os.getpid(), 'group': os.getpgrp()}))
while True:
    time.sleep(0.01)
"""
                result = original_run(
                    ['timeout', '--kill-after=0.5s', '1s',
                     sys.executable, '-I', '-c', parent_source, str(probe), child_source],
                    stdout=stdout, stderr=subprocess.STDOUT, timeout=4,
                    start_new_session=True,
                )
                parent = json.loads((probe / 'parent.json').read_text())
                child = json.loads((probe / 'child.json').read_text())
                self.assertEqual(result.returncode, 124)
                self.assertEqual(parent['group'], child['group'])
                self.assertNotEqual(parent['group'], os.getpgrp())
                self.assertEqual((probe / 'parent.term').read_text(), str(signal.SIGTERM))
                self.assertEqual((probe / 'child.term').read_text(), str(signal.SIGTERM))
                # The parent reaps the descendant; timeout reaps the parent.
                for process in [parent, child]:
                    with self.assertRaises(ProcessLookupError):
                        os.kill(process['pid'], 0)
                group_proof.update(parent=parent, child=child, exit_code=result.returncode)
                return result

            def run(command, *args, **kwargs):
                if not isinstance(command, list) or not command or command[0] != 'timeout':
                    return original_run(command, *args, **kwargs)
                calls.append({'command': command[:], 'outer_timeout': kwargs.get('timeout')})
                self.assertEqual(command[1], '--kill-after=5s')
                self.assertEqual(kwargs['stderr'], subprocess.STDOUT)
                self.assertEqual(kwargs['env']['BASE_REF'], env['EXACT_BASE'])
                self.assertEqual(kwargs['env']['HEAD_REF'], env['EXACT_HEAD'])
                guard = command[3:] == ['node', '--test', '--test-reporter=tap', TEST]
                branch = command[3:] == ['bash', GUARD]
                self.assertTrue(guard or branch)
                self.assertEqual(command[2], str(guard_seconds) + 's' if guard else '180s')
                self.assertEqual(kwargs['timeout'], guard_seconds + 15 if guard else 195)
                if guard and behavior == 'outer-timeout':
                    kwargs['stdout'].write(b'do-not-publish\n')
                    raise subprocess.TimeoutExpired(command, kwargs['timeout'])
                if guard and behavior == 'guard-timeout':
                    return run_group_timeout(kwargs['stdout'])
                if branch and behavior == 'branch-timeout':
                    return subprocess.CompletedProcess(command, 124)
                if guard and behavior in ('header-only', 'skipped-tap', 'inconsistent-tap', 'cancelled-tap', 'failed-tap'):
                    payloads = {
                        'header-only': b'TAP version 13\n',
                        'skipped-tap': b'TAP version 13\n1..1\n# tests 1\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 1\n',
                        'inconsistent-tap': b'TAP version 13\n1..2\n# tests 2\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n',
                        'cancelled-tap': b'TAP version 13\n1..1\n# tests 1\n# pass 0\n# fail 0\n# cancelled 1\n# skipped 0\n',
                        'failed-tap': b'TAP version 13\nnot ok 1 - source fixture\n1..1\n# tests 1\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n',
                    }
                    kwargs['stdout'].write(payloads[behavior])
                    return subprocess.CompletedProcess(command, 0)
                if guard:
                    kwargs['stdout'].write(
                        b'TAP version 13\n1..1\n# tests 1\n# pass 1\n# fail 0\n'
                        b'# cancelled 0\n# skipped 0\n'
                    )
                return subprocess.CompletedProcess(command, 0)

            previous_directory = Path.cwd()
            try:
                os.chdir(repo)
                with mock.patch.dict(os.environ, env), \
                     mock.patch.object(subprocess, 'run', run), \
                     mock.patch.object(tempfile, 'TemporaryFile', temporary_file):
                    if behavior == 'outer-timeout':
                        with self.assertRaises(subprocess.TimeoutExpired):
                            namespace['main']()
                    elif behavior in ('guard-timeout', 'branch-timeout', 'header-only', 'skipped-tap', 'inconsistent-tap', 'cancelled-tap', 'failed-tap'):
                        with self.assertRaisesRegex(ValueError, 'SOURCE_PREFLIGHT_REJECTED'):
                            namespace['main']()
                    else:
                        namespace['main']()
            finally:
                os.chdir(previous_directory)
            self.assertTrue(raw_files)
            self.assertTrue(all(value.closed for value in raw_files))
            artifact = out / 'ir20-source-preflight'
            report = json.loads((artifact / 'report.json').read_text())
            self.assertFalse(report['independent_review'])
            self.assertFalse(report['production_acceptance'])
            self.assertNotIn('do-not-publish', json.dumps(report))
            self.assertEqual(report['head'], env['EXACT_HEAD'])
            self.assertEqual(report['base'], env['EXACT_BASE'])
            archive_path = artifact / 'public-sources.zip'
            self.assertEqual(hashlib.sha256(archive_path.read_bytes()).hexdigest(),
                             report['source_zip_sha256'])
            with zipfile.ZipFile(archive_path) as archive:
                self.assertEqual(len(archive.namelist()), len(report['sources']))
                for entry in report['sources']:
                    raw = archive.read(entry['ref'] + '/' + entry['path'])
                    self.assertEqual(hashlib.sha256(raw).hexdigest(), entry['sha256'])
                    self.assertEqual(hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest(),
                                     entry['blob'])
            self.assertCountEqual([path.name for path in artifact.iterdir()],
                                  ['report.json', 'public-sources.zip'])
            return report, calls, group_proof

    def test_named_owned_refs_keep_300_except_admitted_measured_pair(self):
        for ref in ['fix/public-registration-final-copy-4916', 'fix/guard-fixture-compression-20261028', 'product/r1-role-mode-consumer-20260921', 'ops/ir20-api-database-binding-20260919', 'ops/production-api-only-release-20261101', 'fix/gekta-lexical-context-20261101', 'fix/gekta-latest-history-20261101', 'fix/gekta-lab-relevance-20261101', 'fix/gekta-freshness-word-boundaries-20261101', 'fix/gekta-document-text-fidelity-20261101', 'fix/gekta-first-prompt-consent-20261101', 'fix/gekta-source-preflight-budget-20261101', 'fix/gekta-security-capture-20261101', 'fix/gekta-k8s-retained-capacity-20261009', 'codex/gekta-security-review', 'fix/gekta-han-stream-20260927', 'fix/gekta-economic-safety-hardening-20260928', 'feat/pc-crop-multi-bank-sber-authority-4997', 'test/bank-acceptance-contract-6085', 'fix/bank-acceptance-preflight-budget-6089']:
            with self.subTest(ref=ref):
                report, calls, _ = self.execute_collector(head_ref=ref, guard_seconds=self.expected_owned_guard_seconds(ref))
                self.assertEqual(report['result'], 'PASS')
                self.assertEqual(report['stage'], 'complete')
                self.assertEqual(len(calls), 2)
                self.assertEqual([check['exit_code'] for check in report['checks']], [0, 0])
                self.assertEqual(report['checks'][0]['tap_totals']['tests'], 1)

    def test_other_and_empty_refs_keep_guard_180_outer_195(self):
        for ref in ['ir/k8s-production-like-2659', '', 'product/r1-role-mode-consumer-20260921-extra', 'ops/ir20-api-database-binding-20260919-extra', 'ops/production-api-only-release-20261101-extra', 'fix/gekta-lexical-context-20261101-extra', 'fix/gekta-latest-history-20261101-extra', 'fix/gekta-lab-relevance-20261101-extra', 'fix/gekta-freshness-word-boundaries-20261101-extra', 'fix/gekta-document-text-fidelity-20261101-extra', 'fix/gekta-first-prompt-consent-20261101-extra', 'fix/gekta-source-preflight-budget-20261101-extra', 'fix/gekta-security-capture-20261101-extra', 'fix/gekta-k8s-retained-capacity-20261009-extra', 'codex/gekta-security-review-extra', 'fix/gekta-han-stream-20260927-extra', 'fix/gekta-economic-safety-hardening-20260928-extra', 'feat/pc-crop-multi-bank-sber-authority-4997-extra', 'test/bank-acceptance-contract-6085-extra', 'fix/bank-acceptance-preflight-budget-6089-extra']:
            with self.subTest(ref=ref):
                report, calls, _ = self.execute_collector(head_ref=ref, guard_seconds=180)
                self.assertEqual(report['result'], 'PASS')
                self.assertEqual(calls[0]['outer_timeout'], 195)

    def test_fork_name_collision_and_missing_identity_keep_original_budget(self):
        for ref in ['fix/public-registration-final-copy-4916', 'fix/guard-fixture-compression-20261028', 'product/r1-role-mode-consumer-20260921', 'ops/ir20-api-database-binding-20260919', 'ops/production-api-only-release-20261101', 'fix/gekta-lexical-context-20261101', 'fix/gekta-latest-history-20261101', 'fix/gekta-lab-relevance-20261101', 'fix/gekta-freshness-word-boundaries-20261101', 'fix/gekta-document-text-fidelity-20261101', 'fix/gekta-first-prompt-consent-20261101', 'fix/gekta-source-preflight-budget-20261101', 'fix/gekta-security-capture-20261101', 'fix/gekta-k8s-retained-capacity-20261009', 'codex/gekta-security-review', 'fix/gekta-han-stream-20260927', 'fix/gekta-economic-safety-hardening-20260928', 'feat/pc-crop-multi-bank-sber-authority-4997', 'test/bank-acceptance-contract-6085', 'fix/bank-acceptance-preflight-budget-6089']:
            for head_repo, repo in [('fork/repository', 'fixture/repository'), ('', '')]:
                with self.subTest(ref=ref, head_repository=head_repo, repository=repo):
                    report, calls, _ = self.execute_collector(head_ref=ref, guard_seconds=180,
                        head_repository=head_repo, repository=repo)
                    self.assertEqual(report['result'], 'PASS')
                    self.assertEqual(calls[0]['outer_timeout'], 195)

    def test_guard_timeout_124_kills_owned_group_and_keeps_scope_and_artifact(self):
        for ref in ['fix/public-registration-final-copy-4916', 'fix/guard-fixture-compression-20261028', 'product/r1-role-mode-consumer-20260921', 'ops/ir20-api-database-binding-20260919', 'ops/production-api-only-release-20261101', 'fix/gekta-lexical-context-20261101', 'fix/gekta-latest-history-20261101', 'fix/gekta-lab-relevance-20261101', 'fix/gekta-freshness-word-boundaries-20261101', 'fix/gekta-document-text-fidelity-20261101', 'fix/gekta-first-prompt-consent-20261101', 'fix/gekta-source-preflight-budget-20261101', 'fix/gekta-security-capture-20261101', 'fix/gekta-k8s-retained-capacity-20261009', 'codex/gekta-security-review', 'fix/gekta-han-stream-20260927', 'fix/gekta-economic-safety-hardening-20260928', 'feat/pc-crop-multi-bank-sber-authority-4997', 'test/bank-acceptance-contract-6085', 'fix/bank-acceptance-preflight-budget-6089']:
            with self.subTest(ref=ref):
                report, calls, group = self.execute_collector('guard-timeout', head_ref=ref, guard_seconds=self.expected_owned_guard_seconds(ref))
                self.assertEqual(report['result'], 'FAIL')
                self.assertEqual(len(calls), 2)
                self.assertEqual(group['exit_code'], 124)
                self.assertEqual([check['exit_code'] for check in report['checks']], [124, 0])

    def test_branch_timeout_keeps_180_outer_195_and_cannot_pass(self):
        for ref in ['fix/public-registration-final-copy-4916', 'fix/guard-fixture-compression-20261028', 'product/r1-role-mode-consumer-20260921', 'ops/ir20-api-database-binding-20260919', 'ops/production-api-only-release-20261101', 'fix/gekta-lexical-context-20261101', 'fix/gekta-latest-history-20261101', 'fix/gekta-lab-relevance-20261101', 'fix/gekta-freshness-word-boundaries-20261101', 'fix/gekta-document-text-fidelity-20261101', 'fix/gekta-first-prompt-consent-20261101', 'fix/gekta-source-preflight-budget-20261101', 'fix/gekta-security-capture-20261101', 'fix/gekta-k8s-retained-capacity-20261009', 'codex/gekta-security-review', 'fix/gekta-han-stream-20260927', 'fix/gekta-economic-safety-hardening-20260928', 'feat/pc-crop-multi-bank-sber-authority-4997', 'test/bank-acceptance-contract-6085', 'fix/bank-acceptance-preflight-budget-6089']:
            with self.subTest(ref=ref):
                report, calls, _ = self.execute_collector('branch-timeout', head_ref=ref, guard_seconds=self.expected_owned_guard_seconds(ref))
                self.assertEqual(report['result'], 'FAIL')
                self.assertEqual(len(calls), 2)
                self.assertEqual([check['exit_code'] for check in report['checks']], [0, 124])

    def test_outer_guard_timeout_retains_failed_bound_artifact_and_closes_raw_file(self):
        for ref in ['fix/public-registration-final-copy-4916', 'fix/guard-fixture-compression-20261028', 'product/r1-role-mode-consumer-20260921', 'ops/ir20-api-database-binding-20260919', 'ops/production-api-only-release-20261101', 'fix/gekta-lexical-context-20261101', 'fix/gekta-latest-history-20261101', 'fix/gekta-lab-relevance-20261101', 'fix/gekta-freshness-word-boundaries-20261101', 'fix/gekta-document-text-fidelity-20261101', 'fix/gekta-first-prompt-consent-20261101', 'fix/gekta-source-preflight-budget-20261101', 'fix/gekta-security-capture-20261101', 'fix/gekta-k8s-retained-capacity-20261009', 'codex/gekta-security-review', 'fix/gekta-han-stream-20260927', 'fix/gekta-economic-safety-hardening-20260928', 'feat/pc-crop-multi-bank-sber-authority-4997', 'test/bank-acceptance-contract-6085', 'fix/bank-acceptance-preflight-budget-6089']:
            with self.subTest(ref=ref):
                report, calls, _ = self.execute_collector('outer-timeout', head_ref=ref, guard_seconds=self.expected_owned_guard_seconds(ref))
                self.assertEqual(report['result'], 'FAIL')
                self.assertEqual(report['stage'], 'guard-regressions')
                self.assertEqual(len(calls), 1)
                self.assertEqual(calls[0]['outer_timeout'], self.expected_owned_guard_seconds(ref) + 15)
                self.assertEqual(report['checks'], [])

    def test_measured_pair_exact_names_and_repository_controls(self):
        positive = ['fix/gekta-k8s-retained-capacity-20261009', 'codex/gekta-security-review']
        for ref in positive:
            with self.subTest(ref=ref):
                report, calls, _ = self.execute_collector(head_ref=ref, guard_seconds=420)
                self.assertEqual(report['result'], 'PASS')
                self.assertEqual(calls[0]['outer_timeout'], 435)
                self.assertEqual(report['checks'][0]['budget_seconds'], 420)
                self.assertEqual(report['checks'][0]['outer_timeout_seconds'], 435)
                self.assertGreaterEqual(report['checks'][0]['elapsed_ms'], 0)
                self.assertEqual(report['checks'][1]['budget_seconds'], 180)
                self.assertEqual(report['checks'][1]['outer_timeout_seconds'], 195)
        for ref, head_repo, repo in [
            ('CODEX/GEKTA-SECURITY-REVIEW','fixture/repository','fixture/repository'),
            ('codex/gekta-security-review ','fixture/repository','fixture/repository'),
            ('prefix/codex/gekta-security-review','fixture/repository','fixture/repository'),
            ('codex/gekta-security-review-extra','fixture/repository','fixture/repository'),
            ('codex/gekta-security-review','fixture/repository/','fixture/repository'),
            ('codex/gekta-security-review','Fixture/repository','fixture/repository'),
            ('codex/gekta-security-review','fork/repository','fixture/repository'),
            ('codex/gekta-security-review','',''),
        ]:
            with self.subTest(ref=ref, head=head_repo, repo=repo):
                report, calls, _ = self.execute_collector(head_ref=ref, guard_seconds=180,
                    head_repository=head_repo, repository=repo)
                self.assertEqual(report['result'], 'PASS')
                self.assertEqual(calls[0]['outer_timeout'], 195)

    def test_bank_acceptance_refs_have_bounded_same_repository_budget(self):
        for ref in ['test/bank-acceptance-contract-6085', 'fix/bank-acceptance-preflight-budget-6089']:
            with self.subTest(ref=ref):
                report, calls, _ = self.execute_collector(head_ref=ref, guard_seconds=420)
                self.assertEqual(report['result'], 'PASS')
                self.assertEqual([c['budget_seconds'] for c in report['checks']], [420, 180])
                self.assertEqual([c['outer_timeout_seconds'] for c in report['checks']], [435, 195])
                self.assertEqual([c['outer_timeout'] for c in calls], [435, 195])
            for candidate, head_repo, repo in [
                (ref + '-extra', 'fixture/repository', 'fixture/repository'),
                (ref.upper(), 'fixture/repository', 'fixture/repository'),
                ('prefix/' + ref, 'fixture/repository', 'fixture/repository'),
                (ref + ' ', 'fixture/repository', 'fixture/repository'),
                (ref, 'fork/repository', 'fixture/repository'),
                (ref, 'fixture/repository/', 'fixture/repository'),
                (ref, '', ''),
            ]:
                with self.subTest(ref=candidate, head=head_repo, repo=repo):
                    report, calls, _ = self.execute_collector(head_ref=candidate, guard_seconds=180,
                        head_repository=head_repo, repository=repo)
                    self.assertEqual(report['result'], 'PASS')
                    self.assertEqual([c['budget_seconds'] for c in report['checks']], [180, 180])
                    self.assertEqual([c['outer_timeout'] for c in calls], [195, 195])

    def test_incomplete_skipped_and_inconsistent_tap_cannot_pass(self):
        for behavior in ['header-only','skipped-tap','inconsistent-tap']:
            with self.subTest(behavior=behavior):
                report, calls, _ = self.execute_collector(behavior,
                    head_ref='codex/gekta-security-review', guard_seconds=420)
                self.assertEqual(report['result'], 'FAIL')
                self.assertEqual([c['exit_code'] for c in report['checks']], [0,0])
                self.assertEqual(report['checks'][0]['budget_seconds'], 420)

    def test_workflow_retains_job_bounds_and_always_artifact_step(self):
        preflight = source.split('\n  source-preflight:\n', 1)[1].split(
            '\n  production-like-kubernetes:\n', 1)[0]
        runtime = source.split('\n  production-like-kubernetes:\n', 1)[1].split(
            '\n  production-like-kubernetes-gate:\n', 1)[0]
        self.assertIn('    timeout-minutes: ' + '$' + "{{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.id == github.event.repository.id && (github.event.pull_request.head.ref == 'fix/gekta-k8s-retained-capacity-20261009' || github.event.pull_request.head.ref == 'codex/gekta-security-review' || github.event.pull_request.head.ref == 'test/bank-acceptance-contract-6085' || github.event.pull_request.head.ref == 'fix/bank-acceptance-preflight-budget-6089' || github.event.pull_request.head.ref == 'fix/codeql-v2-26-3-upstream-lock-4072' || github.event.pull_request.head.ref == 'agent/ir-sec-transitive-runtime-remediation' || github.event.pull_request.head.ref == 'fix/gekta-anonymous-document-evidence-20261009') && 10 || 8 }}\n", preflight)
        job_expression = preflight.split('    timeout-minutes: ', 1)[1].splitlines()[0]
        # This fixed ASCII model follows GitHub's case-insensitive string comparison.
        self.assertTrue(job_expression.isascii())
        self.assertEqual(job_expression, job_expression.lower())
        target = 'fix/gekta-anonymous-document-evidence-20261009'
        for event, ref, head_id, repository_id, expected in [
            ('pull_request', target, 1, 1, 10),
            ('pull_request', target.upper(), 1, 1, 10),
            ('push', target, 1, 1, 8),
            ('pull_request', target, 2, 1, 8),
            ('pull_request', target, None, 1, 8),
            *[('pull_request', ref, 1, 1, 8) for ref in
              ('', target + '-extra', target + '/extra', 'prefix/' + target, target + ' ')],
        ]:
            with self.subTest(event=event, ref=ref, head_id=head_id, repository_id=repository_id):
                expression = job_expression.removeprefix('${{').removesuffix('}}').strip()
                for name, value in {
                    'github.event_name': event, 'github.event.pull_request.head.ref': ref,
                    'github.event.pull_request.head.repo.id': head_id,
                    'github.event.repository.id': repository_id,
                }.items():
                    if isinstance(value, str):
                        self.assertTrue(value.isascii())
                        value = value.lower()
                    expression = expression.replace(name, repr(value))
                self.assertNotIn('github.', expression)
                self.assertEqual(eval(expression.replace('&&', ' and ').replace('||', ' or '),
                                      {'__builtins__': {}}, {}), expected)
        self.assertIn('    timeout-minutes: 300\n', runtime)
        self.assertIn("          node-version: '24.8.0'\n", preflight)
        self.assertIn('      - name: Retain source-bound result without raw errors\n'
                      '        if: always()\n', preflight)
        self.assertIn('          if-no-files-found: error\n', preflight)
        self.assertIn('      - name: Enforce machine-readable Kubernetes evidence\n'
                      '        if: always()\n', runtime)
        self.assertIn('      - name: Enforce exact-head outbox runtime evidence\n'
                      '        if: always()\n', runtime)
        self.assertIn('      - name: Cleanup disposable acceptance environment\n'
                      '        if: always()\n', runtime)


    def test_codeql_provenance_ref_uses_only_the_existing_owned_bounded_class(self):
        ref = 'fix/codeql-v2-26-3-upstream-lock-4072'
        report, calls, _ = self.execute_collector(head_ref=ref, guard_seconds=420)
        self.assertEqual(report['result'], 'PASS')
        self.assertEqual([c['budget_seconds'] for c in report['checks']], [420, 180])
        self.assertEqual([c['outer_timeout'] for c in calls], [435, 195])
        for candidate, head_repo, repo in [
            (ref + '-extra', 'fixture/repository', 'fixture/repository'),
            (ref.upper(), 'fixture/repository', 'fixture/repository'),
            ('prefix/' + ref, 'fixture/repository', 'fixture/repository'),
            (ref + ' ', 'fixture/repository', 'fixture/repository'),
            (ref, 'fork/repository', 'fixture/repository'),
            (ref, 'fixture/repository/', 'fixture/repository'),
            (ref, '', ''),
        ]:
            with self.subTest(ref=candidate, head=head_repo, repository=repo):
                report, calls, _ = self.execute_collector(head_ref=candidate, guard_seconds=180,
                    head_repository=head_repo, repository=repo)
                self.assertEqual(report['result'], 'PASS')
                self.assertEqual([c['budget_seconds'] for c in report['checks']], [180, 180])
                self.assertEqual([c['outer_timeout'] for c in calls], [195, 195])

    def test_codeql_provenance_ref_timeouts_remain_failed_and_preserve_artifacts(self):
        ref = 'fix/codeql-v2-26-3-upstream-lock-4072'
        report, calls, group = self.execute_collector('guard-timeout', head_ref=ref, guard_seconds=420)
        self.assertEqual(report['result'], 'FAIL')
        self.assertEqual(group['exit_code'], 124)
        self.assertEqual([c['exit_code'] for c in report['checks']], [124, 0])
        report, calls, _ = self.execute_collector('branch-timeout', head_ref=ref, guard_seconds=420)
        self.assertEqual(report['result'], 'FAIL')
        self.assertEqual([c['exit_code'] for c in report['checks']], [0, 124])
        self.assertEqual([c['outer_timeout'] for c in calls], [435, 195])
        report, calls, _ = self.execute_collector('outer-timeout', head_ref=ref, guard_seconds=420)
        self.assertEqual(report['result'], 'FAIL')
        self.assertEqual(report['stage'], 'guard-regressions')
        self.assertEqual(report['checks'], [])
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]['outer_timeout'], 435)

    def test_transitive_security_ref_requires_exact_same_repository_identity(self):
        for ref in ('agent/ir-sec-transitive-runtime-remediation', 'fix/gekta-anonymous-document-evidence-20261009'):
            report, calls, _ = self.execute_collector(head_ref=ref, guard_seconds=420)
            self.assertEqual(report['result'], 'PASS')
            self.assertEqual([c['budget_seconds'] for c in report['checks']], [420, 180])
            self.assertEqual([c['outer_timeout'] for c in calls], [435, 195])
            for candidate, head_repo, repo in [
                (ref + '-extra', 'fixture/repository', 'fixture/repository'),
                (ref + '/extra', 'fixture/repository', 'fixture/repository'),
                (ref.upper(), 'fixture/repository', 'fixture/repository'),
                ('prefix/' + ref, 'fixture/repository', 'fixture/repository'),
                (ref + ' ', 'fixture/repository', 'fixture/repository'),
                ('', 'fixture/repository', 'fixture/repository'),
                (ref, 'fork/repository', 'fixture/repository'),
                (ref, 'fixture/repository/', 'fixture/repository'),
                (ref, 'Fixture/repository', 'fixture/repository'),
                (ref, 'fixture/repository', ''),
                (ref, '', 'fixture/repository'),
                (ref, '', ''),
            ]:
                with self.subTest(ref=candidate, head=head_repo, repository=repo):
                    report, calls, _ = self.execute_collector(head_ref=candidate, guard_seconds=180,
                        head_repository=head_repo, repository=repo)
                    self.assertEqual(report['result'], 'PASS')
                    self.assertEqual([c['budget_seconds'] for c in report['checks']], [180, 180])
                    self.assertEqual([c['outer_timeout'] for c in calls], [195, 195])

    def test_transitive_security_timeouts_and_incomplete_tap_still_fail(self):
        for ref in ('agent/ir-sec-transitive-runtime-remediation', 'fix/gekta-anonymous-document-evidence-20261009'):
            for behavior in ('guard-timeout', 'branch-timeout', 'outer-timeout',
                             'header-only', 'skipped-tap', 'inconsistent-tap', 'cancelled-tap', 'failed-tap'):
                with self.subTest(behavior=behavior):
                    report, calls, group = self.execute_collector(
                        behavior, head_ref=ref, guard_seconds=420)
                    self.assertEqual(report['result'], 'FAIL')
                    if behavior == 'guard-timeout':
                        self.assertEqual(group['exit_code'], 124)
                        self.assertEqual([c['exit_code'] for c in report['checks']], [124, 0])
                    elif behavior == 'branch-timeout':
                        self.assertEqual([c['exit_code'] for c in report['checks']], [0, 124])
                    elif behavior == 'outer-timeout':
                        self.assertEqual(report['stage'], 'guard-regressions')
                        self.assertEqual(report['checks'], [])
                        self.assertEqual(len(calls), 1)
                        self.assertEqual(calls[0]['outer_timeout'], 435)


class Checks(unittest.TestCase):
    def fixture(self, root, test_fail=False, guard_fail=False):
        repo=root/'repo';repo.mkdir();out=root/'runner';out.mkdir()
        def git(*args):
            return subprocess.check_output(['git',*args],cwd=repo,stderr=subprocess.DEVNULL).decode().strip()
        git('init','-b','main');git('config','user.email','fixture@example.invalid');git('config','user.name','fixture')
        for name in FIXED:
            p=repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{}\n')
        (repo/GUARD).write_text('#!/bin/bash\nexit '+str(1 if guard_fail else 0)+'\n')
        (repo/TEST).write_text("import test from 'node:test'; import assert from 'node:assert/strict';\n"
             + "test('source fixture', () => { assert.equal(1, "+str(2 if test_fail else 1)+"); });\n")
        git('add','.');git('commit','-m','base');base=git('rev-parse','HEAD')
        git('checkout','-b','ir/k8s-production-like-2659');(repo/'AGENTS.md').write_text('public candidate\n')
        git('add','.');git('commit','-m','candidate');head=git('rev-parse','HEAD')
        env=dict(os.environ,EXACT_HEAD=head,EXACT_BASE=base,RUNNER_TEMP=str(out),GITHUB_RUN_ID='123',GITHUB_RUN_ATTEMPT='1',GITHUB_HEAD_REF='ir/k8s-production-like-2659')
        return repo,out,env,git

    def run_case(self, change=None, **kwargs):
        with tempfile.TemporaryDirectory() as temp:
            repo,out,env,git=self.fixture(Path(temp),**kwargs)
            if change:change(repo,out,env,git)
            r=subprocess.run(['bash',str(SCRIPT)],cwd=repo,env=env,capture_output=True,text=True,timeout=30)
            report=out/'ir20-source-preflight/report.json'
            value=json.loads(report.read_text()) if report.exists() else None
            self.assertNotIn('do-not-publish',r.stdout+r.stderr)
            if value:
                self.assertFalse(value['independent_review']);self.assertFalse(value['production_acceptance'])
            if value and value['result']=='PASS':
                data=(report.parent/'public-sources.zip').read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(),value['source_zip_sha256'])
                with zipfile.ZipFile(report.parent/'public-sources.zip') as z:
                    self.assertEqual(len(z.namelist()),len(value['sources']))
                    for f in value['sources']:
                        raw=z.read(f['ref']+'/'+f['path'])
                        self.assertEqual(hashlib.sha256(raw).hexdigest(),f['sha256'])
                        self.assertEqual(hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),f['blob'])
            return r.returncode,value,r.stdout+r.stderr

    def commit_sized_source(self, repo, env, git, path, size, both_refs=False):
        target = repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b' ' * (size - 3) + b'{}\n')
        git('add', '.'); git('commit', '-m', 'bounded public source fixture')
        if both_refs:
            env['EXACT_BASE'] = git('rev-parse', 'HEAD')
            (repo / 'AGENTS.md').write_text('public next candidate\n')
            git('add', '.'); git('commit', '-m', 'next fixture head')
        env['EXACT_HEAD'] = git('rev-parse', 'HEAD')

    def probe_retained_security_budget(self, branch, repository, head_repository):
        with tempfile.TemporaryDirectory() as temp:
            repo, out, env, git = self.fixture(Path(temp))
            tools = Path(temp) / 'tools'; tools.mkdir()
            log = Path(temp) / 'timeouts.jsonl'
            shim = tools / 'timeout'
            shim.write_text('#!/usr/bin/env python3\n'
                'import json, os, sys\n'
                'with open(os.environ["FIXTURE_TIMEOUT_LOG"], "a") as stream: stream.write(json.dumps(sys.argv[1:]) + "\\n")\n'
                'args = sys.argv[1:]\n'
                'if args and args[0] == "--kill-after=5s": args.pop(0)\n'
                'args.pop(0)\n'
                'os.execvp(args[0], args)\n')
            shim.chmod(0o755)
            env.update(GITHUB_HEAD_REF=branch, GITHUB_REPOSITORY=repository,
                       SOURCE_BUDGET_HEAD_REPOSITORY=head_repository,
                       FIXTURE_TIMEOUT_LOG=str(log), PATH=str(tools)+os.pathsep+env['PATH'])
            result = subprocess.run(['bash', str(SCRIPT)], cwd=repo, env=env,
                                    capture_output=True, text=True, timeout=30)
            report = json.loads((out/'ir20-source-preflight/report.json').read_text())
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(report['result'], 'PASS')
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            self.assertEqual(len(calls), 2)
            self.assertEqual(calls[0][2:], ['node', '--test', '--test-reporter=tap', TEST])
            self.assertEqual(calls[1], ['--kill-after=5s', '180s', 'bash', GUARD])
            self.assertEqual([c['name'] for c in report['checks']], ['guard-regressions','branch-scope'])
            self.assertEqual(report['checks'][0]['tap_totals']['tests'], 1)
            self.assertEqual(report['checks'][0]['tap_totals']['pass'], 1)
            return calls[0][1]

    def test_retained_security_same_repository_gets_only_existing_guard_budget(self):
        for branch in ['codex/gekta-security-review','fix/gekta-k8s-retained-capacity-20261009', 'fix/gekta-anonymous-document-evidence-20261009']:
            with self.subTest(branch=branch):
                self.assertEqual(self.probe_retained_security_budget(branch,
                    'fixture/project', 'fixture/project'), '420s')

    def test_retained_security_fork_and_missing_repository_keep_ordinary_budget(self):
        for repository, head in [('fixture/project','fork/project'), ('fixture/project',''), ('','')]:
            with self.subTest(repository=repository, head=head):
                self.assertEqual(self.probe_retained_security_budget('codex/gekta-security-review',
                    repository, head), '180s')

    def test_retained_security_suffix_and_empty_branches_keep_ordinary_budget(self):
        for branch in ['codex/gekta-security-review-extra', 'codex/gekta-security-review/extra', '', 'unrelated/fixture']:
            with self.subTest(branch=branch):
                self.assertEqual(self.probe_retained_security_budget(branch,
                    'fixture/project', 'fixture/project'), '180s')

    def test_transitive_security_same_repository_gets_measured_guard_budget(self):
        self.assertEqual(self.probe_retained_security_budget(
            'agent/ir-sec-transitive-runtime-remediation',
            'fixture/project', 'fixture/project'), '420s')

    def test_transitive_security_untrusted_names_and_identity_keep_ordinary_budget(self):
        for ref in ('agent/ir-sec-transitive-runtime-remediation', 'fix/gekta-anonymous-document-evidence-20261009'):
            for branch, repository, head in [
                (ref + '-extra', 'fixture/project', 'fixture/project'),
                (ref + '/extra', 'fixture/project', 'fixture/project'),
                (ref.upper(), 'fixture/project', 'fixture/project'),
                ('prefix/' + ref, 'fixture/project', 'fixture/project'),
                (ref + ' ', 'fixture/project', 'fixture/project'),
                ('', 'fixture/project', 'fixture/project'),
                (ref, 'fixture/project', 'fork/project'),
                (ref, 'fixture/project', 'fixture/project/'),
                (ref, 'fixture/project', ''),
                (ref, '', ''),
            ]:
                with self.subTest(branch=branch, repository=repository, head=head):
                    self.assertEqual(self.probe_retained_security_budget(
                        branch, repository, head), '180s')

    def test_anonymous_recovery_failed_regression_stays_failed(self):
        def change(repo, out, env, git):
            env.update(GITHUB_HEAD_REF='fix/gekta-anonymous-document-evidence-20261009',
                       GITHUB_REPOSITORY='fixture/project', SOURCE_BUDGET_HEAD_REPOSITORY='fixture/project')
        rc, value, _ = self.run_case(change, test_fail=True)
        self.assertEqual(rc, 1); self.assertEqual(value['result'], 'FAIL')
        self.assertEqual([c['budget_seconds'] for c in value['checks']], [420, 180])
        self.assertEqual([c['exit_code'] for c in value['checks']], [1, 0])
        self.assertEqual(value['checks'][0]['source_matched_failing_names'], ['source fixture'])

    def test_real_retained_governance_size_is_preserved_in_both_refs(self):
        path = 'docs/platform-v7/autopilot/autopilot-state.json'
        rc, value, _ = self.run_case(lambda r,o,e,g: self.commit_sized_source(r,e,g,path,2214412,True))
        self.assertEqual(rc, 0); self.assertEqual(value['result'], 'PASS')
        self.assertEqual([s['bytes'] for s in value['sources'] if s['path'] == path], [2214412,2214412])

    def test_named_governance_exact_three_mib_is_preserved(self):
        path = 'docs/platform-v7/autopilot/autopilot-state.json'
        rc, value, _ = self.run_case(lambda r,o,e,g: self.commit_sized_source(r,e,g,path,3*1024*1024,True))
        self.assertEqual(rc, 0); self.assertEqual(value['result'], 'PASS')
        self.assertEqual([s['bytes'] for s in value['sources'] if s['path'] == path], [3*1024*1024]*2)

    def test_named_governance_over_four_mib_fails_before_checks(self):
        path = 'docs/platform-v7/autopilot/autopilot-state.json'
        rc, value, _ = self.run_case(lambda r,o,e,g: self.commit_sized_source(r,e,g,path,4*1024*1024+1))
        self.assertEqual(rc, 1); self.assertEqual(value['stage'], 'source-binding'); self.assertEqual(value['checks'], [])

    def test_named_governance_exact_four_mib_is_preserved_in_both_refs(self):
        path = 'docs/platform-v7/autopilot/autopilot-state.json'
        rc, value, _ = self.run_case(lambda r,o,e,g: self.commit_sized_source(r,e,g,path,4*1024*1024,True))
        self.assertEqual(rc, 0); self.assertEqual(value['result'], 'PASS')
        self.assertEqual([s['bytes'] for s in value['sources'] if s['path'] == path], [4*1024*1024]*2)

    def test_new_capacity_dirty_governance_is_rejected_before_checks(self):
        path = 'docs/platform-v7/autopilot/autopilot-state.json'
        def change(repo, out, env, git):
            self.commit_sized_source(repo,env,git,path,4*1024*1024)
            (repo/path).write_bytes(b' ' * (4*1024*1024-4) + b'{}\n')
        rc, value, _ = self.run_case(change)
        self.assertEqual(rc, 1); self.assertEqual(value['stage'], 'source-binding'); self.assertEqual(value['checks'], [])

    def test_new_capacity_invalid_utf8_governance_is_rejected_before_checks(self):
        path = 'docs/platform-v7/autopilot/autopilot-state.json'
        def change(repo, out, env, git):
            self.commit_sized_source(repo,env,git,path,4*1024*1024)
            (repo/path).write_bytes(b' ' * (4*1024*1024-1) + b'\xff')
            git('add', '.'); git('commit', '-m', 'invalid UTF8 bounded registry fixture')
            env['EXACT_HEAD'] = git('rev-parse', 'HEAD')
        rc, value, _ = self.run_case(change)
        self.assertEqual(rc, 1); self.assertEqual(value['stage'], 'source-binding'); self.assertEqual(value['checks'], [])

    def test_new_capacity_symlink_governance_is_rejected_before_checks(self):
        path = 'docs/platform-v7/autopilot/autopilot-state.json'
        def change(repo, out, env, git):
            self.commit_sized_source(repo,env,git,path,4*1024*1024)
            target = out/'same-bytes.json'; target.write_bytes((repo/path).read_bytes())
            (repo/path).unlink(); (repo/path).symlink_to(target)
        rc, value, _ = self.run_case(change)
        self.assertEqual(rc, 1); self.assertEqual(value['stage'], 'source-binding'); self.assertEqual(value['checks'], [])

    def test_other_fixed_source_exact_two_mib_passes(self):
        rc, value, _ = self.run_case(lambda r,o,e,g: self.commit_sized_source(r,e,g,'AGENTS.md',2*1024*1024))
        self.assertEqual(rc, 0); self.assertEqual(value['result'], 'PASS')

    def test_other_fixed_source_over_two_mib_remains_rejected(self):
        rc, value, _ = self.run_case(lambda r,o,e,g: self.commit_sized_source(r,e,g,'AGENTS.md',2*1024*1024+1))
        self.assertEqual(rc, 1); self.assertEqual(value['stage'], 'source-binding'); self.assertEqual(value['checks'], [])

    def test_scope_manifest_over_two_mib_remains_rejected(self):
        rc, value, _ = self.run_case(lambda r,o,e,g: self.commit_sized_source(r,e,g,'docs/platform-v7/autopilot/scopes/fixture.json',2*1024*1024+1))
        self.assertEqual(rc, 1); self.assertEqual(value['stage'], 'source-binding'); self.assertEqual(value['checks'], [])

    def test_dirty_large_governance_is_rejected_before_checks(self):
        path = 'docs/platform-v7/autopilot/autopilot-state.json'
        def change(repo, out, env, git):
            self.commit_sized_source(repo,env,git,path,2214412)
            (repo/path).write_bytes(b' ' * 2214410 + b'{}\n')
        rc, value, _ = self.run_case(change)
        self.assertEqual(rc, 1); self.assertEqual(value['stage'], 'source-binding'); self.assertEqual(value['checks'], [])

    def test_combined_thirty_two_mib_limit_remains_rejected(self):
        def change(repo, out, env, git):
            for n in range(17):
                path = repo / ('docs/platform-v7/autopilot/scopes/bounded-' + str(n) + '.json')
                path.write_bytes(b' ' * (1024*1024 - 3) + b'{}\n')
            git('add', '.'); git('commit', '-m', 'bounded aggregate fixture')
            env['EXACT_BASE'] = git('rev-parse', 'HEAD')
            (repo/'AGENTS.md').write_text('public final candidate\n')
            git('add', '.'); git('commit', '-m', 'aggregate candidate')
            env['EXACT_HEAD'] = git('rev-parse', 'HEAD')
        rc, value, _ = self.run_case(change)
        self.assertEqual(rc, 1); self.assertEqual(value['stage'], 'source-binding'); self.assertEqual(value['checks'], [])

    def test_exact_source_and_original_checks_pass(self):
        rc,v,_=self.run_case();self.assertEqual(rc,0);self.assertEqual(v['result'],'PASS');self.assertEqual(v['checks'][0]['tap_totals']['tests'],1)
    def test_failed_regression_stays_failed_but_scope_still_observed(self):
        rc,v,_=self.run_case(test_fail=True);self.assertEqual(rc,1);self.assertEqual(v['result'],'FAIL');self.assertEqual(len(v['checks']),2);self.assertEqual(v['checks'][0]['source_matched_failing_names'],['source fixture'])
    def test_failed_scope_stays_failed(self):
        rc,v,_=self.run_case(guard_fail=True);self.assertEqual(rc,1);self.assertEqual(v['checks'][1]['exit_code'],1)
    def test_wrong_head_is_rejected(self):
        rc,v,_=self.run_case(lambda r,o,e,g:e.update(EXACT_HEAD='a'*40));self.assertEqual(rc,1);self.assertIsNone(v)
    def test_missing_base_is_rejected(self):
        rc,v,_=self.run_case(lambda r,o,e,g:e.update(EXACT_BASE='b'*40));self.assertEqual(rc,1);self.assertIsNone(v)
    def test_invalid_ref_is_rejected(self):
        rc,v,_=self.run_case(lambda r,o,e,g:e.update(EXACT_BASE='--help'));self.assertEqual(rc,1);self.assertIsNone(v)
    def test_dirty_source_is_rejected_before_execution(self):
        rc,v,_=self.run_case(lambda r,o,e,g:(r/GUARD).write_text('do-not-publish\n'));self.assertEqual(rc,1);self.assertEqual(v['checks'],[]);self.assertEqual(v['result'],'FAIL')
    def test_existing_result_is_not_overwritten_or_accepted(self):
        def change(r,o,e,g):
            p=o/'ir20-source-preflight';p.mkdir();(p/'report.json').write_text('{"result":"FAIL","independent_review":false,"production_acceptance":false}')
        rc,v,_=self.run_case(change);self.assertEqual(rc,1);self.assertEqual(v['result'],'FAIL')
    def test_raw_errors_are_not_published(self):
        def change(r,o,e,g):
            (r/TEST).write_text("console.log('do-not-publish'); throw Error('do-not-publish');")
            g('add','.');g('commit','-m','failure-fixture');e['EXACT_HEAD']=g('rev-parse','HEAD')
        rc,v,s=self.run_case(change);self.assertEqual(rc,1);self.assertNotIn('do-not-publish',json.dumps(v)+s)
    def test_shallow_history_is_rejected(self):
        def change(r,o,e,g):(r/'.git/shallow').write_text(e['EXACT_HEAD']+'\n')
        rc,v,_=self.run_case(change);self.assertEqual(rc,1);self.assertIsNone(v)

class ScopeSchemaChecks(unittest.TestCase):
    root = WORKFLOW.parents[2]
    resolver = root / 'scripts/p7-source-controlled-scope.mjs'
    manifest_path = root / 'docs/platform-v7/autopilot/scopes/ir-k8s-production-like-2659.json'
    branch = 'ir/k8s-production-like-2659'
    allowed = [
        '.github/workflows/production-like-kubernetes-acceptance.yml',
        'docs/platform-v7/autopilot/prompts/current-review-task.md',
        'docs/platform-v7/autopilot/scopes/ir-k8s-production-like-2659.json',
        'scripts/p7-autopilot-guard.sh',
        'scripts/release/build-production-like-kubernetes-evidence.mjs',
        'scripts/release/build-production-like-outbox-runtime-evidence.mjs',
        'scripts/release/enforce-production-like-outbox-runtime-evidence.mjs',
        'scripts/release/production-like-kubernetes-*.sh',
        'scripts/release/production-like-kubernetes-fallback-evidence.mjs',
        'scripts/release/production-like-kubernetes-enforce-evidence.mjs',
        'scripts/release/production-like-kubernetes-migration-runtime.mjs',
    ]
    forbidden = ['apps/api/**', 'apps/web/**', 'apps/landing/**', 'packages/**',
                 'package.json', 'pnpm-lock.yaml', 'package-lock.json', 'apps/api/prisma/**']

    def invoke(self, mutate=None, duplicate=False, malformed=False, branch=None):
        value = json.loads(self.manifest_path.read_text())
        if mutate:
            mutate(value)
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'scope.json'
            target.write_text('{' if malformed else json.dumps(value))
            if duplicate:
                (Path(directory) / 'duplicate.json').write_text(json.dumps(value))
            return subprocess.run(['node', str(self.resolver)], capture_output=True, text=True,
                env=dict(os.environ, P7_SCOPE_DIRECTORY=directory, GITHUB_HEAD_REF=branch or self.branch), timeout=10)

    def test_schema_normalization_preserves_original_permissions(self):
        value = json.loads(self.manifest_path.read_text())
        self.assertEqual(value['schemaVersion'], 'platform-v7.concurrent-scope.v1')
        self.assertEqual(value['branch'], self.branch)
        self.assertEqual(value['status'], 'active')
        self.assertEqual(value['allowedPaths'], self.allowed)
        self.assertEqual(value['forbiddenPaths'], self.forbidden)
        self.assertEqual(len(value['requiredEvidence']), 10)

    def test_real_resolver_exports_only_existing_allowlist(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertCountEqual(result.stdout.splitlines(), self.allowed)

    def test_previous_missing_schema_is_rejected_by_unchanged_resolver(self):
        result = self.invoke(lambda value: value.pop('schemaVersion'))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('unsupported schema', result.stderr)
        self.assertEqual(result.stdout, '')

    def test_wrong_schema_inactive_empty_and_unsafe_paths_remain_rejected(self):
        for update in [{'schemaVersion': 'wrong'}, {'status': 'closed'},
                       {'allowedPaths': []}, {'allowedPaths': ['../outside']}]:
            with self.subTest(update=update):
                result = self.invoke(lambda value: value.update(update))
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')

    def test_duplicate_branch_manifests_still_fail_closed(self):
        result = self.invoke(duplicate=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('duplicate manifests', result.stderr)

    def test_malformed_manifest_still_fails_closed(self):
        result = self.invoke(malformed=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('malformed JSON', result.stderr)

    def test_unrelated_branch_does_not_receive_this_scope(self):
        result = self.invoke(branch='unrelated/test-fixture')
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')


try:
    unittest.main(defaultTest=['Checks', 'ScopeSchemaChecks'], verbosity=2)
finally:
    SCRIPT_DIRECTORY.cleanup()
PY_SOURCE_TEST
