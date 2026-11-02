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
// Historical fixtures remain bound to their accepted bytes after DC1 replaces
// only the current diagnose job. No historical assertion or predicate changes.
const recoveryHistoricalWorkflowBlob = 'e0f8fa5731af0addc0b82c9ca7fab24abcecddb7';
const recoveryHistoricalWorkflowResult = spawnSync('git', ['cat-file', 'blob', recoveryHistoricalWorkflowBlob], { maxBuffer: 1024 * 1024 });
assert.equal(recoveryHistoricalWorkflowResult.status, 0, 'Retained accepted Docker workflow object is required');
const recoveryHistoricalWorkflow = recoveryHistoricalWorkflowResult.stdout;
assert.equal(createHash('sha1').update(`blob ${recoveryHistoricalWorkflow.length}\0`).update(recoveryHistoricalWorkflow).digest('hex'), recoveryHistoricalWorkflowBlob);
const geometryBefore = recoveryHistoricalWorkflow.subarray(0, 191427);
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
const growthBefore = Buffer.from(recoveryHistoricalWorkflow.toString('utf8')
  .replace("                  with patch.object(g.time, 'monotonic', return_value=0.0): k = g.Kernel()\n", "                  k = g.Kernel()\n")).subarray(0, 254318);
const growthHelper = 'scripts/test_production_stopped_runtime_headroom.py';
const growthQueue = 'docs/platform-v7/execution-queue.md';
const growthBody = sourceGuard.split('// ROOT_GROWTH_EXACT_SOURCE_BEGIN: source admission only; no host write grant.')[1]
  .split('// ROOT_GROWTH_EXACT_SOURCE_END')[0] + '\n}';
const growthLiteral = name => JSON.parse(growthBody.match(new RegExp(`const ${name} = (.*);`, 'u'))[1]);
const growthRealPurpose = growthLiteral('expectedPurpose');
const growthPinsFrozen = true;
const growthSourceFrozen = true;
const growthFrozenAppend = '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';
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


