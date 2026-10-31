import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const scopes = {
  "fix/gekta-history-lifecycle-5818": [
    "apps/api/src/modules/gekta/gekta-workspace.service.ts",
    "apps/api/src/modules/gekta/gekta-workspace.spec.ts"
  ],
  "fix/gekta-model-control-probe-20261001": [
    ".github/workflows/gekta-p0-speed-model-host-control-probe.yml"
  ],
  "fix/gekta-qwen35-guard-argv-form-20260928": [
    ".github/workflows/gekta-qwen35-4b-model-host-candidate.yml",
    "scripts/gekta-qwen35-4b-model-host-candidate.py"
  ],
  "fix/gekta-docker-diagnostic-route-20260927": [
    ".github/workflows/production-docker-headroom-diagnostic.yml"
  ],
  "fix/gekta-web-release-recovery-20260927": [
    "scripts/production-web-remote-entrypoint.sh",
    "scripts/production-web-exact-sha.sh",
    "scripts/check-production-web-hardening.mjs"
  ],
  "fix/gekta-answer-copy-20260927": [
    "apps/web/app/api/agro-chat/route.ts",
    "apps/web/lib/platform-v7/public-assistant-knowledge.ts",
    "apps/web/tests/unit/publicFarmerStarterQuestions.test.ts"
  ],
  "fix/gekta-han-stream-20260927": [
    "apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.service.spec.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.stream.spec.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.stream-gate.spec.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.stream-gate.ts",
    "apps/web/lib/platform-v7/assistant-relevance-router.ts",
    "apps/web/tests/unit/taiSemanticRelevanceRouter.test.ts",
    "apps/web/app/api/agro-chat/route.ts",
    "apps/web/tests/unit/platformV7AgroChatModelFirstRoute.test.ts"
  ]
};
const sourceGuard = fs.readFileSync('scripts/p7-autopilot-guard.sh', 'utf8');
const sourceResolver = fs.readFileSync('scripts/p7-source-controlled-scope.mjs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/platform-v7-autopilot-guard.yml', 'utf8');
const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}
function git(root, ...args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r.stdout.trim();
}
function fixture(t, branch, { admitted = true, purpose = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gekta-recovery-guard-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'scripts/p7-autopilot-guard.sh', sourceGuard);
  write(root, 'scripts/p7-source-controlled-scope.mjs', sourceResolver);
  const state = { allowedCurrentScope: ['README.md'], approvedConcurrentScopes: { [branch]: ['forged.txt'] } };
  if (branch === 'fix/gekta-history-lifecycle-5818') {
    const paths = scopes[branch];
    const blob = value => createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0${value}`).digest('hex');
    const template = {
      owner: 'OWNER_AUTHORIZED_SESSION', implementationBranch: branch, originalIssue: 5818, allowedPaths: paths,
      sourcePayload: paths.map(file => ({ path: file, beforeBlob: blob('base'), afterBlob: blob('changed'),
        mode: '100644', bytes: 7, sha256: createHash('sha256').update('changed').digest('hex') })),
      requiredTruthBoundaries: ['No runtime/model or physical purge authority.'],
    };
    state.allowedCurrentScope.push('apps/api/src/main.ts', 'infra/production/injected.yml');
    state.approvedConcurrentScopes = admitted ? { [branch]: paths } : {};
    state.coordinationAdmissions = purpose ? {
      'gekta-history-lifecycle-guard-purpose-5818-20261007': {
        stagedSourceBranch: branch, stagedAdmissionBranch: 'governance/gekta-history-lifecycle-source-admission-5818',
        stagedSourceAdmission: template,
      },
      ...(admitted ? { 'gekta-history-lifecycle-5818-20261007': {
        ...template, authorityBaseExactMain: 'a'.repeat(40),
      } } : {}),
    } : {};
  }
  if (branch === 'fix/gekta-model-control-probe-20261001') {
    state.approvedConcurrentScopes = admitted ? { [branch]: scopes[branch] } : {};
    state.coordinationAdmissions = purpose ? {
      'gekta-readonly-control-diagnostic-prerequisite-20261001': {
        sourceAdmissionState: 'STAGED_NEEDS_ACCEPTED_LITERAL_GUARD',
        stagedDiagnosticBranch: branch,
        stagedDiagnosticPaths: scopes[branch],
      },
    } : {};
  }
  write(root, statePath, JSON.stringify(state));
  write(root, 'README.md', 'base');
  for (const file of scopes[branch]) write(root, file, 'base');
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.name', 'Scope regression');
  git(root, 'config', 'user.email', 'scope@example.invalid');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'base');
  const base = git(root, 'rev-parse', 'HEAD');
  git(root, 'switch', '-c', branch);
  return { root, base, branch };
}
function check(c) {
  git(c.root, 'add', '.'); git(c.root, 'commit', '-m', 'candidate');
  return spawnSync('bash', ['scripts/p7-autopilot-guard.sh'], { cwd: c.root, encoding: 'utf8', env: { ...process.env, BASE_REF: c.base, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: c.branch } });
}
for (const [branch, files] of Object.entries(scopes)) {
  test(`${branch}: accepted base allows exactly the bounded implementation paths`, t => {
    const c = fixture(t, branch);
    for (const file of files) write(c.root, file, 'changed');
    const r = check(c); assert.equal(r.status, 0, r.stdout + r.stderr);
  });
  for (const file of ['README.md', 'forged.txt', 'apps/api/src/modules/staff-access/injected.ts', 'apps/api/src/modules/ai-insights/restricted-public-qwen.quality.spec.ts', '.github/workflows/ci.yml', statePath, 'scripts/p7-autopilot-guard.sh', '.github/workflows/platform-v7-autopilot-guard.yml']) {
    test(`${branch}: rejects global, mutable or authority path ${file}`, t => {
      const c = fixture(t, branch);
      write(c.root, file, file === statePath ? JSON.stringify({ allowedCurrentScope: ['**'], approvedConcurrentScopes: { [branch]: ['**'] } }) : 'injected');
      git(c.root, 'add', '.'); git(c.root, 'commit', '-m', 'candidate');
      // Execute accepted base code even when the candidate rewrites the guard.
      const trusted = path.join(c.root, 'trusted-guard'); fs.writeFileSync(trusted, sourceGuard);
      const r = spawnSync('bash', [trusted], { cwd: c.root, encoding: 'utf8', env: { ...process.env, BASE_REF: c.base, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: c.branch } });
      assert.notEqual(r.status, 0, r.stdout + r.stderr);
    });
  }
  test(`${branch}: trusted-base and PR-defense workflow routes are registered`, () => {
    for (const marker of [`github.event.pull_request.head.ref == '${branch}'`, `github.head_ref == '${branch}'`, `github.head_ref != '${branch}'`, `|${branch}|`]) assert.ok(workflow.includes(marker), marker);
    assert.ok(workflow.includes('bash scripts/p7-autopilot-guard.sh'));
    assert.ok(workflow.includes('ref: ${{ github.event.pull_request.base.sha }}'));
  });
}

test('candidate-owned manifest cannot self-admit an API authority file', t => {
  const c = fixture(t, 'fix/gekta-qwen35-guard-argv-form-20260928');
  write(c.root, 'docs/platform-v7/autopilot/scopes/gekta-qwen35-4b-model-host-candidate-3896.json', JSON.stringify({
    schemaVersion: 'platform-v7.concurrent-scope.v1', status: 'active', branch: c.branch,
    allowedPaths: [...scopes[c.branch], 'apps/api/src/app.module.ts'],
  }));
  write(c.root, 'apps/api/src/app.module.ts', 'injected authority');
  const r = check(c);
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
});

const readonlyDiagnosticBranch = 'fix/gekta-model-control-probe-20261001';
const readonlyDiagnosticPath = scopes[readonlyDiagnosticBranch][0];
function checkTrustedDiagnostic(c) {
  git(c.root, 'add', '.');
  git(c.root, 'commit', '-m', 'candidate');
  const trusted = path.join(c.root, 'trusted-guard');
  fs.writeFileSync(trusted, sourceGuard);
  return spawnSync('bash', [trusted], {
    cwd: c.root, encoding: 'utf8',
    env: { ...process.env, BASE_REF: c.base, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: c.branch },
  });
}
for (const options of [{ admitted: false }, { purpose: false }, { admitted: false, purpose: false }]) {
  test(`read-only diagnostic: literal route alone cannot supply missing accepted prerequisite ${JSON.stringify(options)}`, t => {
    const c = fixture(t, readonlyDiagnosticBranch, options);
    write(c.root, readonlyDiagnosticPath, 'changed');
    const r = checkTrustedDiagnostic(c);
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stderr, /GEKTA_READONLY_DIAGNOSTIC_(?:SOURCE_NOT_ADMITTED|PURPOSE_NOT_ACCEPTED)/u);
  });
}
for (const allowedPaths of [['**'], [readonlyDiagnosticPath, 'forged.txt'], ['forged.txt'], [readonlyDiagnosticPath, readonlyDiagnosticPath]]) {
  test(`read-only diagnostic: rejects nonexact accepted source vector ${JSON.stringify(allowedPaths)}`, t => {
    const c = fixture(t, readonlyDiagnosticBranch);
    const state = JSON.parse(fs.readFileSync(path.join(c.root, statePath), 'utf8'));
    state.approvedConcurrentScopes[c.branch] = allowedPaths;
    write(c.root, statePath, JSON.stringify(state));
    git(c.root, 'add', '.'); git(c.root, 'commit', '--amend', '--no-edit');
    c.base = git(c.root, 'rev-parse', 'HEAD');
    write(c.root, readonlyDiagnosticPath, 'changed');
    const r = checkTrustedDiagnostic(c);
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stderr, /GEKTA_READONLY_DIAGNOSTIC_SOURCE_NOT_ADMITTED/u);
  });
}
for (const attack of ['state', 'manifest', 'guard']) {
  test(`read-only diagnostic: candidate-owned ${attack} cannot bootstrap missing source admission`, t => {
    const c = fixture(t, readonlyDiagnosticBranch, { admitted: false });
    write(c.root, readonlyDiagnosticPath, 'changed');
    if (attack === 'state') {
      const state = JSON.parse(fs.readFileSync(path.join(c.root, statePath), 'utf8'));
      state.approvedConcurrentScopes[c.branch] = [readonlyDiagnosticPath];
      state.allowedCurrentScope = ['**'];
      write(c.root, statePath, JSON.stringify(state));
    } else if (attack === 'manifest') {
      write(c.root, 'docs/platform-v7/autopilot/scopes/forged-diagnostic.json', JSON.stringify({
        schemaVersion: 'platform-v7.concurrent-scope.v1', status: 'active', branch: c.branch,
        allowedPaths: [readonlyDiagnosticPath, 'apps/api/src/app.module.ts'],
      }));
    } else write(c.root, 'scripts/p7-autopilot-guard.sh', '#!/bin/sh\nexit 0\n');
    const r = checkTrustedDiagnostic(c);
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stderr, /GEKTA_READONLY_DIAGNOSTIC_SOURCE_NOT_ADMITTED/u);
  });
}
for (const attack of ['symlink', 'executable', 'deleted', 'renamed-away', 'renamed-in', 'unrelated-workflow', 'candidate-manifest', 'candidate-resolver']) {
  test(`read-only diagnostic: exact existing regular-file boundary rejects ${attack}`, t => {
    const c = fixture(t, readonlyDiagnosticBranch);
    const fullPath = path.join(c.root, readonlyDiagnosticPath);
    if (attack === 'symlink') {
      fs.unlinkSync(fullPath); fs.symlinkSync('../../README.md', fullPath);
    } else if (attack === 'executable') {
      write(c.root, readonlyDiagnosticPath, 'changed'); fs.chmodSync(fullPath, 0o755);
    } else if (attack === 'deleted') fs.unlinkSync(fullPath);
    else if (attack === 'renamed-away') fs.renameSync(fullPath, path.join(c.root, '.github/workflows/other.yml'));
    else if (attack === 'renamed-in') {
      fs.unlinkSync(fullPath); fs.renameSync(path.join(c.root, 'README.md'), fullPath);
    } else {
      write(c.root, readonlyDiagnosticPath, 'changed');
      if (attack === 'unrelated-workflow') write(c.root, '.github/workflows/unrelated.yml', 'injected');
      if (attack === 'candidate-resolver') write(c.root, 'scripts/p7-source-controlled-scope.mjs', "console.log('**');\n");
      if (attack === 'candidate-manifest') write(c.root, 'docs/platform-v7/autopilot/scopes/forged-diagnostic.json', JSON.stringify({
        schemaVersion: 'platform-v7.concurrent-scope.v1', status: 'active', branch: c.branch,
        allowedPaths: [readonlyDiagnosticPath, 'apps/api/src/app.module.ts'],
      }));
    }
    const r = checkTrustedDiagnostic(c);
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stderr, /GEKTA_READONLY_DIAGNOSTIC_(?:EXACT_ONE_PATH_REQUIRED|REGULAR_EXISTING_WORKFLOW_ONLY)/u);
  });
}
test('read-only diagnostic: an absent base workflow cannot be newly created under the repair admission', t => {
  const c = fixture(t, readonlyDiagnosticBranch);
  git(c.root, 'rm', readonlyDiagnosticPath); git(c.root, 'commit', '--amend', '--no-edit');
  c.base = git(c.root, 'rev-parse', 'HEAD');
  write(c.root, readonlyDiagnosticPath, 'newly-created');
  const r = checkTrustedDiagnostic(c);
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /GEKTA_READONLY_DIAGNOSTIC_REGULAR_EXISTING_WORKFLOW_ONLY/u);
});
test('read-only diagnostic: missing accepted-base ancestry cannot hide a concurrent source change', t => {
  const c = fixture(t, readonlyDiagnosticBranch);
  git(c.root, 'switch', 'main'); write(c.root, 'README.md', 'new accepted content');
  git(c.root, 'add', '.'); git(c.root, 'commit', '-m', 'advance accepted base');
  c.base = git(c.root, 'rev-parse', 'HEAD'); git(c.root, 'switch', c.branch);
  write(c.root, readonlyDiagnosticPath, 'changed');
  const r = checkTrustedDiagnostic(c);
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /merge-base --is-ancestor/u);
});
test('read-only diagnostic: all six accepted-base, PR-defense and exclusion selectors are registered', () => {
  assert.equal(workflow.split(`github.event.pull_request.head.ref == '${readonlyDiagnosticBranch}'`).length - 1, 1);
  assert.equal(workflow.split(`github.head_ref == '${readonlyDiagnosticBranch}'`).length - 1, 2);
  assert.equal(workflow.split(`github.head_ref != '${readonlyDiagnosticBranch}'`).length - 1, 1);
  assert.equal(workflow.split(`|${readonlyDiagnosticBranch}|`).length - 1, 2);
  assert.ok(workflow.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh" > "$TRUSTED_GUARD"'));
});
for (const baselineMode of ['symlink', 'executable']) {
  test(`read-only diagnostic: rejects nonregular accepted-base ${baselineMode} even when candidate becomes a regular file`, t => {
    const c = fixture(t, readonlyDiagnosticBranch);
    const fullPath = path.join(c.root, readonlyDiagnosticPath);
    if (baselineMode === 'symlink') {
      fs.unlinkSync(fullPath); fs.symlinkSync('../../README.md', fullPath);
    } else fs.chmodSync(fullPath, 0o755);
    git(c.root, 'add', '.'); git(c.root, 'commit', '--amend', '--no-edit');
    c.base = git(c.root, 'rev-parse', 'HEAD');
    fs.unlinkSync(fullPath); write(c.root, readonlyDiagnosticPath, 'changed');
    const r = checkTrustedDiagnostic(c);
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stderr, /GEKTA_READONLY_DIAGNOSTIC_REGULAR_EXISTING_WORKFLOW_ONLY/u);
  });
}
test('read-only diagnostic: rejects workflow-to-gitlink mode transition', t => {
  const c = fixture(t, readonlyDiagnosticBranch);
  git(c.root, 'update-index', '--cacheinfo', `160000,${c.base},${readonlyDiagnosticPath}`);
  git(c.root, 'commit', '-m', 'candidate gitlink');
  const trusted = path.join(c.root, 'trusted-guard'); fs.writeFileSync(trusted, sourceGuard);
  const r = spawnSync('bash', [trusted], { cwd: c.root, encoding: 'utf8',
    env: { ...process.env, BASE_REF: c.base, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: c.branch } });
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /GEKTA_READONLY_DIAGNOSTIC_REGULAR_EXISTING_WORKFLOW_ONLY/u);
});

for (const [routeBranch, routePath] of [
  [readonlyDiagnosticBranch, readonlyDiagnosticPath],
  ...scopes['fix/gekta-history-lifecycle-5818'].map(file => ['fix/gekta-history-lifecycle-5818', file]),
]) test(`${routeBranch}: source-only ${routePath} triggers and selects PR-head defense`, () => {
  function pullRequestFilter(source) {
    const lines = source.split('\n');
    const on = lines.indexOf('on:');
    assert.notEqual(on, -1);
    const topLevelEnd = lines.findIndex((line, i) => i > on && /^\S/u.test(line));
    const events = lines.slice(on + 1, topLevelEnd < 0 ? undefined : topLevelEnd);
    const start = events.indexOf('  pull_request:');
    assert.notEqual(start, -1, 'pull_request event is required, not only pull_request_target');
    const end = events.findIndex((line, i) => i > start && /^  \S/u.test(line));
    const event = events.slice(start + 1, end < 0 ? undefined : end);
    assert.ok(!event.includes('    paths-ignore:'), 'Do not combine paths and paths-ignore');
    const list = key => {
      const index = event.indexOf(`    ${key}:`);
      if (index < 0) return null;
      const values = [];
      for (let i = index + 1; i < event.length && event[i].startsWith('      - '); i += 1) {
        values.push(event[i].slice(8).trim().replace(/^['"]|['"]$/gu, ''));
      }
      return values;
    };
    return { branches: list('branches'), paths: list('paths'), types: list('types') ?? ['opened', 'synchronize', 'reopened'] };
  }
  const matchesPath = (pattern, file) => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/gu, '\\$&');
    const expression = escaped.replace(/\*\*|\*|\?/gu, glob => glob === '**' ? '.*' : glob === '*' ? '[^/]*' : '[^/]');
    return new RegExp(`^${expression}$`, 'u').test(file);
  };
  const triggers = (source, action, file, base = 'main') => {
    const filter = pullRequestFilter(source);
    return filter.branches?.includes(base) && filter.types.includes(action) && filter.paths?.some(pattern => matchesPath(pattern, file));
  };
  const defense = workflow.match(/- name: Validate immutable scope with trusted base guard on PR head\n        if: >-\n([\s\S]*?)        env:/u)?.[1];
  assert.ok(defense, 'The actual PR-head defense condition is required');
  const selected = runInNewContext(`(${defense})`, { github: { event_name: 'pull_request', head_ref: routeBranch } }, { timeout: 1000 });
  assert.equal(selected, true);
  const filter = pullRequestFilter(workflow);
  assert.equal(filter.paths.filter(file => file === routePath).length, 1, 'The exact source path must be in pull_request.paths');
  const line = `      - '${routePath}'\n`;
  assert.equal(workflow.split(line).length - 1, 1);
  const missingTrigger = workflow.replace(line, '');
  for (const action of ['opened', 'synchronize', 'reopened']) {
    assert.equal(triggers(workflow, action, routePath) && selected, true, action);
    assert.equal(triggers(missingTrigger, action, routePath), false, `${action}: selectors alone must not mask a missing event trigger`);
    assert.equal(triggers(workflow, action, '.github/workflows/unrelated-model-control.yml'), false);
    assert.equal(triggers(workflow, action, routePath, 'not-main'), false);
  }
  assert.deepEqual(pullRequestFilter(missingTrigger).paths, filter.paths.filter(file => file !== routePath));
  for (const marker of [`github.event.pull_request.head.ref == '${routeBranch}'`, `github.head_ref == '${routeBranch}'`, `github.head_ref != '${routeBranch}'`, `|${routeBranch}|`]) {
    assert.equal(missingTrigger.split(marker).length, workflow.split(marker).length, 'Removing the event trigger leaves every selector unchanged');
  }
});

const historyBranch = 'fix/gekta-history-lifecycle-5818';
const historyAdmissionBranch = 'governance/gekta-history-lifecycle-source-admission-5818';
const historyPurposeKey = 'gekta-history-lifecycle-guard-purpose-5818-20261007';
const historyAdmissionKey = 'gekta-history-lifecycle-5818-20261007';
for (const options of [{ admitted: false }, { purpose: false }]) {
  test(`history: trusted source requires accepted purpose and source admission ${JSON.stringify(options)}`, t => {
    const c = fixture(t, historyBranch, options);
    for (const file of scopes[historyBranch]) write(c.root, file, 'changed');
    assert.notEqual(checkTrustedDiagnostic(c).status, 0);
  });
}
for (const attack of ['main.ts', 'infrastructure', 'missing-file', 'wrong-content', 'rename', 'symlink', 'executable', 'state', 'resolver', 'guard']) {
  test(`history: accepted two-file payload rejects ${attack}`, t => {
    const c = fixture(t, historyBranch);
    for (const file of scopes[historyBranch]) write(c.root, file, 'changed');
    const first = path.join(c.root, scopes[historyBranch][0]);
    if (attack === 'main.ts') write(c.root, 'apps/api/src/main.ts', 'injected');
    if (attack === 'infrastructure') write(c.root, 'infra/production/injected.yml', 'injected');
    if (attack === 'missing-file') write(c.root, scopes[historyBranch][0], 'base');
    if (attack === 'wrong-content') write(c.root, scopes[historyBranch][0], 'other');
    if (attack === 'rename') fs.renameSync(first, first + '.renamed');
    if (attack === 'symlink') { fs.unlinkSync(first); fs.symlinkSync('../../../../../README.md', first); }
    if (attack === 'executable') fs.chmodSync(first, 0o755);
    if (attack === 'state') {
      const state = JSON.parse(fs.readFileSync(path.join(c.root, statePath), 'utf8'));
      state.allowedCurrentScope = ['**']; state.approvedConcurrentScopes[c.branch] = ['**'];
      write(c.root, statePath, JSON.stringify(state));
    }
    if (attack === 'resolver') write(c.root, 'scripts/p7-source-controlled-scope.mjs', "console.log('**');");
    if (attack === 'guard') write(c.root, 'scripts/p7-autopilot-guard.sh', '#!/bin/sh\nexit 0\n');
    assert.notEqual(checkTrustedDiagnostic(c).status, 0);
  });
}
function historyAdmissionFixture(t, options = {}) {
  const c = fixture(t, historyBranch, { admitted: false, ...options });
  git(c.root, 'switch', '-c', historyAdmissionBranch); c.branch = historyAdmissionBranch;
  const state = JSON.parse(fs.readFileSync(path.join(c.root, statePath), 'utf8'));
  state.approvedConcurrentScopes[historyBranch] = scopes[historyBranch];
  if (state.coordinationAdmissions[historyPurposeKey]) {
    state.coordinationAdmissions[historyAdmissionKey] = {
      ...state.coordinationAdmissions[historyPurposeKey].stagedSourceAdmission, authorityBaseExactMain: c.base,
    };
  }
  write(c.root, statePath, JSON.stringify(state));
  return c;
}
test('history admission: accepted purpose allows exactly the state-only transition', t => {
  const c = historyAdmissionFixture(t); const r = checkTrustedDiagnostic(c);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
for (const attack of ['global-permission', 'extra-vector', 'wrong-payload', 'source-file', 'guard-file', 'state-executable', 'missing-purpose', 'base-source-moved']) {
  test(`history admission: rejects ${attack}`, t => {
    const c = historyAdmissionFixture(t, { purpose: attack !== 'missing-purpose' });
    const full = path.join(c.root, statePath); const state = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (attack === 'global-permission') state.allowedCurrentScope = ['**'];
    if (attack === 'extra-vector') state.approvedConcurrentScopes.evil = ['**'];
    if (attack === 'wrong-payload') state.coordinationAdmissions[historyAdmissionKey].sourcePayload[0].afterBlob = 'b'.repeat(40);
    write(c.root, statePath, JSON.stringify(state));
    if (attack === 'source-file') write(c.root, scopes[historyBranch][0], 'changed');
    if (attack === 'guard-file') write(c.root, 'scripts/p7-autopilot-guard.sh', '#!/bin/sh\nexit 0\n');
    if (attack === 'state-executable') fs.chmodSync(full, 0o755);
    if (attack === 'base-source-moved') {
      git(c.root, 'stash', 'push', '-u');
      write(c.root, scopes[historyBranch][0], 'new baseline'); git(c.root, 'add', '.'); git(c.root, 'commit', '-m', 'advance source');
      c.base = git(c.root, 'rev-parse', 'HEAD'); git(c.root, 'stash', 'pop');
      const updated = JSON.parse(fs.readFileSync(full, 'utf8'));
      updated.coordinationAdmissions[historyAdmissionKey].authorityBaseExactMain = c.base;
      write(c.root, statePath, JSON.stringify(updated));
    }
    const r = checkTrustedDiagnostic(c); assert.notEqual(r.status, 0, r.stdout + r.stderr);
  });
}
for (const branch of [historyBranch, historyAdmissionBranch]) {
  test(`history: all six native trusted-base and PR-defense selectors register ${branch}`, () => {
    assert.equal(workflow.split(`github.event.pull_request.head.ref == '${branch}'`).length - 1, 1);
    assert.equal(workflow.split(`github.head_ref == '${branch}'`).length - 1, 2);
    assert.equal(workflow.split(`github.head_ref != '${branch}'`).length - 1, 1);
    assert.equal(workflow.split(`|${branch}|`).length - 1, 2);
    assert.ok(workflow.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh" > "$TRUSTED_GUARD"'));
  });
}

// Exact new-purpose guard tests. Git transport is mocked; content hashes are real.
import { gunzipSync } from 'node:zlib';
const geometryWorkflow = '.github/workflows/production-docker-headroom-diagnostic.yml';
const geometryBranch = 'fix/gekta-docker-diagnostic-route-20260927';
const geometryOrigin = '5b1a9143e8cc5ee69705f222bde457bf6731d595';
const geometryBeforeBlob = '03dbdc1d5e9a97687ddd7713e896fb3094f0f8a0';
const geometryAfterBlob = 'cb71a92fed47bed533147891ca453a432ea29945';
const geometryBefore = fs.readFileSync(geometryWorkflow).subarray(0, 191427);
const geometryAfter = Buffer.concat([geometryBefore, gunzipSync(Buffer.from('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', 'base64'))]);
const geometryBody = sourceGuard.split('// ROOT_GEOMETRY_EXACT_SOURCE_BEGIN: separate accepted-base purpose, no host grant.')[1]
  .split('// ROOT_GEOMETRY_EXACT_SOURCE_END')[0] + '\n}';
const geometryExpected = JSON.parse(geometryBody.match(/const expectedPurpose = (.*);/u)[1]);
const geometryHelper = 'scripts/test_production_stopped_runtime_headroom.py';
const geometryQueue = 'docs/platform-v7/execution-queue.md';
function geometryCheck(attack = '', body = geometryBody) {
  const original = { allowedCurrentScope: ['README.md'], approvedConcurrentScopes: {
    [geometryBranch]: [geometryWorkflow, geometryHelper] }, coordinationAdmissions: {
    'retained-old-schema': { productionAcceptance: false, exact: 'unchanged' } } };
  const accepted = structuredClone(original);
  const purpose = structuredClone(geometryExpected);
  accepted.coordinationAdmissions['root-filesystem-geometry-20261031'] = purpose;
  if (attack === 'wrong-pin') purpose.sourcePayload.afterBlob = 'f'.repeat(40);
  if (attack === 'pending-decision') purpose.ownerDecision = 'PENDING';
  if (attack === 'pending-review') purpose.independentReviewStatus = 'PENDING';
  if (attack === 'wrong-review') purpose.independentReviewSha256 = 'f'.repeat(64);
  if (attack === 'extra-field') purpose.extra = true;
  if (attack === 'production-grant') purpose.productionInvocationAuthorized = true;
  if (attack === 'wildcard-vector') accepted.approvedConcurrentScopes[geometryBranch] = ['**'];
  if (attack === 'prior-purpose') accepted.coordinationAdmissions['retained-old-schema'].exact = 'forged';
  if (attack === 'prior-state') accepted.allowedCurrentScope = ['**'];
  if (attack === 'candidate-owned-purpose' || attack === 'missing-purpose') delete accepted.coordinationAdmissions['root-filesystem-geometry-20261031'];
  const acceptedText = JSON.stringify(accepted);
  const rawDiff = `:100644 100644 ${geometryBeforeBlob} ${geometryAfterBlob} M\0${geometryWorkflow}\0`;
  const context = {
    geometryPurpose: accepted.coordinationAdmissions['root-filesystem-geometry-20261031'], accepted, acceptedText,
    branch: geometryBranch, baseRef: 'BASE', stateFile: statePath, scopes: undefined,
    process: { env: { HEAD_REF: attack === 'missing-head' ? '' : 'HEAD' } },
    isDeepStrictEqual: (a, b) => { try { assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); return true; } catch { return false; } },
    createHash,
    readImmutableState(ref) {
      if (ref === geometryOrigin) return JSON.stringify(original);
      if (ref === 'HEAD' && ['state-mutation', 'candidate-owned-purpose'].includes(attack)) return acceptedText + ' ';
      if (ref === 'HEAD' && attack === 'foreign-state-mutation') return JSON.stringify({ ...accepted, allowedCurrentScope: ['**'] });
      return acceptedText;
    },
    execFileSync(command, args, options = {}) {
      assert.equal(command, 'git');
      if (args[0] === 'merge-base') {
        if (args[1] === geometryOrigin) return attack === 'origin-ancestry' ? 'f'.repeat(40) : geometryOrigin;
        return attack === 'base-ancestry' ? 'f'.repeat(40) : 'BASE';
      }
      if (args[0] === 'rev-parse') return 'BASE';
      if (args[0] === 'diff') {
        if (['extra-path', 'guard-edit', 'selector-edit', 'resolver-edit', 'manifest-edit'].includes(attack)) return rawDiff + ':100644 100644 ' + 'a'.repeat(40) + ' ' + 'b'.repeat(40) + ' M\0README.md\0';
        if (attack === 'deleted') return rawDiff.replace(' M\0', ' D\0');
        if (attack === 'rename') return rawDiff.replace(' M\0', ' R100\0');
        if (attack === 'no-change') return '';
        if (attack === 'wrong-before') return rawDiff.replace(geometryBeforeBlob, '0'.repeat(40));
        return rawDiff;
      }
      if (args[0] === 'ls-tree') {
        const ref = args[1], file = args[3];
        let mode = '100644', blob = 'a'.repeat(40);
        if (file === geometryHelper) blob = attack === 'helper' ? '0'.repeat(40) : 'bc2c092cea71aaca1c94121b02d1bd87cf83df5f';
        if (file === geometryWorkflow) {
          blob = ref === 'BASE' ? geometryBeforeBlob : geometryAfterBlob;
          if ((ref === 'HEAD' && attack === 'head-symlink') || (ref === 'BASE' && attack === 'base-symlink')) mode = '120000';
          if (ref === 'HEAD' && attack === 'executable') mode = '100755';
          if (ref === 'HEAD' && attack === 'gitlink') mode = '160000';
          if (ref === 'BASE' && attack === 'missing-base-file') return '';
        }
        if (file === statePath && attack === 'state-mode') mode = '120000';
        if (file === geometryQueue && ref === 'HEAD' && attack === 'queue-mutation') blob = 'b'.repeat(40);
        return `${mode} blob ${blob}\t${file}`;
      }
      if (args[0] === 'show') {
        if (args[1].endsWith(':' + geometryQueue)) return Buffer.from(args[1].startsWith(geometryOrigin + ':') ? 'old-queue' : attack === 'prior-queue' ? 'rewritten-queue' : 'old-queue\nnew-purpose');
        let raw = Buffer.from(args[1].startsWith('BASE:') ? geometryBefore : geometryAfter);
        if (args[1].startsWith('BASE:') && attack === 'before-content') raw[0] ^= 1;
        if (args[1].startsWith('HEAD:') && attack === 'after-content') raw[raw.length - 1] ^= 1;
        if (args[1].startsWith('HEAD:') && attack === 'prefix') raw[0] ^= 1;
        if (args[1].startsWith('HEAD:') && attack === 'size-plus-one') raw = Buffer.concat([raw, Buffer.from('x')]);
        return raw;
      }
      throw new Error('unhandled mocked Git operation');
    },
  };
  runInNewContext(body, context, { timeout: 2000 });
  if (context.scopes === undefined) throw new Error('ROOT_GEOMETRY_SCOPE_NOT_ADMITTED');
  return Array.from(context.scopes);
}
test('root geometry: real frozen payload hashes and exact accepted-purpose route', () => {
  assert.equal(createHash('sha1').update(`blob ${geometryBefore.length}\0`).update(geometryBefore).digest('hex'), geometryBeforeBlob);
  assert.equal(createHash('sha1').update(`blob ${geometryAfter.length}\0`).update(geometryAfter).digest('hex'), geometryAfterBlob);
  assert.equal(createHash('sha256').update(geometryAfter).digest('hex'), '3056c9e395639bf8d087bb3bdde1a963c6b7dffc551e48f38da693b9bd297c3e');
  assert.deepEqual(geometryCheck(), [geometryWorkflow]);
});
for (const attack of ['missing-purpose', 'candidate-owned-purpose', 'wrong-pin', 'pending-decision', 'pending-review',
  'wrong-review', 'extra-field', 'production-grant', 'wildcard-vector', 'prior-purpose', 'prior-state',
  'missing-head', 'origin-ancestry', 'base-ancestry', 'state-mutation', 'foreign-state-mutation', 'helper',
  'queue-mutation', 'prior-queue', 'state-mode', 'extra-path', 'guard-edit', 'selector-edit', 'resolver-edit',
  'manifest-edit', 'deleted', 'rename', 'no-change', 'wrong-before', 'head-symlink', 'base-symlink',
  'executable', 'gitlink', 'missing-base-file', 'before-content', 'after-content', 'prefix', 'size-plus-one']) {
  test(`root geometry: rejects ${attack}`, () => assert.throws(() => geometryCheck(attack), /ROOT_GEOMETRY_SCOPE_/u));
}
test('root geometry: counterfactual removing exact pin validation admits forged authority', () => {
  assert.ok(geometryBody.includes("fail('ACCEPTED_PURPOSE')"));
  const changed = geometryBody.replace("fail('ACCEPTED_PURPOSE')", 'void 0');
  assert.notEqual(changed, geometryBody);
  assert.deepEqual(geometryCheck('wrong-pin', changed), [geometryWorkflow]);
  assert.throws(() => geometryCheck('wrong-pin'), /ROOT_GEOMETRY_SCOPE_ACCEPTED_PURPOSE/u);
});

// Growth admission tests execute the inserted body. Git results are mocked;
// synthetic fixture substitutions never change production guard authority.
const growthWorkflow = '.github/workflows/production-docker-headroom-diagnostic.yml';
const growthBranch = 'fix/gekta-docker-diagnostic-route-20260927';
const growthPurposeId = 'root-filesystem-growth-20261031';
const growthOrigin = '58bbc762c0e781ac4df33a8004d4221e1f91f7e5';
const growthBeforeBlob = 'cb71a92fed47bed533147891ca453a432ea29945';
const growthBefore = Buffer.from(fs.readFileSync(growthWorkflow, 'utf8')
  .replace("                  with patch.object(g.time, 'monotonic', return_value=0.0): k = g.Kernel()\n", "                  k = g.Kernel()\n")).subarray(0, 254318);
const growthHelper = 'scripts/test_production_stopped_runtime_headroom.py';
const growthQueue = 'docs/platform-v7/execution-queue.md';
const growthBody = sourceGuard.split('// ROOT_GROWTH_EXACT_SOURCE_BEGIN: source admission only; no host write grant.')[1]
  .split('// ROOT_GROWTH_EXACT_SOURCE_END')[0] + '\n}';
const growthLiteral = name => JSON.parse(growthBody.match(new RegExp(`const ${name} = (.*);`, 'u'))[1]);
const growthRealPurpose = growthLiteral('expectedPurpose');
const growthPinsFrozen = true;
const growthSourceFrozen = true;
const growthFrozenAppend = 'H4sIAAAAAAACA+S9a3vaSLYw+r1/hSazZ4RigQHjG27N3sQmCW87tjfGfRk3rx4BwtYEIzaCxO60//tZlyqpdCmB0+k5+zwnM21AqnutWve16jvDuFuGn1f31XE4Xy298ar9nQH/5t6D3zZ+9GbBxFv5xjIMV6KgsViGq3AczozPweo+XK+M+zBaGd547EcR1Q2mbeMO3q1HNf+TP1+52JjhOIa5WM9m7tL/n7UfrUzj99+NSnG5IIrWvjsOHx7gsWn8/e+p9mr0ujZfP4z8JZZvHewd5gqJ2rV15C9rs/AumGNRUWTpL8IoWIXLJzf8PIdWdLW9Ncxx6XpRFI4DbxWE1Ip5+dNFt08Dq8gpwNKFy+26WC2Duzt/Gczv3E21LFylwpEt/OU0XD74E/dT4LlcxPUWi1owwfYajVbr+HjfojEWNjAKJ080mV3Y0cl6TJNbzLx5FXe7Og1mfvQUrfyHqtj48Xq5hIrVBy+Y0+5FK2+5in6CxvU92On2YYCzJ10H1LlpWRaB0XI9j6rhvG2sR+v5al1ttmr1Fr1ZBQ8+AF71IZivV37UNhp1eg5L8gCwAf1EDMWGgVANQ4EyS9+biIcEP+ojf/5JVnjXv/xp8N69vrzpn3bd6/ed5v5B2/Cbh54/PvRG0+Pj8d7h8b535B3ue3v1g8nxfuOw2RrtH02azVbD8/aPpgdjr7432m8cj4/rB/74uNlKN356eTHoX56fd/txB62JD7VGjZF36O9BxQNoeeo1R5PDln9wPB43m3uH031vvLd/1Dge+ceHB42joyNvUj9oNPyDxqHsoDd4f/PGHfR77951+72Ld27ndHDZbxv/8eWLFvqen6k2rOhivYpXLoTVJIDnyrBPi6i2hEJ+TZSsxUVkE7A13vLOX7nRvaevlpSR9aiU7LhqwJGF3fEIYqLd8b0//gh1/6vRmOwfH9S9vebB4X59sn+0d1Q/PPL3DsbTvaPR0b43PTg8bB40RTsGIah2/Asgyp+mVuJlWCc5mrWJP/XWs5U7Wnrz8b1yRJU58b+pvxrfVyf+AkZi1JUXsHRREK2q46U/gdYDbwZTnsJfP14GxsEfAP8u4XXwmy8xMCHc8f16/lFpMrr3Z7O2MfKi+/gZHKG28bvSa+SvjGrXX4fGIljAJIKZ8nLsrYx/GK/+o39zAdjNHXQ/XO3SSRUUArutLZ5eGd9/b1794vYvLweugOj3l9cDt24qjb169apfQDRqxlWCDGDey6dFGMD5NLylD6Ob+eOVPzFGT4b/CPtvMOYk8Ilq0KTSQfCwCJcrnK9/0Cp4Hsy9aBwE+Tfj1dPCj/LPkdAhZjG8yJis8u+n4/lqln98Dws+C0b5F/+Kwnn+6YO3us8/DdXxTJfhg7GActCsLHBVWA0Q5gqJQP7N0s8/4+UNlwVzj+7Xq6BgclFwN/eKnq+8VdHTJexswfP1CPY/5g/S754KHgJNWCB5KHgDG5R/ul4Hk++Ux9en77sfOgac6WJKU/3UUGH16qZ/dXndLSnfrDcPGvW9VK3z3ofeAOpUGnAgjIM9C45sQ3n/U6/fdU87V1CkcXxwUD9S3vU7P4lXB/v7ewfKm9PLDx86F2ey4l6jfthMdXpx87P79hre4aRrNze9s4pZn44P9ibetHrUOtqrtgALVo/8w+Pq3uTgeHIEvyd+y7Rqoyc4Ri4sq7pW4xkwN8b1KlxUuo9jQFRwMi0VaxK2gjKpWoABDWTkgqVf+eTN1r6N1DQqqBpMjTngASqUfUc4ygsin/sXLeQ6AgThA8WSHc3Cz07dNu6Du3uHNiHXpxwZnnSuZQHRx3YMbz7BBozvHR4SfsGWgE/pXQy6QDVNK9faar2cc/Hc2MbePJwHY28m+mkXV0ZkUJusHxaRnEUEgOt+9J8iZ7Ck3/7CA2oKx9OpmLYJ42mblg04MlovfZdwmSjpzWACQLbmzlukF1bNn4/DiV/JL9wkuANOu3xkAn8h6QJORJSt3fuPonK+1XnoTtaAQisLL1hGBe1GQBsBQL88Z94AqjJgxrZYeeDIqYVCqBA7CMUJfKAstwvrcnZzdd477Qy67g/dX3K7lQzhFioPDbHPxZPngvl182lBl95nGzZ44cijXA5oUJzAjI4ZA5o/56cAZNAOwdjVzQCb0kEZAcos9CYRdx+O/gVI26WFcu/D8KMjlz+/MVOYzn0FcPPDAuEJeN9J5BzX4azM4chchHO/fAJUk6YAmDyegHgKU2hBS+ag96GbGzxvqAN0sybJaA3JWBCFSJ+8FbeCPNTMG/sV858I4Dv1erteNy1LMyhqtbb6LZhPQxwVAgLOgobGL9ercTidAltTsZCHg/6x74k/W3mVuqUbrneHg61UYFkMgEl11PCoIlr5DbrCDizE7OJcrMKVN3PF2lZ0A6/jamEn8CHKwlCuB51zHEt226CLiu50bhpaLVnhfMP+46pF8Kfb9Rg+UWCsN1u0sEzFa+v5wht/dHEXK+b372G/CB73D6zb+hAr1B/96f4ezKv786Dlfui8653mFhrkbljowhZ7ssVmC1vUjRAagEVsym7enF+e/uBe9/6Z39TRLBx/NMREgCJD1SwpAjz5AIzVxiEdHxQNKdyydqNeL6j+VwBd4ErvEHuPEa+PgfdFYgvoEBj81RNCIoi86wWyNMgE43yqEfD9u1PfA2jwUZr9hHIDoAjNeuERiQcKkn/9sVmvG7/DZh3VYVi0wYxP1TIwYlGqid8sudpvu53BTV+z1NHGhSja2GCq9o3DKkL/ooPfN/Wwt8fgCNu918ztNnMN3BZsiwbjfjGphEto22xz37ACXE8+wAOMHJeL9BIeCuoIo7ht1FvtRrM+tOyCmeA/k+cLtTaAXRMnAx3JFYIa8quNvGn8VH59zp15YCIi3115o5mP/NTEhpFGYnJEFIDDyOEDFNagrBHOZ0+I6UjpNzHeXQ2Me3gOILfrLZfeU4Qwurr3jbPLazxfyPcY1JdoOSOjqdugDqOhQ5zcClL7yn4DDn2rDkeRgDapbvxNdEZICPFqF3UcOSAlVI00Kam5uyuqZooCbcbzNSliWnBRV95Hv8J0xkaaeLe6t4rAVs6Vi1on8QOuAxO3JetvlTA9XN3YEV0hAlQmQTh6/VB58BbYrh2PvkY0CqgSECy1rugRVupDd9A56ww6br9z8a5bzDp5n2EVEHKyEy4Z8Cb2BzZKroB5/f6yP3D73c5ZYf9yMrfcO/Jv0ERh38zB5V4+jAAyeMvqMcRr4A3K3u436m0ANqJpI/PXx/39Xx89D/mTD2/6QGreXRQjwWgWrhAH3mIjrdbBTvC6cdBuHTTpy5C43YAYV29+51daVhYVriOCuNtKsANwEYC4aXEl/oFV/fn6AXVscDKwN4vQJ7y7bQ2NvwD0Z5u8WyB58uZPFVmKCbVPDbtJw9i3VSypQRtFsI3KmsCnCQ8LXtPA5xP/kXCZ7KKtwYhy/RF9wiAFh1/ZhxMC/wFV2Bc0qHtx1j1zAd24NxfXN1dXADvdYsBhPaK3jAFWS55ifHtkbRieaOgfhGauOv1Bb9C7vChmPzLrVPMWC38+qXwx2U5BqJyWx6RREjGg0ZpI4uFnfELwNCGOp7XR0ZQcjQlIjbh6StMmIExDXMpRGBKeFu3Wh89F42dUDkjQnHkjfwaFzUkY4VHgYxTTSP4JzxO8RP3GKL5s1FwpR0r5GNXbrVYrHnJBEXhfQmq5gykISyt3HYkZw+mCCalPiDZU8bnYLngmvmXxvw8idpmEikiOThMx0YT38Ccs8W1jqJxA6Ov9L2/6vTMXyKpZhk21TELSLsKuYMNxElf9ywEQwd6PXRdwVmHjSMaYlrNc6T8uSNdqbXNE20cCO3bf9gw8BwgSMI0S7BgfSdRbb+SYmwWcYnYgx00Sp7A9FquQBdAKLMohj+UVYnPFyN8DAer2tcMeh4snGDYCM3E+vAzY+RDI+mdvviLcre0a68O8DkrmhUVugWI0cXhIeerm69aGNZBa7dp4Od5rVrAJi9joqfiHE+XRpebpnvZP9XNlu55thMDawaGm0wNYFE6Mbor/Df8U+U3TMK0crsUaW4eGAEfBz+VY22wvQc6HzU3YWYwbpyyhmeABpG+eCnwyE4hPaVYIOTQv8Sa9SHquKNUtTodOXvNIwh9MTDwRLXb6/c4vLpzLt73zsiaFBCKmAlgo3gyTpgBPxK4wUoPfYnsIoyHZgI9NRMKknYDCYkdMmgP2xltj8hRYQKFNMmGX8P0SRFXzDuQeQTj2D9qHzeFzQX+LZfDgLfHQCDRDHJgkFIINK2D9Y0BxuQxyGGgkqY39YFYRrd6KEQ9fxw/EkIe7xRyeumNxHV4GwgZN2rr4DS/u0PgHvNlJDUds6FW/96HT/8U97/xyeVOOv+NGeQeh0aQf2rQhsOfpKafGIqulYfRN5/SHm6uy/tEu71K7kv/NTvy13I5U7683r2AG7yQ9AYNxsHcEBDuHhZKdA0gapo6FDhlty2ImTDUcOD0BI0lGGSrVfQ1V2hX6utOw8JcOPwM7zBzUgRQNAEEDvi45awrNVKrESOHm4uYauNnuxaD/ixYnSK+FYJ5TWmfYXGAvYSdXq2VUgqZjTclGdJo7C0hlsSf8An3hRwaOxbxoQhuw5wa2GCUgHWMM5av0CAptyw0rPDRuINozKshUarjkveZwh/jto/YG3jKFVWHtg9GamV/aiEKu+q/GGx9gF9XWT8YItme9MFg1s1iGn3yQySJh7mbMyboWhnA2jIfrVYQkxpvN0EztxatZpDqjDlzeOSeHVaqpo19y5KGvin8r9mS4g19xOwgsUn3gsfRZWKVBWWmEdfljt39eYO9IxpohGdkRv87RkGyJUsxFXSRINWbS5QuFJqjTSk/i6hKNg/1StI8LJhr9OFQx4EfWBXwkEVecLptPkC3omi3JmU3o0maSa2WWsncGJ603+KVkLdP4X53Q1+N+pWGJ7nF6eSKQHi3henNLMfNusfo3iZkx8NASf2NJM4tDc4JnFoGWNi5Wfjby1JoCkm3B1cmdlNydwrdslG3DJZw6FmTI5lChnbmNK0InH/0nZ+Y9jCaAdNoJPiixfJHaT7RMZkMmgIn65PTy5iLPwSCFcVIOFJLmk5sQHh7RaJk0TmXjUSI7h+3ieU+/2ZE/Y5wmea1knGWYi0db1mZWW+jfoVsZMTdfTFZumm34RBAhzY/ZlvpSPAhkjTfbCZGyNsEK+kGZbf6sjQ5awisAq9aEQdt6pgXFXoWSTux7rEJG/SBqkIfFthKCDxsObjS+9x8QLNnVZses0qsqg2z+KIuTXE5ZU8dctReY1LjLixEvSuJ6Qa8JW8plxh75W95EIg0cLg9WILhy07gog/rtSTBmNxK0OsvnjpMsip2eu61Oy05PxU4G/AyjF5iT19TUnTFJuUR3hIy121DepAKVcatyQMOTjHeAeEGLMAsiXoQGidToJhC/hgf7Ss/ddx+AbF3n+iZGBg0uJ+I01QvOvtRXy9bbm6wQrEbPbhM/pU0SR8+Wp86WZ82WZ+g5N3jd8hEORXEnNvSQ2l32gaqiWBedLiE6H9oNezuDkIrK4OdOYt6RG6dA2TA/g00WnwRvCFzB4xRLMrTjU0NOSNYGhWja6iMMeDEmwzfcvFj6gvGe9d51r4vlXAQcNA8J25AEn2RVdMZFxWiGbaj2spSZTAylyEuH/d7YOGaXWALVnQPwJViXJrF4/GnDmOi1+3PndOBuY6kTHiKyte8KmCz0yhutA3LHyluGiyEnQQQKEtMS/AQJi55oUslTgSCT+fW7p5cX14P+zSkSWZ0bFA0zb9xehoswkgjfprAUlwVJp5VH4KEw0PmJjJJlcFDKh99CGCVUqjQ6LPObCckgJzTw5AxdLNhT7Aw3G93WAatK67UcTHqhNV1i9ZjTeJ0YwBuNo+PGfv2wWSf4EsWIA1FL1Q8aR/v1RuvwqKX1UqA5vOlcd897F10t9SG5EBEszQvXVSMkpkas3wFLrt4F/HfeKTjzwVRWYnGBdokkhrKTx92THoAqSM/ZWBVAnSbc3uCXq+JzJvTgYgjqWdkVusdqsyrepjny4QtNSdkh1x+P9r56oKrckWNG2SiDRaqpbdpp6HAn1vhHCryYuMJXCWffO+wTDUO+uHQ7V1d94KDPRIiAqfW+kYog5dxJXZBYSX4XDxJ147OJi11nC9DAtAA+9z+na+EPW3kumdVkUqVtpUQ70sMbpliwyAX4dJf+LBxThIzZToOw4xAA0xqKN4q0R8b9MoBr5LlaCpNxAT0CU0rqJpD0pytcy/E9apJy6FF447JWgodVzrmm5GlbkZrttBhcShB5bMI11+Eh0i8UvTCKZNB5c97VqzpUFCzaUnCJIKgVbjaNZKh1VlUWS6CjJxlSaHxRaEJbIR/Zdp/LxNXc8IrWJTYlIr/K4mvR2UYyxdKlSqp4Z5WhaqCVO4kPrlIxcyKGZTsnlqd2568qmcFYKbsjrfTl4H23L9b7su9eDwCBuafvkZ050xMXXt8U7kpNNHPqYqhBwuHeXCPsFNGPuF318JWBqaiQOpMxuGbOpHiYJuPkXEBDk4aby9OO4Hjy4Rdv1hNY1XYBs+m6wTxYuS7IV7Np7NVdeMSwRE3qfclj+CGchytkxCrWiXjN9Y3YL1k8R4ZQ+JflBbEYvdAgSo93ttuqMqjvU0NAR/5u56yQ14i5bJ70FICKNCUlDDc1zYPM+91tJWRl1kGRsNCj+DX+QWIMY3bf3Jy96w5KpKkwqi1oAjB0MQaYgJVf7B0n9pLbQqRynEI3upPM7BXXuFzMzhqQ4/IushO/dBQgnJFp2hTl404nkYP8EcY9KMFIIBcQjBaHEbx69epNuJ5PAJNhYKHR270URncAXh+A3Pfm60XN+IDhufM73NwFf6IWOTJuLn64uPzposh9dCo6bovPZJoywuEhQO0Dz0aUET+reXiUBRAirephiSMqNvAPdBc5fd87P4Olvu72f8zDqohswxMVh7nVrsKFHy/0ahLMHfVl76pLj8P1Kvd8S9sTWQEn/nKZbzjeRfnFZoOaS8jep/hojiTavi9//sn5Yl51gI9rm7vraLkbjYJ5m77RF/4Jf4AZOAccD8VO8eup2zk/5x/b98Yc1uDD1Vmvb7bhLEH3wTKcE+UxRcgpvIYOdkHO9B+DCIO8TevFfby//NB9UQ85A9/D+pGQqQitrJ1xaPC1eIBwynHPTuJLBM9g5zDSK/Usgh6cLO6lrfMnTh6fA2mah59nPsDzhCPBCpiRaAVH7cGmCObIJvpHDF9FwgxBp52Mv/sjal9+6vcGXduE7bRstShMJVcWcZBtwptMWZiipiy8Ma1CLA47EfkrlzzuAT9UePg1DMich4CVOODtBFcdsOgd7sqyUjDHnC/48qmQ+bqHhqkxDEhH3VCJOxxiKhiTo8ctYq+sRHEa1wJEIvCIluhlo+Rc3CgcGy9iBdFcrWHHTVpWmSsC4E1opEbI3cGNbG84G1ABAfB7qaGy2vR7x4E9+bwELI6xeDWgZ6Rwwldteo8u+intUGFo+IuC2hvfOqj9j0S1p2J+SxaOaLNcOdy29TyGUFo5ALVw9C8ADuVXbTwLI79S5guiUxqk+aVo5TCayWw8HktqQmCcDQ3R+uOOE/MiNhwBD3fZBpZgp1GlaUKHlmVtXhn07KZGy9fkZUsSLwtNvOY/rtClhLqxTlSeiYb5vYOhl+L0Xd4MrjTuU6j1diT++uwFq4rIM+I8eI+VWr3esDcffct6EXPMtb6X3EsORWSwPFJtvSYYJ2ATW1lhWLDEL9767MiAN/Nms0K8iFul34ZgKpme2iKczSpkbkG2UAemAE8fg9lscReTh0UwsTm3QO26927Q7X/Q7TdibqNwV/a1rkYUxq6yYwOu0n1cBEt9UMI2Q/2hd35eBpo43MLRNkvP+KYRK0HyAkZwzXoXJFG6gnsuhOqECSC6nyb7GcqeJt5a8iKOtaDNBCeTtvpLBzWCkU/z8TkR5aO/nPszdwXHuoJZMFgUoTwJWhst9E5lLWbsI8z8UqlQ5qHxLjJx0VO0y/40P3T7F91zl3jZ3JGYIO4j3p16hh+Xbv/s8uL8l9/p++n5Zffn7mkRewHSVow4AWkSrkxjI5TgBDISgyAL04k2kkmeUGiW13U6KVIenPmfgrG/WXnA666XnoWAxx8n9AjFiNsypRAMDQr762BSAemUbRAyK0ntwRvfB3Mf35iPRwfuQYsVnpyBpYaKp3BaEb/G7qcwmLgLKHxkm0R6y9ynH3xcbcxDIrcZB7w7j3YfkE8/wYlnSzTi1yUzqgCOjlbuxP9k87dgHsKYKtigfCG/4yvb/IDaRPei86F7fdU51RjrgONQhgMDBLySeSjGiE/LR4gl5FDkdzFK0ap8q/zksbKlpXSoD+iRFjnqMVRXmF5jRL4Jh20xC1Yz2OKI1A5o4XK0rrtYjlhaal+HXBZ4fB0sy61Dw5G/cOhxjVxFKyOzqmWegym3cNsaOs4IFposA7HbKb3bqGkhy57jNMRyfWBt8QkPLbbjbTus2L+WxtWkcR21xVHgh3tisMojaH2nQY8xip/fjMzlZ5PTZmCR/aFYohFgOCs92DLwAYh78P4FsqkCKRbiOmD0Mk8RpI7slmz8rPtjTwM1iC8dzFJUYWQLtXdJjNvFuVqAF6Nw9okwdTBebXQiKEToccuA7hCd06IE81VFhVVZc9fEVQrI+GLhRFq2ef3L9dvrxJSmmQjGXzjYRI2/l6YnyXaMFXZNGCN0WsPJLhD94Y7XTWUA3Q2bpJ8VG8FgRq/3G00A0tj+a5vlOvYYz5OhDZGvU9ILWgpEJ7p2SAte0g4vxYaWUtrXpEWn0Tw6ah3XMcsdzOysd/2DPuyS6sa77RIo4p8T+QLTvImnmg2Nu3foG7IA7hzdYLiGDaegbllxg6t8MWAX6KgUMmGYOqw2xeOQTNTmp5TQovvz78qvizcaN/LzH66v//muOyDAh1/wFRfloEVe4sh6VCmEfxo8+nAywvFqFhnh3AApeoKy0hjAkbQxBc2TM4yikGpZJzwkakYZdv2x0Tw4sjmNEZ3jE6nXh7adVCBCxeyZXFITCJfa/kz0PwX/2+b55bveaefc1YT5x7snXfudLyaRGErsF8EofOHbKzyQKubfJu2/Tcy/FVL6JJvSNtpEyheG9TB4SqG0Nr8gNGu2j+RPxK9muyVMqclb/slv69t0yxPEqCw8ekwO0FdZ9ENvH2hQSDLE42kEP4maiAcjIFzoHL7Ccuh+QRb7i21UtSlXzfTZtRPE60rbfssWBn1RQ8FaW/QlMk24WZfSGGSKcjYkZ5OYXzqgmEWpkP+dBnBCIodssArvYTqm3bBS3EsxulyT8hFRvvS0TfFGyJZAW1gfnxSBMAKrw8NgJTTQWuTTYK/MRIxY+rXpejZ78Fbj+8rSvO1U/+lVf6tXj93d6vBLwwas+Wza2BYTR7NWM2V0PT6V89pFfoGpOXGDhacKF88xiZKbO1j7RJGP8GVePrq4fHt5fn75U6m0xOz7ysO2psT7glxzklB+b1W7dnvXgN8qWAyPFMIyzyjhXuS7ZZp9ST0G0ot7bgN0n3XL4yekvCNZRR4TSWbTSWFOEHSkY4OoKKd62AmfeTRbztuKeFWL7ZqMTamAZWeOkALbRbbRaZTumBI9FXeCZ9Em2yX+sYpaEyCNHaebLSLrBbS2lMaT7ZiEV63tGI/XdMIp3jC9kS+GPkU7t1b2pT0Iw5kLogmqDisa8RbLRE5hLjrK/EruL9EU1x7xoo9zaQKqLBwqMRGcLLP2+T6AQ4htEHJxNtjFNDoRPJxYvU3jvMXmhkDBvE9eMGPHIrJ5PJ+UxATCbs+Y92aWuYjXPqEThyVZ3CxjPuURAqleyvQ4TPUw/r0e1ptN2xxcXp67V6iLur4Gjvra3KZdXOLvHTaps12d2znVBFsg80/4HP1WZ7BJI+T9I6GBIs2LUD8R3CsN7zS2MaunxsJulBgUyCLkr4+H0+75W3PDGNHW69ziCcExAnatVkWqLnYyJfzuSEBjlXyq+I+Fzjek00XdHJp6Y+P9np3S1aCyySFuqSjYCk6ugwrhHZjL3NxBzZ6kUiYF9RLYU14+nWS3AiTgLMXgOT8tHoEqELP1o1Fp/lq7BRo03JGflqmb8jI5YUalka9XGNYMxA4gF/ChtxwTjON4bJxYQjaolJokUOzXj93+tU7U0x45so6bcv/a1DZm3SgMyzHx0KVZzHhfE2byWePnjEPIe2l4D+4EZoX4/6lS7NicV7To2JRttDeFeDmthgmc6QZNB+z5FDOeIEodmbsArqY9YgYiun8Q8vr0NhCKjdXDAlnSlIKmgg3ETJQ9zSo5sPZe6lGOpEWfvUWx+gpfZOZdsITEKdI6hYtVZEfrhb/Eb0SgcKzt4qlTEAx2Yf1DRJia8xAfxBxY3OhO3Gi7BK1PI6kc/DSNGLVrFh34KHdE8Puavk+XhGIbBwpaQyJL76jc93vNsq5j4HNkKubaw8cJfq8slj6Il465GFdVM6ppQx2Suq0TpNn3QCUqcTN2PTys18uiGGTJLKgrho9+5wP6ZLy9dhVZJc8UML5xEVFW8HjZqI0n/0F7AhNiF4J2LjvjFQn6xn0IHDjluPMfx7N1FHzyDdY4GSS/14yOMb4PQJ5e+lWkSZhA1/AwKBUWc7zKtYtlKKN0LIBTTv2Vhw4OFPsdfp5z28bncA0Nw75MZxi9xHRvDacaO/6uiODQBIHWzMPq0kfqZ4pfK382q/IhoEfYhDMP6fvnYOE7c+S14p/VmKWLkjcgCSImy3qZWgU5HWFl2zgieY55EN54pfP7xsI7typqmk5AzMD+gNMbFoV+4CK6wYN351d4R2wOA2EnTbnHhFHtBPI0bOGrV6+6j/5yjODFwffBHI7abOZPDHJ3WO6+PdsNabdIh+IBP4x9U3IG9sAwUPAR0czI21BQUd6FTY2coNGRgLeyvzxbLOollIdlzZWeKbWYrGE6tM6Pnd55ocOr7JBXSSpmHNSpiGSJ0rRSmlWN+0+zu/GgvoblFQTVWa0XM59CsUDC4A27lQ0Pb2O6K9G8WSvA8rE2u2k3D+w94OFEte/hSatl12Glrt+S3lDOVccKaIRr4E4q/9lu3e4DZ/L7PjEolmRUTDnqZGvUgVtpRqTfRS3dxnEgfDMbH0OvtcvxolUCPVMVwLE0C+Cn/W5nwBJ39+fT89+FVP5TPyWFAwo+yKNgjWOUqrAE9PlCTSXK9Sug/mNMXIgeQwyHsXirtVNzkCf5zueiUVESXLAjEjSZC1cUBZOIRZSpxaM4HLMobQLHSriOVnhXfXnn5Mabm5CdOmllIocSGEcdW46TDWO2zd6HzjsEl+71oDPoamMgnQor1Zy/TWwKxIEvwOH/LUbYqRiaoa11+leUnjoRxIUVQvFDJa78XSGvJGjaR+QhZifOxFDASgsspSuEWienDniOAkHO+r/0b4rZ9/UceIxgGviT/xe2L+m8cAt52O5PmJjP/EOr+u0WlMGKXDtLTescNoSRRHwK/+S1VQKXmJ5z/2L2hS72mBjH+VKJkqNtR0lMNRPRqBiN7CTzUh8XZTSTSeWcTMIGNV8DOuNnpUKN87+SfEGEFiT5F3hK1rDQ7NP3733cAcO7A76DuUJkOKdTn1hW1IdLKZ0Uvf7nGQYgreimHV8EmBU2LSIVa8Ylmo0Ej4Xsr7cykBY+Ae+1wlu1QKoEnjhYEm+0Aq5X8jvkbl5kTwI++g9t1PMWhKVOssb/Z2hNfvt5harxWmU6Nn999PbN1woQ/W/AJCTcIjNbAO/K7trKrqMiPkrC/ZN9j9OQ2hwsddU5O8Nry7bhT1NRpCK7LeMOU0Kn2ZYdPG/hW3VCgu56PgvmHysPHKrihh+Fs0Le8epKykzSh+mabJ/rZV6+dNm04zq3gmibduz3NAvnd/ifZVfipBSFLxcov8Vv4IDjQwB41GApL2C3l68PWvjyUzjTvBzqZ9NZ3q0RmF82q3CRH9t05t1FBUOGnYGJFr9QngqHsGHBzUPEv7B4S2BHKbvEORExxGS3dhQbttZ7MO2PFq8DugDtNws81nIrBSWF4rjM9w0o8OXp4NztvOnlYxRFwBrHJZ1k49cSPafIdoDeLNzaoNMvikUjJ4UEQIsWCGO+4D8rr1hw8rCwZ9ft9CpgD5Z85k0msCmRfJybHvkQIMZG54Fj4ZcMPVmWcGy4erdLf10pLEknHbqU4ASkKdj5GRCjXehql3UdNX1qH7xKsoJ/pHaALx20o3C9HPu2vA/HFsvqxtdu8GHPQgrd06Qk+Fmsl8BH+JTOR15miNHT1LobJ5QZwyihTdfjTG9z1EbCtzgJocgGlMsK9F1ZOrA4dVByTRk2gPIojkykyMCvwOm4sgP6EaPFeNzTyBX3XJCFfrUWbZCuhe/jMp/LEiPhGlvZdDv00HFw1QCvn3cuNqU0wgpJQiPHidMZ4QtTniwoIhceyshb25KXyl7Ae/6lvE7vDpQQwMAj3BhxnlIPmKgH8KrT4ZdW/dkU0MUKbk25gxaU4x5RNcH3i7697H/o5A8vX+TEo1ZgaGjjZU4Au9amHbmNoW1YuDnqewcAO7nbErafLl2U92Cik0n2UQqsgevgMvgFmdCHxcp8tk285LT7szZ1kujfyYxmC0+HWnW4s5v5DUSDW7hVpzLkDUleKSMckn+nGKQWHcdVc2syRKScKyYWQ/8y7t5u2I0ttjFGFbp9VAo4Os8nW3VTSrkmpRyTUm5JKackO3E4yrsYJd5FebeiTAaJnGNQ2i3ILvb0AWCSh1MHTbHvV3ZRTjacXjqVsvht8fIxGBXg5EpSUVnToZ19TGuoPlbWOf84Vzq3aupLdf1ybcncTezFC+x/Hf4qvleqk6VuktnJJBuPeRTQIZm8cNOlUB8KbxPX5cx7BUSwnGLPyZQuBIhh1kVQi7vjpGvp7vkkpE5pFgbEKf4uZ5JjCFNobwJjdG6nUe6kTiM6m+o1U7YZk93kVilbXhRlJzdA2cm1T3AOUCa6/uV60P2wiaJOQdxSO+Q1I2eLZr11ZCc3K5WdDGwlGR86GCoj0K56KrNMPM/SuVltuRHQJaaDsQrdeASdJ14ns+70MLf0/BRXv8Ca8iyNKZq1lD5CtsxCyNYbkSNzu1SE6oDipzmzDxYbkSmPnBZK0g0KlyFOn5e0MGwnnrQi3aGT8ml43tw0hVRuaCbxilDyJiYOEM95iFqaaR+PxITCc1CMJmkEVBiM+6I44ub/pjji5qY4YlKplJIpXK+PQmsmskkX7IG0Eeq2miQCR5MEdWOWP1ZwqypvyXsTGFopdlyRaQDN69K2KlXSIk5RHTFOS3DtnFxng1wRy0TQYDqFoGwGiA/IEp3zDQ3lhCZsMNPFbTad2HB3N08zMshZDOPttU6cx7gmFmJYSEOqGWvGXKxcms4oHqQq1w1l3G6CnES5lKxInGeS7/V7inMvLvi9c5gsKNsXTnLqfaWqABo7u4Y65anEw4W9b7rIqBgnp/CcNjfs80ZKmc5nKtWZcRrPErSb4lMy6WNfmjR2U4ZBuh40q/JQReQEuuimVYAt9vAU26lK4soGpgCpcHPUEiV4UAenqOHN+z1oLfxak/vGi3JSRseMGa/YgmYX+yVt7KnEEWMLXfizOGdp/XhWHRaOIn/5CYWf/1kDGtX5wqg0XxSl48DoLtZrKTos2X2/+983RWl62QrjcGSy9Mw+SbzKEBS280RQXXwcYdxhSySiFjRrZFH6CTDpouAU41KZcyxyFS85KKKBJFTOUVOosiOj5LDhvLzOsdvfO9kmgHe+1qdXJeiHM0NLc5I+AUXLVbJkaQe+jC/pSZLs6FZNdDR0dC54qdH9UTes77TJD9DHD5264WdJ4gH0D4MSlnSp/EZoIXPuX5BG6k9EEd8SXXAGCd3OpqFNrvF3xfg50YO302raRC3eFrrZlHq8LVCLZKOQ60mrZJMSAuGU3I+h6kXbdIN6gp2SdmK9oqJ0b4uDKR9IJTxnaLW3vWtAP7I0E9suYWEVjrA9jaQSn0NBFFV+W5wpfZcKMW7j95gfJ8YRJSLyvmd3tDRpFuVVUp2rou84xxG3c15GMRecw5El7QpGpJ1lctODK2ZScgaMdvr3c3H0q8ZwlIfaPJTmrUjsZVxmsM6dIcDK/ixckLEGj1ObRiGgCS/2oOHQOz1skeWlNHL1BeC5WI9mwdj1H3FSsBecml7JRE1IM+Zx34DIe4pxdhITXVy6pzfXg8sPIC+T3sh83j4HEToVS+rRFj6oy4fV0vcV98jCi07pdMtENFoLIbLW81WFP6R5UN14aSMsvxiE6+dFCn6MXNQnf0l+YqwCewhWWcOgT0l+oqyVMMGNZnrX7cwWPpcw1TyO22QQxImjjbNMoiGblqwqBo0yDV6CVZC4AFcK/sMQg8kKM4/5lOkKHlXgN37/DdaxBlg6ZwXidXDUahheFEQhWtE9uZBpM5h1IpZsi3rK4urvMOC2a6vfMDJG9d3lm4O4Cd1rUft7XILvRdmSHal/XxGFqqKmVaO7h1yRBawCYnSzVZer7XZ/vur1S3Imy5kq8JK2fsoCKgwVqVYYd2wBTC/R0ohJvOldIErQmgETYBMEu+zMiUK5Qyef/ykWzZJ1KbQ9OlnTZvr1JsukWLetDZSllscXWC9LDZRsl9Y0mzJU70lDdRb/eovF7OnbCaSC8ZT3HZkMRyifdq6uzn/RCqjEyMaEnFoZnggpM34sWh2e/CHuoGjr5qukFzHkYUHg9HrOqGJSbG3Q0LL8mJQRZ0ejdPEVMvzJ4t6LfMe86ndJ5DFfItSLq47dYuH+W0jxCULK8PwFCmzFkM5n80Uq77LLXONq6QmnWpT3iLFiwSmwMrKSllYhbQazTRkpAPJr763mzqRvqw9YCpfkyRYKgaxy9wWqgcR4L7tzYk/PAjWy4vZZqIRErZUQjvUrlcky/s2DoKRPN8UOUrYeDDaMMBXBIpjPMfzsPpz5VQq1Rjs1h4RBmbm3XIbo2h2NobIMU6vpMneIZITkzFoYZ6e4SlvWyWdNcg8ZRrR1ao8SrVQ668fnF6T9ULN6OEkT6hTka9tk7cvbs/KEHxnsJ1EZCzXcBCXUAtZLR/eF/jED4Cf/xuCcbRzAPyse4I39rAv45+18wEtCdHitypKQJlElbhbNpy7ciK1pqVOtXAujP7bZQEvBkqr5UBRgsXURCTo/9WJ7lxgbGmNiKVgMMQ1OwMa97fU/6EEp7dGc7FgWTl6nwmlsnbLFbm1aI9GOmvsFCZKuPZmxlNSnqMNMZhRPVSY1LZtrzu0ekcBmLMzLk8HCiSPHVyPigvOvOLhsRAKpk3fL47HLcC37TFPeKI1B2QLGu1lXzqdS86uivnLziQ/qCZ25NJ+16Uoc1egR8yG5ScQRIrLORyhMH4nvwjSiVOV/cWR7aeciPFj68EdE/qnsCJjR6kXaNtis9WyVeD23zXfdSzjE/V/Ia+PCxdhuFDAQKuCtMrQEwEv1bH9U9f3v1PSx5OAKVU87J5skWiCQnNmoqGreywaR8LCxijgHSXaulEzyli66WXEMHcbOSrINTN9etwlk4jwZ1mv5m3NlCEdUvOd8vboPl8Fv4to28k181+9csKVl6c98AIjSUlklpzBwvYF6XfqKCSD+ILCSErZzjjdryfMcwyp9/P8RNMs6LIDaP3HL//16bbwUpKJVpFBumqeoBlv8Ccj8HqvMxIPbBjuHmlVpx6tWSU1jUnLrs27pJXxxK030/wHaBf+KdMuxw/7OroPef2o9NMySnsb9qdcv7g5vuBDhl/l4zKQpO31Nce6KPyaffN1a5XCfTMrJMjiOXAO2LzUbuYQJ4ioA/qgkFwN0zvsfbBEc/dptV1yidHSHSwVY+NU9iG4VzmOTXO9g6Vr30eH7AePB+EFv0EMjSr/bOc9ccbVlQgfO7qrxB9mwCoUqu+KrzxSNBmd95aRjBWnwcaPpXjGTr+QQufAzdwPouZH4VpqGHd+MJvJx8dVo8qaPkxwrSVi2/pVI+q/GRSgKQwnKrmbTpW/IgkY2aWjE1VwGJZNargIPnqzHdEtYEBlkVYvu/UlNTwMaGnyyDXzU08ghwGsA0FvWdWFjXRcRheuabdxw/zFYVRhzbLrBp7nZ8xb1wstwNvOXwv+2/q39b0vcb5PONU64qEnvX56fQ+W6ysu/evXqPYh1/kQZP4UbkiNxuPCXhPBFohCRK4g037tMD3cBafvBYsWJDKJMAqDgAY2n4nr1/HNpvULPl8kq/x49emfBKP+CP+BVDSlIwfsw/+xfUTjPPw3VS4Eotx+CMrQsC2BKmny1pZ9/huxJwdOnKP8QJ51/ul7OcEp0YY32LaWj0L4VeCr//reAEpmpZ+P6qnvqpFeyFi38sYvL4JJeU17gWzEZ0FwEC9OmND2q6lSBSxDids0C1/AUXbvP9vsQTtbQH/WMY6jg4KwT/FubhR4gFDiuMDQuV0nlgvvpsv/D2/PLnxyzdhes7tej3c/h8uN0Fn6OUBidrMc4heoEWGh/Wb33PbwV4qE6Cby7OYwtGNeeHmbqoRDWp373rQP8zzTaXXl30NS4Ol6GC8r7No3k7JgRqzbrzYNGfS91XRb5CIpLJB1TGQrpUzh/XML5VyUeYTV5FRGT2pq06GAuSAwbQRvAMtUqUSpds9RlRfXatUTqh8zTX/+Z2ikgTGp+0II8ABdh32ferZIGwtr7weBKvnsPTBHgFqtdeNkpl3FFRc5Z/ZqSfb5+/fEzfonT8pI3YH4Unave5jtgEhOkvQo/+vNCu9J97WujMJPmiacDIb43uOyXJFzGCk5SizPJ08gc+ssPJqzH9nO3IO4Ah1a4nMoqcj5HH5j3iWOibz08ecITxRHgcZYX4FyRldAkCEyvC2VjBHK6S0NHHY+cjCEySKbvrcgV20GFBau2s3P6PjVlNGT23OvTS82l76NwwqY4vvqEJhY7WxP7dl9TJDMuoGGsnAz09sUymver1SJq7+56i0AgGDyA5g4tLd8fC8OQi8wfOmkMsY+/xGj6TkageuN7S+AdxCrR9sPsx8hqwVs82wHj4t1P84kYxw7StM2elObP1XfB6v16VO0sguqPMrGrCUirWW00qs0jkHpOQ8Zkg6eFn+mQenl+obWDEvVklnS0DmYTF40swLwleMOqifTG/2PHl84BV9bYt1F50bBTIFHNQoxlUTrkpR8twnn5bYHq0ebSNdYpOI48CALiBp3BzbVZdmsZyxRxO6RjB2SJ114l3SBbzqLA9w6x+9i4LolyhgumegjXyF8LWBYiH98+obnRWfDyKjNBmLiL38jHGL+UeBlzFVahtuot6QXEeAKfpFDxVs3s1ZuZZuBJ2U5JxsPhVsSx4cjBc/GOLweAeToqa1SDH5w5UbZhbQURUK1GqifM2kxH3oxzf+O7NQiPlDJdfYiKamA2JqmH06XH2ZXKLeMUQ43lkUGi6wl8kGgZZdZGsxCxDFCgz8F8ApxMbe6vTAvxq66KR1xAJFADDnfMR5qwVWnVaK/mPXi/hXMPOqLSQMBQx/YWXR773TMQV08HpUD7V+PMhz1AecGfPRke5uGSlIhwAZxqsuMyJjJS6E+gxVpJ+y9HJxp0HkNFjGsa+1sjkA1IBIlosm4SiZzoUcXWXeURiewldYseFdHZviiZ8H2N1TCIiN52euc3qHFiwafgOCM7gWcuZiViNkzQckEiC0g8GiWIRDJphk92WjYLb2GgCDn1qhKm1Fv3Jjtjm2TM5NjNeqOoO2+El9YCvznVX8wgrGpFfcERg+fTr5QLtiCeqfnqcl8LRM87uhGx/5Wz3HkgJ4xXa29mIE1A9A5deKyTiXhdxv6JEcJRXRqohVijQyea9707ONq1MuD6bhPQicAIt3OOV2H/4oJ4d1EUPkUJj0f+/979+Wp28WX8Xxl62JI33IL3e7b+FBbuBWgVBY8tOCnWnRL6A9l8Wz4q5pqg+p/DMyWjzLBOsSNr58119+JUtT7rpFkB/J/8uQcHsQJAxFe72yRjCNuUSLiUt3eAOElgh2wSdEKKOhIwhbsqGowwqcg853CpUjUsjoIvKU7R0o1tknjHlg18v1gGnyiBCYpbJDQC6r15c947dRPJ1z3rXZ+eX17fFJg1kg5TPni9wfubN273x664VJSicYMoWvvS1ZbZsoJKGIjWGaAOakC1GgD93NAlKoeLEukqO/eJPLCpJwpjF8lmYB8P9g75OqkFrok4CPG1BumKsOPX1zf52cJJv0MttiOKy7kMT8S3ZN+opWhXPI+EC8V9TTosy6bQaZNcmS39rEQjXNRx0lWFE7YooTowqyXV56UcbdIX7RacJXOoMJm7Yl64nKaV7huZVQU0oXsE1u16Y8OkC4x4OA4YmeLmwynr9s10N3iE8CV+MhDFs1Rf2eZ578euSy1I/V0B5Eh38IL1QwfwHFUjPOkUwG2HbvZTZ10E3YN+7927bh8ji9IVtJvPPSLfLwbJ8LXwlxglAkP9FHguEwsXaIiZpOQH6MD0j41W6/h43+a1FHGbnYuCK1BRV5kAMFuko13SYKo4HB+Qe1mSfk6gMqdoXa7fd/BAnd708cJQ90OnV3aAs+eH4YyD+jnPElIoQAmXwHS4nZvB+8s+5tQqPq+xN4IStdCWaLAgpKKdOmklARbtYoDRwLkMbKCLDjUor3dGvnhq+EK78WzjYucoi/+4WgL75/4WLIiatr8rEzgUevvP3lUhvSUWQdgWav8MFm9RLR2EtTfofNK7pCaIDcDLi4JPhVwAxhVFjihQw1+Yb6OSpf5UDHON8mg+dD+86faLdTRJxS9BDYdGgjvl0ECUTS09ozc1asVrglHiqwZYJ87PnrmnDjr+nveudXfWondK/oq1OGsHRU2JTjdzEExVpmEtiNBRvWLFqgV6ijll3RGcrr834hex8/D5xQ+0SjXYZlRWzBAglv/4R+PA2kIXYYge0O7Dd5Td16SdWkRSwWs0PWCuU1EkBg44oX29pzFn7RY7TJwiNqZeY0Z6VPUes6RzvZycBhBsAuAjPQsaefxWnZMA6sviqL709t7GjfJ9WTFPSa3qLdlcOx8GtFwFUzyHFFGDPJ7iUmSnvIPSqVtzB5ZuGUuZ28jQA9JG0mCmyozu6rlL8LVQHO3KUUX/ya3SrZc75t+BYLgg/flOo17/O38pwcOieQzQwLC+MeaTQ/SLexC/i7ui9HwNWwbXosVMajYKUvNyJaeomfwFuwppEMWAqxMMbazIS14JV1iFoc0UII/gYJ6kuCAYKh8yIOX8OsPDPFeX9CONly7eIDbchsuDgreUAgunJq2hzKvjG5Q5CwIj6R3f3KrhsalENjivFJNQDSWNDmILTFs8URoch3O6WkowasI3xJQ5VQq4dBQPmfZmFUCSIoPMn4NiscTJwuJCWlASyJWZGL726s2CdFOyFu+ccNTbYBZLekpiQ4UzfdvcAZShXpsX6+8QCZ313hWF6ZEV18nS7BOK3qN3twoBiwP4xJs8OdMfkHhsKWsZ+TGym7PAJLSJhYWlxyJw0CnsJXjHzhVxj2diptcF+GPL5NVbZtItkYgKo1VTEm4urNRxCHIVoUkbuSqM/sVxq7EUuEHYKwldzaEBlvEVqf8Fon4i/+glMEVI2ihqafFCXtBSnSMy3aQl0S3ibbfsehu5VGwgCYAlAo8Q5ggqPI5NKVw7KrCCEQCKx+sUNGW3EOHkNL5WhmM6VXiHvLy/WTlyX2LSStJHGofayUspnsTHY5sLzePagNFiN+sMeky5WKvMUdZ3OvXzOcdpAfRE64c4RhhZLQFQJCCV8F3Cr02fCCMteiYKa0s6INhb6ru/PoGECKZOfObNYu8fqe3+1FDTFN3X4kRFhVKuTiZVUi20FZE+9pxHb275Rnqn4ynwSbEmyqZlZ32k/ibBOJ8CICMJfy0saXsWpVIHRADLberYDFOZTtqwn7UkQ4c2QEDN2dEGcfDzjgCCiT9beRXh+Iw5MixLbS8rfxJVVEm0SMoSXy/7XV6hFrAakoxxJhpRhCoH0Ir5AEwa3sLXpsNjbrXJC7pVNDLbtwqcDHP2BnjscBuiyInGByuTowXKWkquiA8fevnDJc1eq/AhGItsJTVjcO8vfTynE9VoPQ+Nq87g9P3uWfe8O+iiCam6XuCBZKcmTfqW9JKhwyCuF3ya7cSTkJJpmm3481yiruUWb6kyEIekupprBc7J6F9AFuKFdhz4SBYCL0QEnHP6Q16CIstfwix8hZ2sRAFHjevGLt8mQ8dkJlJIQPDRFCuYIRp/EKG+KZoj10zPUWokgbu690oMEVRV7ZI5E/E4BdyOUwr7pSzJ7UKWohuXUTsk+5AnZggdpA5NaiTyLKJAR6dRLMzlm//TJYcNzdrEWs04IZK47FvGF9Eqq0irKAFRKmdTuyjVkBa3xTnqJBHWE5NvxQGA8DSP0Ne4gvH0Mj2IjW4wrkapImxbzovcnKVBLBtZQdHrEycJ2xHx7CpqllleEuSc0X2KVuIQI5Qf3918oONeoJXF7QR4cczFE3Ds8z2j2jOqb4yqYe7gIuyY8EU0WXivshlRPv7qW/hDF5jPAQXjg4DvRBZz3TU/+hQmVQXGsyCTBqau0wGDWcXbmN8gWv+A5tInuhaAHvY4F0ngR4i61TfXwEqPVxiw8IP/dIoBB6jIogIlndyAbPMDENI5VoxQQ+2wmJVMA9+SbzsF4lKt03A+h8M2kNbsemkf1xhZtOzMgk9+DyB7CdKssx8PO3l5iuqwD96j09Q0py7j9fV79+YaAO66C0gdlnLH/C9zRy1x1n3buTkfUJAKplHgfR9+VxCoDZOwXWAIMFibPKsb9TpqOh7IWJ2J/DqoqwfEHnsLRXFaZm4UYdf97ofLAQb+f7gCSorZ8tRLy0+ylnkYW0muOlaiCqfH9E1Wqswi+Jt2wVkI5+r1VclNTxQxuuEWq7Lcc1o8lw7bTEcN6yIvdbGWWcZOKMxgRvngYm0osZ0LDH7W7iJlGWNns2yOMX7qOLyov1fiwK4pu54xyRULjJe/FYWVM4xhcxb5yV8jBGtShCejovbVW7Lua9kIYRqmKKe9DUu2U3wdVindFlUzmeRKlGdqh7m0caV6tG3GkQayoeNkcxam5lsIc/L6GRnJu023xVCabSneWF3uO2lAF62qJ6TQfi5BLKVfLgKvciWt3EM6+thEYWoDdeXyp2xD7odSFYimUWlVKMp9lbstQaxseZKIxLQguswigGFh+vz8gUtWuyDsXl0osabAzhauwJckT5pdmGfIzqWLsfNZVWx9ipLnZGXed6675rZh4kQBlQhg1WMBM1AVR4fjtyUQLl8bJ04UlLwUvype7kShwE7cFhlHeQdzIrwoW8CJiQv3rt93CNudFKn+FYY4uRxQVNQYKITzhs5344SsS4mxNLcMKW8vEL3fw2KkJmjHgWe5WHaM/Mk6U0n18kkcuOpwdkPEHlQjrXdmj2TeTywiY+wUlQPWspJk0HrZMQ6VzWZIrcQcFoML6vniR8DOyYoWXsiXdzYqCeT9iqDkxr/zUqCXRCXnPHBBgHc6V71Cr5cktG6Yljveu4PLH4DFHGrMRKT0FRTT0btZCv/KPAXKbGURqSFXB3JxKBi5CMtHFbqpej8IxweO6TcV6E3AY8f8dZ4wNfCGf+DjsuQ/9e90qRBfhJRguov1ykwSYNYePqJ7Ci1IPTwEkdR/DACDhB+Ls3/nJA19noaMxB4nPm0L3l9mYmlLJJXVKjynpPtSdmALXle9+DaTb7VUNsgkEH/eljUo5HDj9OjbtpLuHKn3H89fLqxI3Ysfu+e6iMysIVfhmU3KT5LwwpgMMyXNvSCRfJ6how4UC3BsOUyxKFuw7qkGLWvbBd+Ov88sQHyTl1xTHaVltdTL8JX0QKNL/OSNhJWUzxtNEu8ez3sLxGBuWe0kN88uNmYxohJEOj89usHQ+nNwo7KDgAOLthUxYmozknKZPdLizsUS/S15Z3hDtH2dGHwJW65cpq+SblSKiF2m+yKVsuDBsTvhZJ85vd2fUdnmwAe87A1ODGaNhZvrPzt44h1VPnsBySBGyNHxRifphNBkB3PyDm5UA5hr8aU53Mqt44/Ra7aObjABi9YLBigmk7codWClpuvIm+0iQE+W3mf4im0Zk2UwXXGyT9E9soORN/WN0XplAC1/8ObwFNPYLtAj+7s/dsQVbLvpRods1a+ktWWXc4ikZMIkUEqFv1K5l2lFwUsmN8S4awOCyuGmgoPIkmRyFNUjSAInHPntT5c8WdtrMVjkaGyVzKggCVZJfiNdvqfSMCfoOoiCOQwaYZOK2dekn+hCL5b2gqW/Gh+CCCre7QZz2nODOUljDrC9NDh7CQYeGtHTfHXvr4KxlF2EbrG2HeJM9MsnMn/Lh84v7psuO12cGO8ow9qg2//Qu0g2TKqkizJ0yCVsbCeOZW9n/RFtbEh0MWuBnNQC1pAYkvWcs82ic/KdN36COfnT4PEbime3tyCaVVjBCQhwm8tbfzfGsDXViWHC/6pTo2G9MhwHahapEV4Zw+FXdZcRCzd1qixxYcexjUsImJKS9rtvez+b2qRStsjz9F3az1Q8rZF09IcSClk6VQ1FO3qf0clm5uHlAq80nNICKVGNjb6VO3ICsQ0zTn1h2gKvuIzL67W61TY+Go5xV/uBUylbv85f2UZRBwXFUnDuRZGfLFaN9xWds27bzf3WXuNoaNXu/UfB4qKqf6++fzA+9veO9w/2jkfTo0n96HA02htNJn7DOz7YGx+MDifT6Xh/v+G3jqZ7RxPv4HhvdDyaNI8Px3spy2l2G3NwBvtCY6vy6hjReAmkOtqFtV65yR650SpcLPwJOqrh8rlyswDyGMxG4+a4ftwc+95hw/PGXmN83Go0G6N6c9IYTY4Ox9Ojvcl0f1oE7DiIpf+pSnknjPfdzlkMurEWLAOsWGUSTKdGtQrii78qfjX2QAacZMqUqHkAcQAc+P+mxHO4xlXlQGuUOwPEt9lkc1c4TJlDHA/TKhyHMzmB6ETQBboewIPF9WYGKb9FAlDUnc39FR7Hl2WaGwVzLxoHQf7NOFw8FTxFxUD08ox10zEwd98mXx1QCnRR/5MT2XEKxa2T2a2W66IhResRpv0Gcr1tAjz/gfPRbZsabx6sVulYFpqjfF57QCARhQlvFrSxDiZbJcZ73+13AT0SCXA5EZ6L2DwKZ5/8ilVjJx2lgkhLF0ElObHawMf2veXTWXzdCJN4R+TSq9I5EjWrKRYEThumtJRjSIRltq+qijo77rxGonkqy540GkBDssldo9DY8F1a9GLyvKFuio6baT4VNeCJzYJUg1He8pKZZ3omOmvKiybzbSaU6j8lW1QIVqCdOMthiupb5UMpbio9DH2DCo+AiksFTGzjSwpI2nRzrJi19ZzbB0Q0sCwvzAWpTEbibwDHzBRzK5DvJ5f7Ef9YBUMsygSZKoh7O66pRx9vwoWHjebRUeu43jg6OlK1GyTI4evG0XFjv37YTL3s/RMhU735WHnLN9XDe9MzjddGK1WT2GR8N8J3KXp0OvgZXqTjijFNPK0fEkTyewQ2Lx9iDLPYsxPPZ6O1f1DggFISemxg1o+DaqNe3WsM6vU2/X+H/pqi4dhv2mjkXekeRrinS/TNAjD4GMzxchf0K+A7XoDRhMPk1HPgRRfXA6sFIOwtl95TpXFgFRS5rQ+xFLRR9LKFL7HPLGAQSQKcPP6IOpCwYn7f68F0sJJtHKVGqBHL+WxhhbzJeBJG4nanfLoN73NqVvuNZj4wfgkiApYygYsd3PS7pGd3SdGuKNhRh2fmm79to/MfN2Lh/PlrQcFWq95utWiNRiZyXtnWSBFMOS1SK8I64YZtNOutI/5r2UalaQNEHx8kDwDwDhqtFj+2XnJ3cwUq8Tnb3TVgiWw+WPzDKgyp4wkdGDtGhYcMvG/DgpPUOGi3DppFz2lxUuBZfzzaK9986GW/UW/DMHjZfn3c3//10fNMjddsvS0gBUNU8qfjbrESkMLX0zg4v+z0wtlE3GYTEW453DtsNY6arXodV4TfZON1vWgFZdWa1VyKbIJAavJg76ilbWuxhBEun1JgywWt4pLbrZAsDJuGG1S0GT6gBwCzzCxyeimgHQHxUSqygBnlNg+wBMGvE4NT4YS3A3tyMFDBXj6IwZ4ffC3Yi/uK4lFrwT498eaRJtH8bZsh/r523ru4+dl9e60pBwdmj7YDed/azU3vDBXEDq+IVSNwdmd+4R0zObT63//93yZle7eNvWaynPgBR5KWtYp7XNeNev+gvY+nGpGaJHmmvN/LXK+m1cZBdeabFuG60hJFOZwYdm6zuKF51BZP6Ac2DYPJxXIgYyKlxBr83GtWRIuW8Xej/jgV/3L29Oijewerm1pkc+RN69N6fVJtNDDJFvyr7sG/akv5ZyobUJACjVOFyWsTbU7JZvNJ3wp+ig92DEJHfKa7b3sGGoXN7YCgR8SVgAAOTv2xQe7oxnFTs+/FcBQDUhOOSXaGfCYJ7VUlYivAFQpUHRKMx1ux5TCUqRw2xcLaCCLiDwDBljOK22kA7sgAEa31cXOYhqIS81tCYzbRIYF2AVHxVrclzDR4+WAp4V0T4F6+53oSrnX4rJJae0tfnzfpdbZ77ruR2cMCkgkn3BV1irLRcAZcFaQLVoXNKYDomnVBpOrEkOfuFiFiITZvPaftQ5FDbB8boGDjrXwmCc2Oyyr5PecxtbHPDfue2nM2TuXTwdHlnxXiLThrt1HCYVAxErLwE+02/EXxSiPTUpZdyQlq3myGhPh2WJhi3JtUwunUNvjuwEJ8RC3UvMXCn08qqdJWsYUJisisajxoIN6U+Qd/3MJbWMy/OKKRdmma0w6pr4H1oAx+MbUxhHzjTzBDbTiXmkiaUJlNPBlCzgUSL3sVqfSJJNN28f2NFWzWJiFU7pkGAFLN2Lx0eUCIL4YUt/LmYh3IpMSjEBdyipJZhi0knhJ1n7WJ7y/wS3FJZKDwvJP3CFa7NcXxN4caQyEVTzLooUa8pdstURZPCpY0tBeBFkzg1kT84q4jviozUzv1Lu+MJhsY+TMeonmHYm+RsTFMbsN2ZyOPeiK9AnB2/JIHKf2qC9hzGWIPpXO7Gq0X/pKU3BX2InckR8u8qOL87ZD0tUkOLXKXLSNaLdFHVIqpylpAKv4Fu20bdabfbUT/ONq20Xy+VaYw3KLd97Ld/QNkMfzp/t42o0nIOXEjj3tj/NscUyOtg9FLZrS3dxCvyj/+AfxukfTYqLfaDSY7af661dTy1nkinzvl6GAk8FUlcYWjG73aZdjHNlwYiaAWuXMcEVrwH1etigJxVtHV8KSgkikFDOmFCIy7KZzgjSSJgJFkEUjfrCc0ZFtkEaD8D0JpBo2kNFb3Nb6tTgkdzWCt08HP+lj6+FrzNszoAWPvyH8igj33XbQfolJszEo6m5XBAAogbMDzpnzw4P0LMFAb+N2yK/a4KFTGotgYsaNJXflAlKiTJXcdq/a2aJtKP/DgzOVnU45vGuED3Nn4EfAjIGdT5kN4pTg6lHZDAxTXRgqiZcYyvCvwOU+O7+WVZUnQLW0a850AUXNTmLKNKqBn7eaJq84lkPPvOOy3OA8R0zBrU/KG8kbi6xfV+zuh8DTSj5VuowcoYxvtlyTaBk8CxlgbGHTNyZcN8Q3XUYK/ORFQWLaKqFCPwdbnCs+Jj6dsVzh6ynvaDbNZ2zuu7Zmo0VDvDTbMRq11WKuDwK3fhfhm73aeq0D4SC6rbucZFLpbT6KwJIpC31nqium2cftFXlTNJ0bcVN1mRaKyelOxGMOX9pgL4SqYZv5GaKTOW9/LGt9bapjXN1fop9k9I0dPs2Cw5pvzy9MfoMDg8vIcTy26Xptlu0PGGcCZEYGWvAwn2yw2d+3eXHR+7PTO0Xc0FwCqpgESFKXgnqUBrsjAR3NebHvFn6dewbVBFH+PHhkobJD7lyuzpwB+osvk4t3GKUwifbr3Ig5ZT+7YsWE2rbEfS/d/1nI3Y6bPZpZvq5oohYjaMfcL0N/aqrLipMmjlwjGNgpZbu0IaM5Qa39DjXM/goVcP1TmfA2nbRBKkNXva3hluyYTutLMRbjqzSsVYnWBpQWubv+QdKP0xRJ7sKERxH10JT0Kd98LlSjms4Kf/3DE7x1W4k75uc0Xh3Lr1nc6mELLjNCAMGx9LewoJp6vAyNoYDswoo5t47YCuAxl9+E3gp+yYydxmYtpWzHENnKZeOMRnAKfEKmi0sY1dEu5zBcJocVLJEQ4HqOU/gC5s+kIwWVDO++If1xWcqKkRNMEbNuArWxBhJpEtJ5LXxrCi5367/muVZcyAolFy9FFW6xSOXTHONwVFvdkC0lV6gpc9MJN2wDvW04gt7v6uQjXX6Hqc8fLsX7EUn2VqKcK733zJimRl9UzaKeyTvDl7f7B0Pi/jtE4MZJXokYEx2eijU5RYKCPmqSo79/5jxW+wQTO+rurgYuefpgavn9qWu2Uem7zGtB4/7wlQCFcrsFRPb0G9O6bLUKn3+/88rI1uH8aLWEJlv6/KPWqy5fKupTgdBP5L1iUk5zmg+dZH/Kr29ZBs906PNLZhoXJ25LrU08Wp0DPvPXivP/lTb935sIabb8yeCQxafd8AstCrofxKumXBMklOkQQu78PhHkfFR1H+5b2bjexhgoC2LyG+3XpeLH9OqXXKlqPkEMkhxEH/5DBonwRuz8PuhdnmDD28vplyxiCEDTzFlus31ctxzYg1ajXvzVQJWGbIMb3zzHn07aL8nkZzu9cUguwCE8ApjABc3iDLMA3oP0Ikg/rlQiEx7wJ1A2KmpTuDT6htyr2ht8fODaEnIlNLdhKM9AW2mo12lgOA3W7PIq2jL2JefjbvaFgNYDH2HFyeltdezQZTXOc1w4N2HWyRDUOtmw0Xpl8w9KK8sWMtTD7djItqY0GKgec+j5KyqRRRy+ubZcotReaqSUqfWN/62Mve3Hkl6LjLyDdSknf0h5Wwt0KcVLq+VyYBccmvoyQoDSC3lWP8jBttq4rRqkTYYdOk1t8BTUyNs4/QnJFpGnvrHsByOCX7VEAzTXFgCR6g22oDCXxR1cPIN/Sd6Z5TGZy1CmRtby5f2BtpDxbUG/BxOnc+tjzoG6nx2Rl+LzNi14Mq9Sok2raET3YL+CKpNpm6w1Cj9Y1skTUtb+cch5M5BPdOw6TfAg/4YUeE0xkCcWWyzVF7X0TjkmsOXsMlTDOfxSAyxjnAnGMM3I5MhICnd/5WSVlZS2qGztevpJ5AjImeqQhadM8YsHP3hzvAM6P9tU2sisPrkZ7KL027WLHldgKQX4rY9Q/uy5+cd3i++n8cUXe+i66keFj3BGp6iNMX2iY36ehKI63MWAq/0C6i81hyXgUVgnRhxHG5ShBqVx3c1iZeQ+jicdKm3lbQXzS6F3gE/sS1dwWqH8RYmwwSJXeHBkZcpYfr6NV+AAPl/7dNz4jRY5Eqlec6upq7KRYwa1xU/F5Skjkdjglug+XvB4RsXmSALBORb8mW53m6/eXfU40azLNVpweBFC8dtvGyDQ3QAKSFx4R0ZU6u1oCim8cN6321ohbOMQIH4tNDMbGwUpfDd3aCthDU4y7REWOy+ZSWmiOQXPnPmDu4FOZegYYapnX/ytYa5loJjaLYNQAW0vojINUTQZBj0yFfGRRW7nm60J9Pccde7OkWW451m1ZytjKxu2hnwRdjM3X9dxK8w3zyrlIibKWYzuQpmXx/kU8fWxo0rQp3uNo6ZBv2Szvg7ZVfk1LoMkgrGsY91XbLMMgt/uXv2zbpLTjyUZTFtev2KYE1IoGKoWaNJAVTKjaKE4n80fkjRiV/YhCBnmJKW589NsiZKHRvWtRA6lKma2WatrEho5uIlnxm9kFLY5gJVlO+D4p1LNzYR36kDmAErcIRS6PBXW+sUuLGzi5iaOqhPW9CqDAjhEeuOk2t6GKt4twUanrGqC8lLk6COaYaAihUqRSMGVff4lFfrZ+Hh8fb6+l8p8c+G8TDVF05HKHaISbNftwbmPeJdbniy9APFBPs/AmE7wuhrluLWj81UhGIdLNAJB5s9mTMZ6FMGBjjpdDYKT4xLjzgSNaLZ+Yv4lZwsIr4rjxhzXe+AQjiVud8MVr6yC6N+SIWTQQYLrL0OEZFNi4rG2rddP7MeWkg8Io85eGyP/paRBfEiNfePm4zA6i0UVqfNdELdvg8Kk9Uj8hG9q0S90apJ0tRiuT21ar1YZW2Kf6n/80NZ6RbBsq2LjETV20aD2/xNpUaGDaZK5mWWIDt6GOWFuoVB7NJGNFt7RNDgi9eeUV5ut10fQeZ+066/feDl7Zhj5TYaYJTg6c9pIZKg3k/TXexg5MnfnkzXoCMvSLvTcSf0HSFaM7yzRy+X7HgHAXmVe9KChBVoT22KEyidlCD9Hv9BrfvL9i0sp2tnqZjE2kZ7aVYRR7ewuDqzpHCtRrHjcOWofNo73mllCY6RlOovokMUYXdrktqNM6VovbEIGWVWO7kZQpp1Yt96A1ClYiV/UmjkXucqUBKA99ZwkD7W3n65Ddcbnb6ibKDSwd8QiOJiDMYCxGTUBKTg++R8Hq5TrPtKxFDSF3RG1VSbuOv4I7IIwhvfHn4+UThhboeadchFaJI65WT08jaccqZyeXr09XUxl6e6M7996244mXoLzNBkaJ1R+b9fq2DSfrWd7y8UEch2b9eUYJAstEC6qHPcpqP8cbktm/bQSHZYI+SovZGgSCue9O1+zarYM+OMQPKHwrl8FVMHAfFxE2pmEbq9/wPmJnw+1wTF45yz61mbp+zDjGHeG+dozCO8aghFWis8EydDqgXA2Xvw5Dq8qvL1PeUH/ic9NW/IEZyR5KNDtEIt0JEHbM24b0LeD7aj+VbBnXIorFNLbS0Cr2Ulm97jdm9eKmazLMtlG+OqI08VSVEt3g2Jt5S8KGsYzujr3FBpzIdBm3nF2aq7DhhOMP9l6w3TwvNu5t2OrUFQZfoyqNc8+PzC+vHl+1Gzb+bT6bf7Ax0oMod5TTzpTIfMwiBeF4NcPYDsxIxo/C+QxQg/eEqU1oP9hcz27J+t3QRufJbqmrynSC0MQ3XhlFIZZJ/oA7gt4rqaroLO/WyBjXKC3LaD2dUlKRxVOZQQ0VHag1JA+W2hh9CqBhxGKeLZ9eXWJ6xn5F6cuyahTdAWy4puF0KGFqVtgB6nHwczrz7iL+in3O/LlNY6qJWHX6zrpB8WMxDy1dfmnan4+cIe/4WKj2BVe1I9TU8H9a6Ze5f2JrQLKaB/C5Z6Nne2O/qemg2El0M6iWjp+63X7gqvNxowzK0c2UkmO5U8EpzqcztGqxvzdiGuAix/fBbOIKeWKDISKfTwslmgoliMbnOoCmRGw1GkWF6uMf6A1mwK/Qzd7t/mz8rv6+eKMD7Vj4q5hqqjc7jGwQr36dm2VxG9MJ3pFBia9fYY6f8S5Oenc62X21o1w8gncZXLr9s5/61oYGMcVraoYTOzWr39Nz2tCazAaLTQXzu94lqT+THLLNvU0txEXrlialNp1iTDEsFZl8E9kt10Trt4jyqSIFFBmAKW1Vavcs4P6beHaBv5oCQc/srZaLzp9FGktTy+biFWk0So6icfF3HEZcjUNrMqCl+Oe0nrcYC8j0ZrWK6+7MQ5MwV7RFNfbMT2rOibX/ivpA1Md+XE93rqUzAh1bzt+LzAId6hXfj/cHzYmn73vnZzIDvJZIlYKMGedBPIFjxNniG/YIyP3rBnCjJgMO3mTXqGsyVXgUL+NQCsJazJBVrD82q7Nu5+y8d9H9g/PCQZ3QyKKZ7y8q+zSlWn2rYJDsjIyqnC46wH5XovgRigXc6vU8+U1BqpTqDYBDv/lqMBGqBtXQ1m1uj1Dr2zKiVISKWi/sr+Quie07ZcZjy0sqNhPpl8xWa3DCSa7nfIclCJ6kB+LgWuLvMSU9LII/m7xI4wFDNJWwW9tIW40o3jEdIGnLoF7SjIg7UjimTw/7L4WQQrMlDLVtsG50e3uqP1PboTm/YLKW6FA2MPz6rslBVaTZF7PI3E642fKab1Em5xctZq6j2KZFtLopCmfh85MxwW3jPfsN1C8vOih5Jbj3ka5lna86V71c+gR/ESrppuIcjAXnzXWDOfCvLp0jG5OJwBAcsxi6eT5UBJrnL7pipeIclRBXPkOZgmvIKG3AMhyhn+C0RLEUdxWLUiZVM21dSpbUJAiwoXiV8v+TDhJzrfA2VeQl1J03192L0258RWBJVhVxS7oxriU3ez9nu6WTuVj6lEQW2FNyc0G7Oicj0F/OJlOmiN1Cgw3+JVF76/VBo40pK6c9FWRTurXjZLOYWSS5gtxsl3FnySaLtpWrvvW4MLtH3FUVfua2CMDffdvpnd/0u1ouPd4bTuPA6RFa9efNAEI7BTtalWIfuR/B7xnsAo3HeumASgAFwYBviW8ng53wYAuXheICq9JDXLgGxNN7LoAeqYLh/d8aZgAbCZApAw1WSkSIHPmWepjirp5QFswIrY+IBDXn8UWbvWl9RcSDvFuWg+83rDhuvRzjpuUugTykwHD8t9xmKio6G4nONiRVWJIBmLINiPZFTt/nIeYaTR5P48dFqFG0w33fDkvTRcbnup0++dAdXoNR0LysIKZmZtKpMaE7jZMvv8TIK25IklRtERQCIV1w5BjZNbJjmCAwyWyU3IGy/R7XCq5oKsryQkPArBVxwpam/PbFjK+conwqx8fHz2XBmHRzsrcKH4KxSJHsSkgVso7wWnBxRnqSCkOFNUnxF4Vsq7RoM7oQ640rvUUYsrDWfsL7ZAJ/orlLDC+vRw4CcREHbeAX2DLoRfAXAFX4hWLSAKKItA230f9Ro7eNYapd6hFE0NsUfbMNicsic7vwdmoHWckmBk8h/KD/twCcl7cgjyGNTMDoSwbSwGZsHUbM0MRC9M73fjl0TwOlLI/SI4xJ+lajkpd6q9m5h5qoAm1lJY041i1We2lrp668S87fxvMlOTY4UU9pMRUZAleeNUmR6bKWchF1O5bQTvOpdoolEixJwqJsTuqb5mHsPCth52ixnaF+kobZCZ2wE5yuN8sUoBdeg+1N3UJKEdVK5axtsFMGUkj5UYENrkjUQptz1RmcYho386x73sUbyotRUpnXw1fttXYlNw47xojakeq9TZDs0C3S7t3Se3jwlrEDMDJ6kfv5PliJpGNEXIBRXI6BGuuB/S4MURNpKvdNGdQDOxUmioiqvFgMFqNqYo42j08nfhUiMj8facV9VSEdXYQrlKUq41rBjY84LK1LAF22ittFg4cef8XtkT8M3CoDR4JP+HkcwyQHDUU6ArlsPJfpBuRMY9VTdXfif9rFKCddT/xtz3qB6Rqn6OAfeViSVdMtGZUuBJ7fgoVguWg74WQ+PcyCubxAuWhU4RoJSxDW3qAnSu9Sr5sW19rU/hksyGAGNWHKn/lmVW85vg8+6W1nSUIxafCnEZadLXRIgaEp3fbgSaXoJpesVMOzblMT6GfjL+cY6bhaoZs5+nmsatdu7+35xQ/G70Y9PDw8tNDnQBtXzeYbmiHbAdCKhI2L+ZTImbBKGGVIxUrcJ2CW8tTPZuHnWcB+/8Gq1EmEvb8IbHDrb1NX8RrooIC/X7Ubz5ypreBOXirFT9iLYTseYlwj3eSYRk4GfGRwkt7b4hcFjMtYoVTPWCLWKDafn8vXRmI/6BNT0sFuco6PxNdEbDqhw5DS1v1WsnK0H8TdqqtXq+1mFrB84Wi5ytFKyeZsbBvfRj6wBit69Pgtess//TNnALwdZRn92h4eC51iNu3IcJOzEe/+C9zJAJYcdFkQl71uGf6D4T7pg7Ih/8A8BEDnG2hdEBYnsyQKFcb/2VtOXG+9ug+XwW9eeai2cGah24vWyxnejCQe1fr8WTHvV6tF1N7dRY6Eb6UETu1hF0P8OJo0cr6YHbU/FFTe+MBtLg15+cx197TfHZjP1mYugOjZRdgXM6zgPVRismJsldgHh5OS79UxJ+MU/R1hUF8QkchBC916bTQLcdjw7XMwn4Sfo9rcX8EcrI3G51i8j0eBcfkL9HX+6M85kAqd3iKXoxRLXKdIU9IHfgwYXS0N5JyNsCPNus6/li0CPkUfu6I/SUjwV3m1R8WQ8Jrs721yayipRVnXucbYWySdjWK/BEH2TO20Lxf+3F+2S4eWsnHIZGeS4RF7zsaKE34my8Az+bWkA3KD4cZjABJeBJu5d9m9VLaK3xtYjJnoMa5uIbvfaG9gMVmdGh9JkjBq7weDK04qL48o8noulMmdAPNcZoprpxfqmY9M2ajF1kow1YYEyyZtg1JDoAMDZ3/d8ugxwPxnFNw5V/3ejx2Q1baiArl/SY/r+Wq5RjN0TYScy16gZWZttfscEngCHDGcVmLoK5WPke/uVYouUZN4b3D5g+aW52K33CwaRqliTd4vNK6sjy4/LYVeFGjFBm0Cuxz7hihf4lxzl26O281MdtcjGTHalXgy2m3sAg2DkfqPC0rx4gB0WnYBsrC2Hw96DaVpjC32LD5aIEvXBEF6QcPCI2lT242t2ibT9Ya+N/lmfMM1f+l2I7bKTLzc71KXPUao4VIJZJb+OsIUoAt8I7K4l1iM9SlYslr78iws9zWZhwUXNrFVW3gxCbEPpkgj73bOMa3EL3xv+78h88r4T8y8wkuzfc6Vb29j2QTnKZVfWtGYsrKXGTWU9DBpmDCHZU2W2HheRnpiPe3WhqGvMrqUOPevZyuO8kc3SQy9nlAKftR9U8TkejymnMzfyk8utjF8SQAjtk5uCJZuvDRYuvm/KVi6aRbKT7gDJddWcAGR5kDkYqeUip1z97Ifu6rgUb736FoLc4BJ0t2f+r0BiE3oOd8922ArKLz+ouSiC9WsormJAItYGzixF99pIMhCDDiqkShY6fPYi+7CkUhVkLmgg9wZMLV7Vga9oC3sXNAKol1k5sMal5crQmXjxAuM97PCH3kfzbR/mJ4+iaQYip6zUpEQQkk3r6+FHoagAh4JSKEw7qvO4L1UqcQbbwu/ulZ9Wwa6kqTqERy4C0I65fjrnAu1UuHSYpoysVxWSSqfiSR0vFoiObBInUET/7a5MfLbNMJLsLbbo+/S14i7dF2L65J1xnWRNrhuzodqsYTqlZjZ/3B5dgNH9/p9Bw4cBes7aHaIjwXdNY751pKb3ZULto2dwuUwlYutC5ob65qzjelsHd3z9T2ZlpPL62FeFSA1I9QhPznNTfkumhkUjptjkEJaYnDgsFbhOJzRJqLVQLUjETH6hkh98QR9zPeM6pstEHtRPYHsxRS7Pw/6ndMB4OXTywv6mrpcnt3hMfUWCGggIkTsakU/AFAxvAamZ8eRQzYZpj4vvcV3WcaWzHOOqF2jjTSFcm33c7j8OJ2BnKyY4KqTcAwcXxVlEJjWQ3USeHdzALBgXHt6mKUkKe7BUTpKAYZSkoxKgrUUAYbq61iW+EKXzJvt5J73W1MsGR8qAfKAwZU75AvL08Jenp/DRsk6KsalixgW/lJxjWZjq0k2yLyV9V/hiMxitWgxC+AoGgIOq+ZO3M6O2UaDYMNCKU6U+3WelMQ3uasXmcWGA5eC9y4raQXIIzzTlX4C9gFCZj66O1C32EUO0JOHDOn58CbGbTixtFThOFkv51E4eXIkiMEGouN4BevxHIWQkJu2Mh8xdat4CNi+6iv4Kn8Wf52XHyXo8FVZ60vSpVYsgJOJcEjMt1F0M+AnDzjH+UqkemYu10Too/Sk1QWIeMEjPJB5iGhHqiSL6vIkaKL+zkjpGy6fOPRvIn/q6V7kp092XEWrBhIn3sG6u8rB3VC+xh4dtYeP0EVFuHcUIvxcTTJPyjRPLGsD1ROr+hcnu5Ds+8fFb7k8wM3/bQytHfGr0R7qOuXALZ4cehPNAZHhOpsn/EaMX5uFa/4JMBDxPCmMQk8A4yh432yjxZVbLeeCivFXW6K8W8Z40LoWbyllFZw3fNaFmyxDdNFwEOz1ridiAxxHA7ilamo8qY7opwZCoP8IDCLiRnGNtZX4IpQqseaTbCu37eZ+a69xNDRt6qWsupyo+LxtU43hTnoo5o58D921h1onYWTjnIS4crwaJhm8h8ONYWqimaE9/jwhELMRXuA/GOkEIEGtfNW76r5Mwoc2/OVSbeN6cHZ5M7CF3cBp7Gs1xIzmUKfG06jxgKzvHbpYfhsgkIitbNtFP6IP1g7jGjtO3U5o6eYGvixqSBMIuy4Qr4rDienU6Hg+O3AMFZ6qikcEGCvYCPVpchjw3XNJx/IaCZv5WexTnins9QGYlU3KVDF2wZPVWNStCAywW0kNzNzBznZMHJaVYZZr9/6j4KqB0GpT022j49Xtx1+cuuHNJ8bITF8RbOK8UxBiV+JtswUsWJs7xPuL0R+kkt03a0N7QohReX2gujeooLjq9jt49wN8j3nja6fponzqtuDZVfcU75Trd9/eXHfOr82M/KDlqzNiRN+PwtkngD1MsGKEn9EUg0oBXC/8T1zULljbUgEimLSNJSxBUiqYtg1ht/Y/+eIiTpLrgiha+65wUU34MEAe6ga/e89WnLbxH1++yJbI+Gsois9vJLhoT9Iro1qV8xLvkTPmgYpVhLpG4qAnuVK88I9L+f4kahtq68DFfveSNTL+/vdUuRq9rnHsOd23fLB3mCskatfWAKg1vJCTAgVFEbJwBMgeubzxutqsg3AB3MNxkIQbXv4Ei0cDq1REPY+yOm/VBbCfd3f+knyFN9SyjN9/Lx4ZnC7MBeRP3E+B53IRdMusBRMy9zZarePjfYvGWNgAMgU0GdXrkhwrNU6X4kBUUX43cVzMpv+EHLS2B/vFXp0WjZngppYBm5pUfWIMqSBT+sKMkygTxTLZOhLtvhOnJ6qGcILWIxB51tVmq1ZnCikIbfUhmAPwA/g22CsCmuZFGMecOHS6XrSNxbg6XoaLKqZgB3aQGahZMPXHT+P4VuSxNx/7s2owrxIDAaNvG1M0EYv3/7P213CkHrxHegDDpmtKwnnsDiQTx7TJO0I8pOOQfiRsdcozBb8UcaFtw28eev740BtNj4/He4fH+96Rd7jv7dUPJsf7jcNma7R/NGk2Ww3P2z+aHoy9+t5ov3E8Pq4f+OPjZivdeI51bRutiQ+1Ro2Rd+jvQcUDaHnqNUeTw5Z/cDweN5t7h9N9b7y3f9Q4HvnHhweNo6Mjb1I/aDT8g8ah7KA3eH/zxh30e+/edfu9i3cuYfk0oswesBhnXl+/d99jZkr2DeJa7McGrNop3mVxRgXSVW6ucSIlVWShdDW8/XRjNSyUrvZDFy/V6H3o9H/RV4NC+VrQ1+XFWWk9qXUtrP+2c36O966kq/94dV3cJa3kW9iDbh+avdg812wF2RxggUUM5FUDjbZtCcS75OkEx/G/Go3J/vFB3dtrHhzu1yf7R3tH9cMjf+9gPN07Gh3te9ODw8PmQWLBQelapaogV/LYyhFGouA2UlbGqb8a31cn/gJaTeUhXKBLZ7QCFED6kADOdPpkf40q589QWRbrS7bVNy6LtYuk0ft/2rva3rZtIPy9v4JTnNlOwkSyLb+klbtiTbBgbRegXTDMdgO9pm4c2ZXjZKnj/fbdHSVZlGQ7KNKiK/QhL5BInng8Hu/uOZKPGFZccc5svtmd72taykPyXi42Hken7qvVQ4Y72i/2fxdnS1X7voJ5JVkC6WJlxORjLzZl7pfrqt60O269ozfrHctrO2q7ZVl1y3Fczew063bTajmeZ+u65jbaIOCO2ezUrY7l1Dotuy5lvUl345V/o03c5aUKzoaeJri3KvCNQHkvo5WV54fd+263yvpKf6WNqJBTA0bVrQum/m6g9MFW7OeBmKIklDiv9FTeGexWy32/sr/zvPp+Zcx/WaevAa8zIVIYQHdqBHgQke/gXbthZ/ZQFPbg+et7+PV2RQQwrE8Wfg99kKHYrDPco2t4w9cDwyC3hm67oBSV8EV2+3tg3hrl8v7H8dCvpOOiaABVw1uJydxaUqjGQvvkId4lZrHLArQxLk7Hw+MlhIaQiHAr7eqYeFZGljM6SS0Z+xrs5bi7sWQIt1eK+6XO08soo5TCPMOMhLsoM4fcspFr+ixaEx5RSfZ64BZVBL+ns6s1PlIYg1DYPdjE0KJDW324B9NdQRtTKeUNiMIGgy8il3LJNhHNjGyK8IrF4BT86ZO/1qwFoTw8kUX/0fV+FjFCMvDzDZW7slm5K6mEq5XT9pssAOlhzMgZjAt9GxfcYVM7GE6upwfiTKV4jGhT6gTP6wSPCNh3Hg0WSJ4QM8uu2WqnZrtmCzwB29TsTkOraZZaczTLabdsr113PN3LE3b8iMC94XRmPsMLx2LRFUY9yGtKWLGKM/Q8xvmn2dC9zn9lm6APnFSZdJwHQWKK88Hk9334AwYpA3PMn5KYR9AxRr2vXXHAzCNql9mVOb1kaqslB8Hw3CRj9dQPSyQXQcItgGU5r8DtuapU55QlPWI30K6mPKW/85st/LW93fupd0jJa4eDwc5CWcTvt6nQ1k6ygHhPoTqPlbfB11ZKN/AkaRNTwgGMLdKG1/O0g8VLL4+OX/z56h09XShShiMyPl056TPxWi1VI4aH80jmeCI8VZ8EEb85FLzkx+Up6JTzB7X+Ze97L/jfJv98Pgj/AcvmnA/m6l5dW5RyGsFuhjXRCJprezqVE/EjTd2iEqxrMA0fxQ+eGayp63VdsjmoxYgNotXQw15+ze6BMdhNfUkY04BJcjkcjThdXWLUpkBtiie/YKTTRMZMbxpA4NXJ2dH5yz9evzh5o7Bal3aX+rPRCFYf8/aSleckFaykLcrw6AJUM+PH/3xKc/SJlD4p0mQu3TsQUsnYuA5oPesHZfaModSy7lLCD6CCbAXaH67GDmuq6rpCq/qrT9kU9CCUv3B9xu8YP2VlWkjlxlii07Xuz0kcfCHNubu8HsEocV90Bcb5/j7a4SDD6cupBd5CtuOwesh9SvIwVQ4FJ6ShrqCBFObawUG/7x+UcLvy4quT09BcEbdzwUCIdI8MTUm+oN01ZNcPQqQMkvETUADI/pwSy1jJ6jJxPASKPGQu1WLhmtpgpfJ3rM34JFYBkepJcgALSixI0DmUSpLnkPyM2w/DkctOjt8aFOdjPGB4ivtT5oylMfEmqC7TwoZFcXiSs2EEqymsYUyYL+smPm7HVdIir5S8iYL3USU1lJD/fOrdtf1zxr5LCkHilZR1BFqSzzJtyOqDzuAg1ZZZCSq3NnRaopEsLswTTVakwZWsLEiE0+O5pleu/WHMlMhcg9XOCKWDmBFaQkdvzpSUHfMrugA25rDMfPAvGdoJLBE534hQ2aKB7x9ySvQm6vxpeAEXi47VHt2xycyCf8VtWhxPlo9SytFN9ILxZ9eXGSOHFWcTPK2GRwnzv7im1tTBDG/qVtNt6ZbeUBuNjtupWY12u+k16k215Znq6uii+FLJfENAg2KhGN/cDwcgjjMmUqLlQCM6VcBlLs0vbEcksuxjIgvUkLgYws/xHuUvqJvZtyylp3J/LDAbTlv+DhntEJSiq+GdbNwx74DR9eTKgJtKEPEgXMS9cUfLCGos4ODZB+FnivEMpTs20teLuAdjO7oF0gnvMSOuOHsDj202udcUEexScnTCxojBQ2fBEnAlxOwBiCsdxlFArgXk+v1BriKN9v+PuVIcswBdC9C1AF0L0LUAXQvQtQBdC9C1AF0L0LUAXQvQtQBdC9C1AF0L0LUAXQvQtQBdC9C1AF1/dNCVwto/Duqa7E4GdiU4LtIR6A/iqV8RIwREsB6I++bYq/gonuAq3ikydPKQ1ofBo+F+2c3A6BA8rMAtkNGvg4z+B5kRy6HHxAEA';
const growthBlob = raw => createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex');
const growthDigest = raw => createHash('sha256').update(raw).digest('hex');
const growthSyntheticAfter = Buffer.concat([growthBefore, Buffer.from('\n# private synthetic growth admission fixture\n')]);
function growthFixtureMaterial(actual = false) {
  const after = actual ? Buffer.from(Buffer.concat([growthBefore, gunzipSync(Buffer.from(growthFrozenAppend, 'base64'))]).toString('utf8')
    .replace("                  k = g.Kernel()\n                  for elapsed in (g.DEADLINE, g.DEADLINE + 0.001):", "                  with patch.object(g.time, 'monotonic', return_value=0.0): k = g.Kernel()\n                  for elapsed in (g.DEADLINE, g.DEADLINE + 0.001):")) : growthSyntheticAfter;
  const purpose = structuredClone(growthRealPurpose);
  if (!actual) {
    purpose.ownerDecision = 'https://github.com/pachaninm-lab/pachanin-demo/issues/5469#issuecomment-1';
    purpose.afterBlob = growthBlob(after); purpose.bytes = after.length; purpose.sha256 = growthDigest(after);
    purpose.reviewSha256 = 'a'.repeat(64);
  }
  const stateBlob = actual ? growthLiteral('acceptedStateBlob') : 'a'.repeat(40);
  const queueBlob = actual ? growthLiteral('acceptedQueueBlob') : 'b'.repeat(40);
  let body = growthBody;
  if (!actual) for (const [name, value] of Object.entries({afterBlob: purpose.afterBlob, afterBytes: purpose.bytes,
    afterSha256: purpose.sha256, acceptedStateBlob: stateBlob, acceptedQueueBlob: queueBlob, expectedPurpose: purpose})) {
    const pattern = new RegExp(`const ${name} = .*;`, 'u');
    assert.ok(pattern.test(body), name);
    body = body.replace(pattern, () => `const ${name} = ${JSON.stringify(value)};`);
  }
  return { after, purpose, stateBlob, queueBlob, body };
}
function growthCheck(attack = '', { actual = false, bodyOverride } = {}) {
  const material = growthFixtureMaterial(actual);
  const body = bodyOverride ?? material.body;
  const original = { allowedCurrentScope: ['README.md'], approvedConcurrentScopes: {
    [growthBranch]: [growthWorkflow, growthHelper] }, coordinationAdmissions: {
      'root-filesystem-geometry-20261031': structuredClone(geometryExpected),
      'retained-other-owner': { owner: 'OTHER_OWNER', value: 'unchanged' } } };
  const accepted = structuredClone(original);
  accepted.coordinationAdmissions[growthPurposeId] = structuredClone(material.purpose);
  const purpose = accepted.coordinationAdmissions[growthPurposeId];
  if (attack === 'missing-purpose' || attack === 'candidate-owned-purpose') delete accepted.coordinationAdmissions[growthPurposeId];
  if (attack === 'wrong-after-pin') purpose.afterBlob = 'f'.repeat(40);
  if (attack === 'wrong-source-bytes') purpose.bytes += 1;
  if (attack === 'wrong-source-digest') purpose.sha256 = 'f'.repeat(64);
  if (attack === 'wrong-owner-decision') purpose.ownerDecision = 'https://github.com/pachaninm-lab/pachanin-demo/issues/5469#issuecomment-2';
  if (attack === 'pending-decision') purpose.ownerDecision = 'PENDING';
  if (attack === 'pending-review') purpose.reviewSha256 = 'PENDING';
  if (attack === 'forged-review') purpose.reviewSha256 = 'f'.repeat(64);
  if (attack === 'extra-field') purpose.extra = true;
  if (attack === 'write-grant') purpose.filesystemWriteAuthorized = true;
  if (attack === 'acceptance-grant') purpose.productionAcceptance = true;
  if (attack === 'source-only-false') purpose.sourceOnly = false;
  if (attack === 'wildcard-vector') accepted.approvedConcurrentScopes[growthBranch] = ['**'];
  if (attack === 'helper-vector-extra') accepted.approvedConcurrentScopes[growthBranch].push('README.md');
  if (attack === 'prior-state') accepted.allowedCurrentScope = ['**'];
  if (attack === 'prior-owner') accepted.coordinationAdmissions['retained-other-owner'].owner = 'FORGED';
  if (attack === 'prior-geometry') accepted.coordinationAdmissions['root-filesystem-geometry-20261031'].sourcePayload.afterBlob = 'f'.repeat(40);
  const acceptedText = JSON.stringify(accepted);
  const headRef = attack === 'missing-head' ? '' : 'HEAD';
  const rawDiff = `:100644 100644 ${growthBeforeBlob} ${material.purpose.afterBlob} M\0${growthWorkflow}\0`;
  const exec = (command, args, options = {}) => {
    assert.equal(command, 'git');
    if (args[0] === 'merge-base') {
      if (attack === 'git-ancestry-error') throw new Error('synthetic Git failure');
      return args[1] === growthOrigin ? attack === 'origin-ancestry' ? 'f'.repeat(40) : growthOrigin : attack === 'base-ancestry' ? 'f'.repeat(40) : 'BASE';
    }
    if (args[0] === 'rev-parse') return 'BASE';
    if (args[0] === 'ls-tree') {
      const ref = args[1], file = args[3]; let mode = '100644', blob = 'c'.repeat(40);
      if (file === statePath) blob = material.stateBlob;
      if (file === growthQueue) blob = material.queueBlob;
      if (file === growthHelper) blob = 'bc2c092cea71aaca1c94121b02d1bd87cf83df5f';
      if (file === growthWorkflow) blob = ref === 'BASE' ? growthBeforeBlob : material.purpose.afterBlob;
      for (const [label, affected] of [['state', statePath], ['queue', growthQueue], ['helper', growthHelper]]) {
        if (file === affected && attack === `${label}-${ref.toLowerCase()}-pin`) blob = 'f'.repeat(40);
        if (file === affected && attack === `${label}-mode`) mode = '120000';
      }
      if (file === growthWorkflow) {
        if (attack === 'base-symlink' && ref === 'BASE' || attack === 'head-symlink' && ref === 'HEAD') mode = '120000';
        if (attack === 'executable' && ref === 'HEAD') mode = '100755';
        if (attack === 'gitlink' && ref === 'HEAD') mode = '160000';
        if (attack === 'missing-base' && ref === 'BASE') return '';
      }
      return `${mode} blob ${blob}\t${file}`;
    }
    if (args[0] === 'diff') {
      assert.deepEqual(args.slice(0, 5), ['diff', '--raw', '--no-abbrev', '--no-renames', '-z']);
      if (['extra-source', 'guard-edit', 'selector-edit', 'resolver-edit', 'manifest-edit'].includes(attack)) return rawDiff + `:100644 100644 ${'a'.repeat(40)} ${'b'.repeat(40)} M\0README.md\0`;
      if (attack === 'duplicate-source') return rawDiff + rawDiff;
      if (attack === 'delete') return rawDiff.replace(' M\0', ' D\0');
      if (attack === 'rename') return rawDiff.replace(' M\0', ' R100\0');
      if (attack === 'wrong-before') return rawDiff.replace(growthBeforeBlob, 'f'.repeat(40));
      if (attack === 'wrong-after-diff') return rawDiff.replace(material.purpose.afterBlob, 'f'.repeat(40));
      if (attack === 'missing-final-nul') return rawDiff.slice(0, -1);
      if (attack === 'no-change') return '';
      return rawDiff;
    }
    if (args[0] === 'show') {
      if (args[1].endsWith(':' + growthQueue)) return Buffer.from(args[1].startsWith(growthOrigin + ':') ? 'old-queue' : attack === 'prior-queue' ? 'rewritten-queue' : 'old-queue\nnew-growth-purpose');
      const before = args[1].startsWith('BASE:'); let raw = Buffer.from(before ? growthBefore : material.after);
      if (before && attack === 'before-content') raw[0] ^= 1;
      if (!before && attack === 'after-content') raw[raw.length - 1] ^= 1;
      if (!before && attack === 'prefix') raw[0] ^= 1;
      if (!before && attack === 'oversize') raw = Buffer.concat([raw, Buffer.from('x')]);
      if (!before && attack === 'undersize') raw = raw.subarray(0, raw.length - 1);
      return raw;
    }
    throw new Error('unhandled mocked growth Git operation');
  };
  const readState = ref => {
    if (ref === growthOrigin) return JSON.stringify(original);
    if (ref === 'HEAD' && ['state-text', 'candidate-owned-purpose'].includes(attack)) return acceptedText + ' ';
    return acceptedText;
  };
  const evaluate = new Function('growthPurpose', 'accepted', 'acceptedText', 'branch', 'baseRef', 'stateFile',
    'process', 'isDeepStrictEqual', 'createHash', 'readImmutableState', 'execFileSync',
    'let scopes;\n' + body + '\nreturn scopes;');
  const scopes = evaluate(accepted.coordinationAdmissions[growthPurposeId], accepted, acceptedText, growthBranch,
    'BASE', statePath, { env: { HEAD_REF: headRef } },
    (a, b) => { try { assert.deepEqual(a, b); return true; } catch { return false; } }, createHash, readState, exec);
  if (scopes === undefined) throw new Error('ROOT_GROWTH_SCOPE_NOT_ADMITTED');
  return scopes;
}
test('root growth: actual prior workflow bytes and new-branch precedence are fixed', () => {
  assert.equal(growthBefore.length, 254318);
  assert.equal(growthBlob(growthBefore), growthBeforeBlob);
  assert.equal(growthDigest(growthBefore), '3056c9e395639bf8d087bb3bdde1a963c6b7dffc551e48f38da693b9bd297c3e');
  assert.ok(sourceGuard.indexOf('ROOT_GROWTH_EXACT_SOURCE_BEGIN') < sourceGuard.indexOf('ROOT_GEOMETRY_EXACT_SOURCE_BEGIN'));
  assert.ok(sourceGuard.includes("const growthPurpose = accepted.coordinationAdmissions?.['root-filesystem-growth-20261031'];"));
});
test('root growth: synthetic fixture executes all real guard predicates', () => assert.deepEqual(growthCheck(), [growthWorkflow]));
test('root growth: placeholder admission cannot pass even after other pins freeze', () => {
  const pendingBody = growthBody.replace(/const afterBlob = .*;/u, 'const afterBlob = "PENDING_SOURCE_AFTER_BLOB";');
  assert.throws(() => growthCheck('', { bodyOverride: pendingBody }), /ROOT_GROWTH_SCOPE_UNFROZEN_ADMISSION/u);
});
test('root growth: exact actual frozen source payload and pinned metadata snapshot', { skip: !growthPinsFrozen || !growthSourceFrozen ? 'PRIVATE_PENDING_SOURCE_OR_METADATA_PINS' : false }, () => {
  const actual = growthFixtureMaterial(true);
  assert.equal(growthBlob(actual.after), growthRealPurpose.afterBlob);
  assert.equal(actual.after.length, growthRealPurpose.bytes);
  assert.equal(growthDigest(actual.after), growthRealPurpose.sha256);
  assert.deepEqual(growthCheck('', { actual: true }), [growthWorkflow]);
});
for (const attack of ['missing-purpose', 'candidate-owned-purpose', 'wrong-after-pin', 'wrong-source-bytes',
  'wrong-source-digest', 'wrong-owner-decision', 'pending-decision', 'pending-review', 'forged-review', 'extra-field',
  'write-grant', 'acceptance-grant', 'source-only-false', 'wildcard-vector', 'helper-vector-extra',
  'prior-state', 'prior-owner', 'prior-geometry', 'missing-head', 'origin-ancestry', 'base-ancestry', 'git-ancestry-error',
  'state-base-pin', 'state-head-pin', 'queue-base-pin', 'queue-head-pin', 'helper-base-pin', 'helper-head-pin',
  'state-mode', 'queue-mode', 'helper-mode', 'state-text', 'prior-queue', 'extra-source', 'duplicate-source',
  'guard-edit', 'selector-edit', 'resolver-edit', 'manifest-edit', 'delete', 'rename', 'wrong-before', 'wrong-after-diff',
  'missing-final-nul', 'no-change', 'base-symlink', 'head-symlink', 'executable', 'gitlink', 'missing-base',
  'before-content', 'after-content', 'prefix', 'oversize', 'undersize']) {
  test(`root growth: rejects ${attack}`, () => assert.throws(() => growthCheck(attack), /ROOT_GROWTH_SCOPE_/u));
}
test('root growth: executed counterfactual exact-purpose removal admits write-grant forgery', () => {
  const body = growthFixtureMaterial().body;
  const changed = body.replace("fail('ACCEPTED_PURPOSE')", 'void 0');
  assert.notEqual(changed, body);
  assert.deepEqual(growthCheck('write-grant', { bodyOverride: changed }), [growthWorkflow]);
  assert.throws(() => growthCheck('write-grant'), /ROOT_GROWTH_SCOPE_ACCEPTED_PURPOSE/u);
});
test('root growth: executed counterfactual exact-diff removal admits extra-source record', () => {
  const body = growthFixtureMaterial().body;
  const changed = body.replace("fail('EXACT_WORKFLOW')", 'void 0');
  assert.notEqual(changed, body);
  assert.deepEqual(growthCheck('extra-source', { bodyOverride: changed }), [growthWorkflow]);
  assert.throws(() => growthCheck('extra-source'), /ROOT_GROWTH_SCOPE_EXACT_WORKFLOW/u);
});

test('root growth: exact fixture clock correction reverses to the retained whole prefix', () => {
  const actual = growthFixtureMaterial(true).after;
  const oldLine = "                  k = g.Kernel()\n", newLine = "                  with patch.object(g.time, 'monotonic', return_value=0.0): k = g.Kernel()\n";
  assert.equal(actual.toString('utf8').split(newLine).length, 2);
  const reverted = Buffer.from(actual.toString('utf8').replace(newLine, oldLine));
  assert.deepEqual(reverted.subarray(0, growthBefore.length), growthBefore);
  assert.equal(actual.length - reverted.length, Buffer.byteLength(newLine) - Buffer.byteLength(oldLine));
});
