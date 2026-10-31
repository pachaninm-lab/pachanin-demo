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