// Current coherent predicate tests use complete actual Git trees and the full
// proposed guard. These are private authority fixtures, not accepted stages.
const coBegin = '// DC1_COHERENT_COMPAT_BEGIN: exact accepted BASE stages; no host grant.';
const coBody = sourceGuard.split(coBegin)[1].split('// DC1_COHERENT_COMPAT_END')[0] + '\n}';
const coLiteral = name => JSON.parse(coBody.match(new RegExp(`const ${name} = (.*);`, 'u'))[1]);
const coCore = coLiteral('expectedPurposeCore'), coDocker = coLiteral('sourcePayloads'), coCold = coLiteral('coldPayloads');
const coStates = coLiteral('stateStages'), coReplacements = coLiteral('stateReplacements');
const coOrigin = coCore.authorityBaseExactMain;
const coDB = 'fix/gekta-docker-diagnostic-route-20260927', coCB = 'ops/production-cold-preservation-20261022';
const coMB = 'governance/industrial-load-diagnostics-20260919', coGB = coCore.guardBranch;
const coReview = 'docs/platform-v7/autopilot/prompts/current-review-task.md', coQueue = 'docs/platform-v7/execution-queue.md';
const coG3 = ['scripts/p7-autopilot-guard.sh', 'docs/platform-v7/autopilot/gekta-recovery-scope.test.mjs', '.github/workflows/platform-v7-autopilot-guard.yml'];
const coMarker = '\n## DC1 — Closed Docker diagnostic source purpose, 2026-11-01\n\n```json\n';
const coSha = b => createHash('sha256').update(b).digest('hex');
const coBlob = b => createHash('sha1').update(`blob ${Buffer.byteLength(b)}\0`).update(b).digest('hex');
const coArtifact = b => ({ blob: coBlob(b), bytes: Buffer.byteLength(b), sha256: coSha(b) });
function coGit(root, args, { input, env } = {}) {
  const result = spawnSync('git', args, { cwd: root, input, env, maxBuffer: 3 * 1024 * 1024 + 1 });
  assert.equal(result.status, 0, result.stderr.toString()); return result.stdout;
}
const coRepoGit = (...args) => coGit(process.cwd(), args);
const coObjectDirectory = coRepoGit('rev-parse', '--path-format=absolute', '--git-path', 'objects').toString().trim();
const coState0 = coRepoGit('cat-file', 'blob', coStates.S0.blob);
const coQueue0 = coRepoGit('cat-file', 'blob', coCore.coldPurpose.queueBeforeBlob);
const coQueue1 = coRepoGit('cat-file', 'blob', coCore.coldPurpose.queueBlob);
// This exact separately published Gekta prefix must be preserved before the unchanged cold append.
const coQueuePreCold = coRepoGit('cat-file', 'blob', '92b83432389c40a0454bd829eb8d1d8c953e8e9e');
function coReplace(bytes, kind, reverse = false) {
  const result = Buffer.from(bytes);
  for (const field of coReplacements[kind]) {
    const before = Buffer.from(reverse ? field.after : field.before), after = Buffer.from(reverse ? field.before : field.after);
    assert.equal(before.length, 64); assert.equal(after.length, 64);
    assert.deepEqual(result.subarray(field.byteOffset, field.byteOffset + 64), before);
    after.copy(result, field.byteOffset);
  }
  return result;
}
const coStateA3 = coReplace(coState0, 'A3'), coStateB1 = coReplace(coStateA3, 'B1');
let coSourceMaterial;
function coMaterial() {
  if (coSourceMaterial) return coSourceMaterial;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coherent-real-source-'));
  const before = new Map(), after = new Map();
  try {
    for (const pin of [...coDocker, ...coCold]) {
      const bytes = coRepoGit('show', coOrigin + ':' + pin.path); before.set(pin.path, bytes); write(root, pin.path, bytes);
      assert.equal(coBlob(bytes), pin.beforeBlob); assert.equal(bytes.length, pin.beforeBytes); assert.equal(coSha(bytes), pin.beforeSha256);
    }
    coGit(root, ['init', '--initial-branch=main']);
    for (const [compressed, pin] of [[coFrozenR2PatchGzip, coCore.sourcePatch], [coFrozenColdPatchGzip, coLiteral('coldPatch')]]) {
      const patch = gunzipSync(Buffer.from(compressed, 'base64')); assert.deepEqual(coArtifact(patch), pin);
      coGit(root, ['apply', '--whitespace=nowarn', '-'], { input: patch });
    }
    for (const pin of [...coDocker, ...coCold]) {
      const bytes = fs.readFileSync(path.join(root, pin.path)); after.set(pin.path, bytes);
      assert.equal(coBlob(bytes), pin.afterBlob); assert.equal(bytes.length, pin.bytes); assert.equal(coSha(bytes), pin.sha256);
    }
    coSourceMaterial = { before, after }; return coSourceMaterial;
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function coPacket(root, beforeRef, afterRef, files) {
  const entries = [...files].sort().map(file => {
    const side = ref => {
      const line = coGit(root, ['ls-tree', ref, '--', file]).toString().trim();
      const match = /^(100644|100755) blob ([a-f0-9]{40})\t/u.exec(line);
      assert.ok(match); assert.equal(line, `${match[1]} blob ${match[2]}\t${file}`);
      const bytes = coGit(root, ['show', ref + ':' + file]);
      assert.ok(bytes.length <= 1024 * 1024); assert.equal(coBlob(bytes), match[2]);
      return { identity: { mode: match[1], ...coArtifact(bytes) }, bytes };
    };
    const before = side(beforeRef), after = side(afterRef);
    const header = Buffer.from(JSON.stringify({ schemaVersion: 'gekta.dc1-file-pair.v1', path: file,
      before: before.identity, after: after.identity }) + '\n');
    const pair = Buffer.concat([header, before.bytes, after.bytes]);
    assert.ok(pair.length <= 1024 * 1024);
    return { path: file, before: before.identity, after: after.identity, payloadPair: coArtifact(pair) };
  });
  const packet = Buffer.from(JSON.stringify({ schemaVersion: 'gekta.dc1-payload-packet.v1', entries }) + '\n');
  assert.ok(packet.length <= 1024 * 1024); return packet;
}
function coFixture(t, stage = 'COLD3', attack = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coherent-stage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  coGit(root, ['init', '--initial-branch=main']);
  for (const [key, value] of [['user.name', 'Coherent stage fixture'], ['user.email', 'coherent@example.invalid'],
    ['maintenance.auto', 'false'], ['gc.auto', '0'], ['core.looseCompression', '0']]) coGit(root, ['config', key, value]);
  write(root, '.git/objects/info/alternates', coObjectDirectory + '\n');
  const env = { ...process.env, GIT_INDEX_FILE: path.join(root, '.git', 'coherent-index') };
  const g = (...args) => coGit(root, args, { env });
  const readTree = ref => g('read-tree', ref);
  const put = (file, bytes, mode = '100644') => {
    const hash = coGit(root, ['hash-object', '-w', '--stdin'], { input: bytes }).toString().trim();
    g('update-index', '--add', '--cacheinfo', mode, hash, file); return hash;
  };
  const tree = () => g('write-tree').toString().trim();
  const commit = (parents, message) => coGit(root, ['commit-tree', tree(), ...parents.flatMap(ref => ['-p', ref]), '-m', message]).toString().trim();
  const guards = coG3.map((file, index) => ({ path: file, mode: index === 0 ? '100755' : '100644',
    beforeBlob: coRepoGit('rev-parse', coOrigin + ':' + file).toString().trim(),
    afterBlob: coBlob(fs.readFileSync(file)), bytes: fs.readFileSync(file).length, sha256: coSha(fs.readFileSync(file)) }));
  readTree(coOrigin);
  for (const pin of guards) put(pin.path, fs.readFileSync(pin.path), pin.mode);
  const guardTree = tree();
  const guardPacket = coPacket(root, coOrigin, guardTree, coG3);
  const purpose = { ...structuredClone(coCore), sourcePayloads: structuredClone(coDocker), guardPayloads: guards,
    guardPacket: coArtifact(guardPacket), privateGuardReviewSha256: coSha(Buffer.from('PRIVATE_SYNTHETIC_REVIEW_NOT_ACCEPTANCE')) };
  if (attack === 'wrong-purpose') purpose.purposeId += '-forged';
  if (attack === 'extra-field') purpose.extra = true;
  if (attack === 'production-grant') purpose.productionInvocationAuthorized = true;
  if (attack === 'wrong-private-review') purpose.privateSourceReviewSha256 = 'f'.repeat(64);
  if (attack === 'wrong-cold-review') purpose.privateColdSourceReviewSha256 = 'f'.repeat(64);
  if (attack === 'source-pin') purpose.sourcePayloads[0].afterBlob = 'f'.repeat(40);
  if (attack === 'source-size') purpose.sourcePayloads[1].bytes += 1;
  if (attack === 'source-digest') purpose.sourcePayloads[1].sha256 = 'f'.repeat(64);
  if (attack === 'source-path') purpose.sourcePayloads[1].path = 'README.md';
  if (attack === 'guard-before') purpose.guardPayloads[0].beforeBlob = 'f'.repeat(40);
  if (attack === 'guard-after') purpose.guardPayloads[0].afterBlob = 'f'.repeat(40);
  if (attack === 'guard-size') purpose.guardPayloads[1].bytes += 1;
  if (attack === 'guard-digest') purpose.guardPayloads[2].sha256 = 'f'.repeat(64);
  if (attack === 'guard-mode') purpose.guardPayloads[0].mode = '100644';
  if (attack === 'guard-extra-field') purpose.guardPayloads[0].extra = true;
  if (attack === 'guard-path') purpose.guardPayloads[2].path = 'README.md';
  if (attack === 'guard-packet') purpose.guardPacket.sha256 = 'f'.repeat(64);
  if (attack === 'packet-format') purpose.payloadPacketFormat += '-forged';
  if (attack === 'canonical-source-packet') purpose.canonicalSourcePacket.sha256 = 'f'.repeat(64);
  if (attack === 'canonical-cold-packet') purpose.canonicalColdPacket.sha256 = 'f'.repeat(64);
  if (attack === 'packet-size') purpose.guardPacket.bytes += 1;
  if (attack === 'packet-blob') purpose.guardPacket.blob = 'f'.repeat(40);
  if (attack === 'packet-capacity') purpose.guardPacket.bytes = 1024 * 1024 + 1;
  if (attack === 'legacy-purpose') purpose.schemaVersion = 'gekta.coherent-docker-cold-purpose.v1';
  if (attack === 'source-patch') purpose.sourcePatch.sha256 = 'f'.repeat(64);
  if (attack === 'pending-guard-review') purpose.privateGuardReviewSha256 = 'PENDING';
  let raw = JSON.stringify(purpose);
  if (attack === 'duplicate-top') raw = raw.replace('"owner":', '"owner":"forged","owner":');
  if (attack === 'duplicate-source') raw = raw.replace('"beforeBytes":', '"beforeBytes":1,"beforeBytes":');
  if (attack === 'duplicate-guard') raw = raw.replace('"guardPayloads":[{"path":', '"guardPayloads":[{"path":"forged","path":');
  if (attack === 'alias-key') raw = raw.replace('"owner":', '"\\u006fwner":');
  if (attack === 'whitespace') raw = ' ' + raw;
  if (attack === 'malformed-json') raw += ',';
  const originalReview = coRepoGit('show', coOrigin + ':' + coReview);
  let review = Buffer.concat([originalReview, Buffer.from(coMarker + raw + '\n```\n')]);
  if (attack === 'missing-purpose' || attack === 'candidate-purpose') review = originalReview;
  if (attack === 'duplicate-marker') review = Buffer.concat([review, Buffer.from(coMarker + raw + '\n```\n')]);
  if (attack === 'wrong-marker') review = Buffer.from(review.toString().replace('## DC1 —', '## FORGED —'));
  if (attack === 'missing-fence') review = review.subarray(0, review.length - 5);
  if (attack === 'prior-review') review = Buffer.concat([Buffer.from('forged\n'), review]);
  if (attack === 'authority-capacity') review = Buffer.concat([review, Buffer.alloc(2 * 1024 * 1024, 120)]);
  if (attack === 'authority-utf8') review = Buffer.concat([review, Buffer.from([255])]);
  const material = coMaterial();
  readTree(coOrigin); put(coQueue, coQueue1); put(coReview, review, attack === 'purpose-mode' ? '100755' : '100644');
  for (const pin of guards) put(pin.path, fs.readFileSync(pin.path), pin.mode);
  if (attack === 'accepted-foreign-change' || attack === 'candidate-foreign-revert') put('README.md', Buffer.from('separately accepted foreign source\n'));
  let guardBase = commit([coOrigin], 'PRIVATE accepted record and coherent guard fixture');
  readTree(guardBase); put(statePath, coStateA3); let a3 = commit([guardBase], 'PRIVATE A3 fixture');
  readTree(a3); for (const pin of coCold) put(pin.path, material.after.get(pin.path));
  let cold = commit([a3], 'PRIVATE cold3 fixture');
  readTree(cold); for (const pin of coDocker) put(pin.path, material.after.get(pin.path));
  let docker = commit([cold], 'PRIVATE R2 fixture');
  readTree(docker); put(statePath, coStateB1); let b1 = commit([docker], 'PRIVATE B1 fixture');
  let base = ({ A3: guardBase, COLD3: a3, R2: cold, B1: docker })[stage];
  let head = ({ A3: a3, COLD3: cold, R2: docker, B1: b1 })[stage];
  const branch = stage === 'A3' || stage === 'B1' ? coMB : stage === 'COLD3' ? coCB : coDB;
  // Alter the accepted BASE, then derive the requested exact stage from it.
  const baseAttacks = ['state-owner', 'state-scope', 'state-purpose', 'queue-base', 'queue-mode', 'base-source',
    'base-executable', 'base-symlink', 'base-missing', 'guard-accepted-content', 'guard-accepted-mode', 'state-mode'];
  if (baseAttacks.includes(attack)) {
    readTree(base);
    if (attack.startsWith('state-') && attack !== 'state-mode') {
      const changed = JSON.parse(coGit(root, ['show', base + ':' + statePath]).toString());
      if (attack === 'state-owner') changed.current = 'FORGED_OWNER';
      if (attack === 'state-scope') changed.approvedConcurrentScopes[coCB] = ['**'];
      if (attack === 'state-purpose') changed.coordinationAdmissions['stopped-core-bootstrap-20261024'].owner = 'FORGED';
      put(statePath, Buffer.from(JSON.stringify(changed)));
    }
    if (attack === 'queue-base') put(coQueue, coQueue0);
    if (attack === 'queue-mode') put(coQueue, coQueue1, '100755');
    if (attack === 'state-mode') put(statePath, coStateA3, '100755');
    if (attack === 'base-source') put(coCold[0].path, Buffer.from('forged source\n'));
    if (attack === 'base-executable') put(coCold[0].path, material.before.get(coCold[0].path), '100755');
    if (attack === 'base-symlink') put(coCold[0].path, Buffer.from('../../README.md'), '120000');
    if (attack === 'base-missing') g('update-index', '--force-remove', coCold[0].path);
    if (attack === 'guard-accepted-content') put(coG3[1], Buffer.concat([fs.readFileSync(coG3[1]), Buffer.from('\n// forged\n')]));
    if (attack === 'guard-accepted-mode') put(coG3[0], Buffer.from(sourceGuard), '100644');
    base = commit([base], 'PRIVATE altered accepted BASE negative');
    readTree(base); for (const pin of coCold) put(pin.path, material.after.get(pin.path)); head = commit([base], 'PRIVATE candidate after altered BASE');
  }
  readTree(head);
  if (attack === 'candidate-purpose') put(coReview, Buffer.concat([originalReview, Buffer.from(coMarker + raw + '\n```\n')]));
  if (attack === 'head-review') put(coReview, Buffer.concat([review, Buffer.from('forged\n')]));
  if (attack === 'head-review-mode') put(coReview, review, '100755');
  if (attack === 'head-state') put(statePath, coStateB1);
  if (attack === 'head-queue') put(coQueue, Buffer.concat([coQueue1, Buffer.from('forged\n')]));
  if (attack === 'head-guard') put(coG3[0], Buffer.from(sourceGuard + '\n# forged\n'), '100755');
  if (attack === 'extra-path') put('README.md', Buffer.from('forged foreign source\n'));
  if (attack === 'candidate-foreign-revert') put('README.md', coRepoGit('show', coOrigin + ':README.md'));
  if (attack === 'after-content') put(coCold[1].path, Buffer.concat([material.after.get(coCold[1].path), Buffer.from('\n# forged\n')]));
  if (attack === 'head-executable') put(coCold[1].path, material.after.get(coCold[1].path), '100755');
  if (attack === 'head-symlink') put(coCold[1].path, Buffer.from('../README.md'), '120000');
  if (attack === 'delete') g('update-index', '--force-remove', coCold[1].path);
  if (attack === 'rename') { g('update-index', '--force-remove', coCold[1].path); put('renamed.py', material.after.get(coCold[1].path)); }
  if (attack === 'one-path-only') put(coCold[1].path, material.before.get(coCold[1].path));
  if (attack) head = commit([head], 'PRIVATE coherent negative ' + attack);
  if (attack === 'base-not-ancestor') { readTree(head); head = commit([coOrigin], 'PRIVATE unrelated-to-BASE candidate'); }
  if (attack === 'origin-not-ancestor') { readTree(base); base = commit([], 'PRIVATE unrelated BASE'); readTree(head); head = commit([base], 'PRIVATE unrelated candidate'); }
  coGit(root, ['update-ref', 'HEAD', head]);
  write(root, statePath, coGit(root, ['show', head + ':' + statePath]));
  write(root, 'scripts/p7-source-controlled-scope.mjs', sourceResolver);
  return { root, base, head, branch, stage, guardBase, a3, cold, docker, b1, readTree, put, tree, commit };
}
function coCheck(c, { script, environment = {} } = {}) {
  const trusted = script ?? coGit(c.root, ['show', c.base + ':scripts/p7-autopilot-guard.sh']).toString();
  const file = path.join(c.root, '.git', 'trusted-base-guard.sh'); fs.writeFileSync(file, trusted);
  return spawnSync('bash', [file], { cwd: c.root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, ...environment, BASE_REF: c.base, HEAD_REF: c.head, GITHUB_HEAD_REF: c.branch }, maxBuffer: 1024 * 1024 });
}
for (const stage of ['A3', 'COLD3', 'R2', 'B1']) test('coherent: current full guard accepts exact ' + stage + ' real Git stage', t => {
  const r = coCheck(coFixture(t, stage)); assert.equal(r.status, 0, r.stderr + r.stdout);
});
for (const attack of ['wrong-purpose', 'extra-field', 'production-grant', 'wrong-private-review', 'wrong-cold-review',
  'source-pin', 'source-size', 'source-digest', 'source-path', 'guard-before', 'guard-after', 'guard-size', 'guard-digest',
  'guard-mode', 'guard-extra-field', 'guard-path', 'guard-packet', 'packet-format', 'canonical-source-packet', 'canonical-cold-packet', 'packet-size', 'packet-blob', 'packet-capacity', 'legacy-purpose', 'source-patch', 'pending-guard-review',
  'duplicate-top', 'duplicate-source', 'duplicate-guard', 'alias-key', 'whitespace', 'malformed-json', 'duplicate-marker',
  'wrong-marker', 'missing-purpose', 'candidate-purpose', 'missing-fence', 'prior-review', 'authority-capacity', 'authority-utf8',
  'purpose-mode', 'state-owner', 'state-scope', 'state-purpose', 'queue-base', 'queue-mode', 'base-source', 'base-executable',
  'base-symlink', 'base-missing', 'guard-accepted-content', 'guard-accepted-mode', 'state-mode', 'head-review', 'head-review-mode',
  'head-state', 'head-queue', 'head-guard', 'extra-path', 'after-content', 'head-executable', 'head-symlink', 'delete', 'rename',
  'one-path-only', 'base-not-ancestor', 'origin-not-ancestor']) {
  test('coherent: current full guard rejects ' + attack, t => {
    const r = coCheck(coFixture(t, 'COLD3', attack)); assert.notEqual(r.status, 0, r.stdout);
    assert.match(r.stderr + r.stdout, /DC1_COHERENT_SCOPE_|fatal:|Files outside/u);
  });
}
test('coherent: exact stages keep full payload packet identity across ambient Git rendering', t => {
  for (const stage of ['A3', 'COLD3', 'R2', 'B1']) {
    const fixture = coFixture(t, stage);
    for (const width of ['9', '10', '40']) {
      coGit(fixture.root, ['config', 'core.abbrev', width]);
      const result = coCheck(fixture);
      assert.equal(result.status, 0, stage + '/' + width + ': ' + result.stderr + result.stdout);
    }
    coGit(fixture.root, ['config', '--unset', 'core.abbrev']);
    coGit(fixture.root, ['config', 'diff.context', '12']);
    coGit(fixture.root, ['config', 'diff.algorithm', 'histogram']);
    coGit(fixture.root, ['config', 'diff.indentHeuristic', 'true']);
    coGit(fixture.root, ['config', 'diff.noprefix', 'true']);
    coGit(fixture.root, ['config', 'diff.mnemonicPrefix', 'true']);
    coGit(fixture.root, ['config', 'diff.relative', 'true']);
    coGit(fixture.root, ['config', 'diff.suppressBlankEmpty', 'true']);
    const order = path.join(fixture.root, '.git', 'adverse-diff-order');
    fs.writeFileSync(order, 'scripts/*\n.github/*\n');
    coGit(fixture.root, ['config', 'diff.orderFile', order]);
    const result = coCheck(fixture, { environment: { GIT_DIFF_OPTS: '--unified=12' } });
    assert.equal(result.status, 0, stage + '/auto-adverse-rendering: ' + result.stderr + result.stdout);
  }
});
test('coherent: actual canonical-predicate counterfactual exposes duplicate nested keys', t => {
  const fixture = coFixture(t, 'COLD3', 'duplicate-source');
  const r = coCheck(fixture, { script: sourceGuard.replace("if (JSON.stringify(purpose) !== encoded) fail('PURPOSE_CANONICAL');", 'void 0;') });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});
test('coherent: accepted foreign BASE edits remain allowed and cannot be reverted by SOURCE', t => {
  assert.equal(coCheck(coFixture(t, 'COLD3', 'accepted-foreign-change')).status, 0);
  assert.notEqual(coCheck(coFixture(t, 'COLD3', 'candidate-foreign-revert')).status, 0);
});
test('coherent: exact real state inverses retain every other byte and unchanged cap', () => {
  assert.deepEqual(coArtifact(coState0), coStates.S0); assert.deepEqual(coArtifact(coStateA3), coStates.A3); assert.deepEqual(coArtifact(coStateB1), coStates.B1);
  assert.deepEqual(coReplace(coStateA3, 'A3', true), coState0); assert.deepEqual(coReplace(coStateB1, 'B1', true), coStateA3);
  assert.equal(coState0.length, 3145687); assert.equal(3 * 1024 * 1024 - coState0.length, 41);
});
test('coherent: actual purpose queue preserves prefix and full newline-bound purpose identity', () => {
  assert.deepEqual(coQueue1.subarray(0, coQueue0.length), coQueue0);
  assert.equal(coQueue1.length, coCore.coldPurpose.queueBytes); assert.equal(coSha(coQueue1), coCore.coldPurpose.queueSha256);
  assert.deepEqual(coQueuePreCold.subarray(0, coQueue0.length), coQueue0);
  assert.equal(coQueuePreCold.length, 2122446);
  assert.equal(coSha(coQueuePreCold), '17960e4edae6796bb5293e1286ca63d058ccad792ff11caa3ba6e35875416124');
  assert.deepEqual(coQueue1.subarray(0, coQueuePreCold.length), coQueuePreCold);
  const append = coQueue1.subarray(coQueuePreCold.length); assert.equal(append.length, 11660);
  const rawPurpose = append.subarray(71, 71 + 11585); assert.equal(rawPurpose.at(-1), 10);
  assert.equal(coSha(rawPurpose), coCore.coldPurpose.purposeSha256);
  const purpose = JSON.parse(rawPurpose.toString('utf8'));
  assert.equal(purpose.retainedGuardBranch, coGB); assert.deepEqual(purpose.retainedGuardPaths, [...coG3].sort());
  assert.equal(purpose.privateIndependentSourceReviewSha256, coCore.privateColdSourceReviewSha256);
  for (const pin of coCold) assert.equal(purpose.exactSourceThree[pin.path].after.blob, pin.afterBlob);
});

const coFrozenR2PatchGzip = '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';
const coFrozenColdPatchGzip = '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';

const dc1Core = coCore, dc1Branch = coDB, dc1SourcePaths = coDocker.map(item => item.path), dc1GuardPaths = coG3;
const dc1ReviewPath = coReview, dc1Marker = coMarker;
const dc1Step = workflow.split("          python3 -I - <<'DC1_SOURCE_CONTROLS'\n")[1]
  .split('          DC1_SOURCE_CONTROLS\n')[0].split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
function dc1ExecuteStep(t, attack = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dc1-source-step-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // This stub exercises command selection only; admission predicates above use
  // the actual extracted production guard with real Git trees.
  write(root, 'scripts/p7-autopilot-guard.sh', '#!/bin/bash\nprintf BASE_GUARD > base-guard-ran\nexit ' + (attack === 'base-rejects' ? '31' : '0') + '\n');
  write(root, dc1ReviewPath, '# review\n' + (attack === 'historical' ? '' : dc1Marker + '{}\n```\n'));
  write(root, 'scripts/test_production_stopped_runtime_headroom.py', 'raise SystemExit("OLD_HELPER_MUST_NOT_EXECUTE")\n');
  git(root, 'init', '--initial-branch=main'); git(root, 'config', 'user.name', 'DC1 workflow regression'); git(root, 'config', 'user.email', 'dc1@example.invalid');
  git(root, 'add', '--all'); git(root, 'commit', '-m', 'trusted base'); const base = git(root, 'rev-parse', 'HEAD');
  write(root, 'scripts/p7-autopilot-guard.sh', '#!/bin/bash\nprintf CANDIDATE_GUARD > candidate-guard-ran\nexit 0\n');
  write(root, 'scripts/test_production_stopped_runtime_headroom.py', 'import pathlib\npathlib.Path("source-helper-ran").write_text("EXACT_HEAD_ALL_CONTROLS")\n');
  git(root, 'add', '--all'); git(root, 'commit', '-m', 'candidate source'); const head = git(root, 'rev-parse', 'HEAD');
  const r = spawnSync('python3', ['-I', '-'], { cwd: root, input: dc1Step, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, BASE_SHA: base, HEAD_SHA: attack === 'wrong-checkout' ? base : head } });
  return { ...r, baseRan: fs.existsSync(path.join(root, 'base-guard-ran')), candidateRan: fs.existsSync(path.join(root, 'candidate-guard-ran')),
    helperRan: fs.existsSync(path.join(root, 'source-helper-ran')) };
}
test('DC1: extracted workflow command executes actual source-head helper after BASE guard', t => {
  const r = dc1ExecuteStep(t); assert.equal(r.status, 0, r.stderr); assert.equal(r.baseRan, true);
  assert.equal(r.candidateRan, false); assert.equal(r.helperRan, true);
});
for (const attack of ['base-rejects', 'historical', 'wrong-checkout']) {
  test(`DC1: extracted workflow command closes helper execution on ${attack}`, t => {
    const r = dc1ExecuteStep(t, attack); assert.equal(r.helperRan, false); assert.equal(r.candidateRan, false);
    assert.equal(r.status === 0, attack === 'historical', r.stderr);
    assert.equal(r.baseRan, attack !== 'wrong-checkout');
  });
}


