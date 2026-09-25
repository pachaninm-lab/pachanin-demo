#!/usr/bin/env bash
# Synthetic Git/Node regression fixtures; no network, Kubernetes or production access.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 -I - "$ROOT" <<'PY_SOURCE_TEST'
from pathlib import Path
import tempfile, subprocess, os, json, hashlib, zipfile, unittest

import sys

WORKFLOW = Path(sys.argv.pop()) / '.github/workflows/production-like-kubernetes-acceptance.yml'
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
    unittest.main(verbosity=2)
finally:
    SCRIPT_DIRECTORY.cleanup()
PY_SOURCE_TEST
