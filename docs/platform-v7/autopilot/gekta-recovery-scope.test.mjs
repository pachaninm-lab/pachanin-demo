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