function dc1EventSpec(source, event) {
  const lines = source.split('\n'); const on = lines.indexOf('on:'); assert.ok(on >= 0);
  const stop = lines.findIndex((line, index) => index > on && /^\S/u.test(line));
  const events = lines.slice(on + 1, stop < 0 ? undefined : stop);
  const start = events.indexOf(`  ${event}:`); if (start < 0) return null;
  const end = events.findIndex((line, index) => index > start && /^  \S/u.test(line));
  const block = events.slice(start + 1, end < 0 ? undefined : end);
  const list = key => {
    const position = block.indexOf(`    ${key}:`); if (position < 0) return null;
    const values = [];
    for (let index = position + 1; index < block.length && block[index].startsWith('      - '); index += 1) {
      values.push(block[index].slice(8).trim().replace(/^['"]|['"]$/gu, ''));
    }
    return values;
  };
  assert.equal(list('paths-ignore'), null, 'Keep one unambiguous paths selector');
  return { branches: list('branches'), paths: list('paths'), types: list('types') ?? ['opened', 'synchronize', 'reopened'] };
}
function dc1WorkflowRoute(source, { event = 'pull_request', action = 'opened', base = 'main', branch = dc1Branch, files = dc1SourcePaths } = {}) {
  const spec = dc1EventSpec(source, event);
  const matches = (pattern, file) => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/gu, '\\$&');
    return new RegExp('^' + escaped.replace(/\*\*|\*|\?/gu, glob => glob === '**' ? '.*' : glob === '*' ? '[^/]*' : '[^/]') + '$', 'u').test(file);
  };
  const triggered = Boolean(spec && (!spec.branches || spec.branches.includes(base)) &&
    (!event.startsWith('pull_request') || spec.types.includes(action)) &&
    (!spec.paths || files.some(file => spec.paths.some(pattern => matches(pattern, file)))));
  const job = source.split('\n  standard_validation:\n')[1].split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/u)[0];
  const jobIf = job.match(/    if: >-\n([\s\S]*?)    runs-on:/u)?.[1]; assert.ok(jobIf);
  const step = job.split('      - name: Validate DC1 closed Docker source controls at exact accepted head\n')[1]; assert.ok(step);
  const stepIf = step.match(/        if: ([^\n]+)/u)?.[1]; assert.ok(stepIf);
  const github = { event_name: event, head_ref: branch };
  const selectedJob = runInNewContext(`(${jobIf})`, { github }, { timeout: 1000 });
  const selectedStep = runInNewContext(`(${stepIf})`, { github }, { timeout: 1000 });
  return { triggered, selectedJob, selectedStep, helperSelected: triggered && selectedJob && selectedStep };
}
test('DC1 routing: exactly the two Docker and three cold SOURCE paths extend the actual PR event filter', () => {
  const old = spawnSync('git', ['cat-file', 'blob', '70ba69a95c116b329feaed4c0ae81e7735988b0e']);
  assert.equal(old.status, 0, old.stderr.toString());
  const before = dc1EventSpec(old.stdout.toString('utf8'), 'pull_request');
  const after = dc1EventSpec(workflow, 'pull_request');
  assert.deepEqual(after.branches, before.branches); assert.deepEqual(after.types, before.types);
  assert.deepEqual(after.paths.slice().sort(), [...before.paths, ...dc1SourcePaths, ...coCold.map(item => item.path)].sort());
  for (const file of dc1SourcePaths) assert.equal(after.paths.filter(item => item === file).length, 1, file);
});
test('DC1 routing: whole workflow selects exact SOURCE PR and executes its head helper', t => {
  for (const action of ['opened', 'synchronize', 'reopened']) for (const file of dc1SourcePaths) {
    assert.equal(dc1WorkflowRoute(workflow, { action, files: [file] }).helperSelected, true, `${action}:${file}`);
  }
  assert.equal(dc1WorkflowRoute(workflow).helperSelected, true);
  const executed = dc1ExecuteStep(t); assert.equal(executed.status, 0, executed.stderr);
  assert.equal(executed.baseRan, true); assert.equal(executed.helperRan, true); assert.equal(executed.candidateRan, false);
});
test('DC1 routing: prior missing-path workflow cannot execute the SOURCE helper', () => {
  let old = workflow;
  for (const file of dc1SourcePaths) old = old.replace(`      - '${file}'\n`, '');
  const route = dc1WorkflowRoute(old);
  assert.equal(route.triggered, false); assert.equal(route.selectedJob, true); assert.equal(route.selectedStep, true);
  assert.equal(route.helperSelected, false, 'Step selectors alone cannot mask an absent PR event');
  for (const file of dc1SourcePaths) assert.equal(dc1WorkflowRoute(old, { files: [file] }).helperSelected, false);
});
for (const [name, event] of [
  ['target event', { event: 'pull_request_target' }], ['manual dispatch', { event: 'workflow_dispatch' }],
  ['wrong head branch', { branch: dc1Branch + '-extra' }], ['guard branch', { branch: dc1Core.guardBranch }],
  ['wrong base', { base: 'not-main' }], ['unrelated path', { files: ['scripts/unrelated-diagnostic.py'] }],
  ['unselected PR action', { action: 'labeled' }],
]) test('DC1 routing: whole workflow closes helper on ' + name, () => {
  assert.equal(dc1WorkflowRoute(workflow, event).helperSelected, false);
});
