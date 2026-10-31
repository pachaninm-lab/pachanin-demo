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
const growthBefore = fs.readFileSync(growthWorkflow).subarray(0, 254318);
const growthHelper = 'scripts/test_production_stopped_runtime_headroom.py';
const growthQueue = 'docs/platform-v7/execution-queue.md';
const growthBody = sourceGuard.split('// ROOT_GROWTH_EXACT_SOURCE_BEGIN: source admission only; no host write grant.')[1]
  .split('// ROOT_GROWTH_EXACT_SOURCE_END')[0] + '\n}';
const growthLiteral = name => JSON.parse(growthBody.match(new RegExp(`const ${name} = (.*);`, 'u'))[1]);
const growthRealPurpose = growthLiteral('expectedPurpose');
const growthPinsFrozen = true;
const growthSourceFrozen = true;
const growthFrozenAppend = 'H4sIAAAAAAACA+S9+3/aSLI4+nv+Cm327ArFAvPyC4/mfIlNEu44tg/G8/Jw9BEgbG0w4kjg2JPx/dtvVXW31JK6Bc5k9p77udkdA1K/u7q63vXKMG6j8PPqrjoJF6vIm6w6rwz4t/Du/Y7xozcPpt7KN6IwXPGCxjIKV+EknBufg9VduF4Zd2G8MrzJxI9jqhvMOsYtvFuPa/6Dv1i52JjhOIa5XM/nbuT/z9qPV6bxxx9GRV0uiOO1707C+3t4bBr//GemvRq9ri3W92M/wvLt/dZBoRCvXVvHflSbh7fBAovyIpG/DONgFUZPbvh5Aa3oantrmGPkenEcTgJvFYTUinnx03lvQAOriCnA0oXRdl2souD21o+Cxa27qZaFq6Qc2dKPZmF070/dh8BzWRHXWy5rwRTbazTa7aOjPYvGqGxgHE6faDK7sKPT9YQmt5x7iyrudnUWzP34KV7591W+8ZN1FEHF6r0XLGj34pUXreKfoHF9D3a2fRjg/EnXAXVuWpZFYBStF3E1XHSM9Xi9WK2rzXat3qY3q+DeB8Cr3geL9cqPO0ajTs9hSe4BNqCfmEGxYSBUw1CgTOR7U/6Q4Ed+5C8eRIX3g4ufhh/cq4vrwUnPvfrQbe7tdwy/eeD5kwNvPDs6mrQOjva8Q+9gz2vV96dHe42DZnu8dzhtNtsNz9s7nO1PvHprvNc4mhzV9/3JUbOdbfzk4nw4uDg76w2SDtpTH2qNG2PvwG9BxX1oeeY1x9ODtr9/NJk0m62D2Z43ae0dNo7G/tHBfuPw8NCb1vcbDX+/cSA66A8/XL91h4P++/e9Qf/8vds9GV4MOsZ/fPmihb7nZ6oNK7pcr5KVC2E1CeBZZdinZVyLoJBf4yVrSRHRBGyNF936Kze+8/TV0jKiHpUSHVcNOLKwOx5BTLw7ufMnn6Du/3kQy2gQ6ukkvwBW/Flmji/DJ+mhq039mbeer9xx5C0md9Lhk0bL/s381eSuOvWXMBKjLr2ARYmDeFWdRP4UWg+8OUxmBn/9ZIIMu34EzBrB6+B3X+BWQqWTu/Xik9RkfOfP5x1j7MV3yTM4HB3jD6nX2F8Z1Z6/Do1lsIRJBHPp5cRbGd8br/9jcH0OeMsd9j5e7tIZ5Lgfu60tn14b331nXv7iDi4uhi6H1Q8XV0O3bkqNvX79eqC4DmrGZXrMYd7R0zIM4OQZXuTD6Ob+ZOVPjfGT4T/CzhoMJxJgxDVoUuoguF+G0Qrn6++3Fc+DhRdPgqD4ZrJ6Wvpx8TleYYgzDC82pqvi+9lksZoXH9/Bgs+DcfHFv+JwUXx6763uik9DeTyzKLw3llAOmhUFLpXVABWuEL0X30R+8Rlb3jBSzD2+W68CxeTi4HbhqZ6vvJXqaQQ7q3i+HsP+Jzd/9t2T4iFg+yUifsUb2KDi0/U6mL6SHl+dfOh97BpwptV3SPWhIcPq5fXg8uKqV1K+WW/uN+qtTK2z/sf+EOpUGnAgjP2WBUe2Ib3/qT/ouSfdSyjSONrfrx9K7wbdn/ir/b291r705uTi48fu+amo2GrUD5qZTs+vf3bfXcE7nHTt+rp/WjHrs8l+a+rNqoftw1a1fXDQrB76B0fV1nT/aHoIv6d+27Rq4yc4Ri4sq7xWkzmQLcbVKlxWeo8TQFRwMi0ZaxK2gjKZWoABDSTRgsivPHjztW/jPRkrqgYzYwF4gArl3xGO8oLYZ/3zFgodAYLw4S4SHc3Dz07dNu6C2zuHNqHQpxgZnnRWy4LrHNsxvMUUGzC+c9iQ8Au2BBRI/3zYg/vQtAqtrdbRghUvjG3iLcJFMPHmvJ+OujIig9p0fb+MxSxiAFz3k/8UO8OIfvtLD+5JOJ5OxbRNGE/HtGzAkfE68l3CZbykN4cJwLW1cN7hfWHV/MUknPqV4sJNg1ugoctHxvEXXl1AY/CytTv/kVcutroI3ekaUGhl6QVRrGg3hrsRAPTLc+4NoCoDZmzzlQdam1pQQgXfQShO4ANlWbuwLqfXl2f9k+6w5/7Q+6WwW+kQbqDyyOD7rJ48K1hcN58WNPI+27DBS0cc5XJAg+IEZnTMGKD5C/YUgAzaIRi7vB5iUzooI0CZh940Zt2H438B0nZpody7MPzkiOUvbswMpnNXAdx8v0R4Aqp2GjtHdTgrCzgy5+HCL58A1aQpACZPJsCfwhTa0JI57H/sFQbPNtSBe7MmrtEaXmNBHOL95K1YK0hDzb2JXzF/RQDfqdc79bppWZpBUau11e/BYhbiqBAQcBY0NPZyvZqEsxmQNRULaTjoH/ue+vOVV6lbuuF6tzjYSgWWxQCYlEcNjyq8ld+hK+zAQszOz8UqXHlzl69tRTfwOq4WdgIfvCwM5WrYPcOx5LcNuqjoTuemodXSFS427D+u2gR/ul1P4BNZwXqzTQvLbvHaerH0Jp9c3MWK+d0H2C+Cx71966Y+wgr1R3+214J59X4ett2P3ff9k8JCA0cNC61ssS9abLaxRd0IoQFYxKbo5u3ZxckP7lX/1+Kmjufh5JPBJwI3MlTNX0WAJ++BsNo4pKN91ZDCLWs36nVF9b8D6AJVeovYe4J4fQK0L162gA6BwF89ISQCM7teIkmDRDDOpxoD3b878z2ABh/51AfkGwBFaNYLj0gyUODp64/Net34AzbrsA7Dog1m+FQuAyPmpZr4zRKr/a7XHV4PNEsdb1wI1cYGM7lvHJYK/fMO/tjUQ6vFwBG2u9Us7DajGlhbsC0ajPvFpBIuoW2zw/qGFWD1xAM8wEhxuXhfwkN+O8Iobhr1dqfRrI8sWzET/Gey+UKtDWDXxMlAR2KFoIb4aiNtmjwVX58LZx6IiNh3V9547iM9NbVhpDGfHF0KQGEU8AEya1DWCBfzJ8R0JM6bGu8vh8YdPAeQ2/WiyHuKEUZXd75xenGF5wvpHoP64i3neDR5G+RhNHSIk7WCt31lrwGHvl2Ho0hAm1Y3/sE7IySEeLWH0osCkBKqxjsprbm7y6vmisLdjOdrqiJacFFX3ie/wu4ZG+/E29WdpQJbMVdW1DpOHrA6MHFbkP5WCdHDqhs7vCtEgNIkCEev7yv33hLbtZPR1+iOglsJLiy5Lu8RVupjb9g97Q677qB7/r6nJp28z7AKCDn5CZcMeBP5AxslVsC8+nAxGLqDXvdU2b+YzA3rHek3aELZN6PgCi/vxwAZbMvqCcRr4A3K3uw16h0ANrrTxuZvj3t7vz16HtInH98O4Kp5f65GgvE8XCEOvMFG2u39neBNY7/T3m/SlxFRuwERrt7i1q+0rTwqXMcEcTeVYAfgIgB202KV2A+s6i/W9yg9g5OBvVmEPuHdTXtk/A2gP9/k7RKvJ2/xVBGl2EXtU8Nu2jD2bak5NWhDBdsorAl8mvBI8ZoGvpj6j4TLRBcdDUYU64/oEwbJKfzKHpwQ+A9uhT1+B/XOT3unLqAb9/r86vryEmCnpwYcJiH0ogRgtddTgm8PrQ3D4w19T2jmsjsY9of9i3M1+ZFbp5q3XPqLaeWLyTQQhMppeUwaJV0GNFoTr3j4mZwQPE2I42ltdHdK4Y4JSIy4esreTXAxjXApx2FIeJq3Wx89q8bPUDkgQXPujf05FDanYYxHgR2j5I5kP+F5ipeo3wTFl42aVSpcpewY1TvtdjsZsqIIvC+5alkHM2CWVu465jOG0wUTkp/Q3VDF53y74Bn/lsf/PrDYZRwqIjk6TUREE97Dn7DEN42RdAKhrw+/vB30T124Vs0ybKolEtJ2EXY5GY6TuBxcDOES7P/YcwFnKRvHa4zd5Yyv9B+XJGu1tjminUOOHXvv+gaeAwQJmEYJdkyOJMqtN1LMTQWlmB/IUZPYKWyPsVVIAmgZFumQJ/wKkbl85B/gAuoNtMOehMsnGDYCM1E+bBmw8xFc65+9xYpwt7ZrrA/z2i+ZFxa5gRujicPDm6duvmlvWAMh1a5NokmrWcEmLCKjZ/wfTpSNLjNP92Rwop8r09jZRgikHRxqOj2AReHE6Kb4X/BP4t80DdPK4VqssXVoCHAU/Iwm2mb7KXI+aG7CznzcOGUBzQQPwH2zqcAnIwLxKc0KIYfmxd9kF0lPFWW6xenQyWseCviDifEnvMXuYND9xYVz+a5/VtYk50D4VAALJZth0hTgCd8VhtTgN98ewmh4bcDHpkvCpJ2AwnxHTJoD9sa2xmRTYAwKbZIJu4TvI2BVzVvge/jFsbffOWiOnhX9LaPg3ovw0HA0QxSYuCg4GaYg/RNAcVkZpDBQSVKb+MG8wlu94SMevUke8CGPdtUUnrxjSR22DIQNmrR1yRu2uCPje3izkxkO39DLQf9jd/CLe9b95eK6HH8njbIdhEbTfmjTRkCeZ6ecGYuoloXRt92TH64vy/pHjbtL7Qr6Nz/xN2I7Mr2/2byCObyT9gQExn7rEC7sAhZKdw4gaZQ5FjpktC2JmRLVcOD0FxhxMtJQqe4bqNKp0NedhoW/dPgZyGFGQe0L1gAQNODrkrMm3ZlSlQQpXJ9fXwE12zsfDn7R4gRhjxAsCkLrHJkL5CXs5GoVxSVoOpGUbESnhbOAtyz2hF+gL/zIwTGfF01oA/bcQBYjB6QjjKF8lR5BoW2pYYmGxg1EfUYFiUoNldxqjnaI3j7sbKAtM1gV1j4YrxnxSxuhpKr/brz1AXZRbP1kjGF71kuDiWaWUfjgA08Wc3U3w5xM1sIgnCnGw/UqxivGm89RTe0lq6kSnVEHLts5p4BVqpmjX3Lkoa+Kf8P3ZLSDX3E7CCwyfeCx9BmzSoOysgjr4sfe4Eyh70jHmrsy8iN+U7hD8iVKMRd1kSLVhEgXL6Q7QZ5WdhKXF6gcHJSifVww3uinkYwBPzFZwCdicfnpstkJsvm9ZovrzCZ0abMr18otZf8UTlp/+EvJWmbxvzyhr8f9UsMC3eP0ipdAdrSE680t2czb5erfxGYmwENL/I05zTwOLTCeeQRa2jhf+fnYk2tySLY5VSd2UlB3Et2ykbcNIzh1jJEhnUOFduYmqQidfPKfnLl3P54C0umk+KBE80ViP94yqQ3ZBZiKT04urs+LFAzeME7GgELc+WQmhIeHN1rGjVPZZJRIzmG7eN6zb3bEzwSnCVorHWcZ5mKjLWszLy30b9GsjIibLyYTbpod+EQQIcmP2RHyUjwIpI03O+klZW2CFbSDMjvsszbeb3OrAKxa4wpt65kWFHvlQjq+74kIGeWDKEEeqXUlBB82HNx4cuffI1gyU5sds0qvqgxki0eZn+TymzVzzGV9gUmNu2wxkkVJTS/oNWFLsczYI/tWVJEIBYfLBssRXLlqnJdB+fY0mDAzEtQ6i+eOky6KnZ27LU/Lzk7FTgf8DKPnmJOtqak7Y+Lm4t0RMtZuQ3mTElQmrYoBjY5z1gH8BS3CPIjZIjSIpUYzgeQ1PNiTeu69/wjX1lWhbyJkUOFyzE9TXXH2hbxatN7ZpIVgYvT8NrGntEn86Nni1NnirNniDD0XBq9bPsKhyO4kih4Su4s+UFSUyKKzJXjnI7thb6cQklEZ/NxJ1Tti4yQoGxVnsEnjk+INjivYOPmSjOzk1JARkrVBIJrV+nAFXoLJ8A1rni+9Yryn/fe9KzWfi4CD6iGuGxLgk66KTrkoKc2wDVlfllGT8aGorHSY3RtTjtklmkB55wB8CdaFSiwZf1Yxxnvt/dw9GbrbaOq4hYho7ZWCyEKrvPE6IHOsomZYDTkpIpCQmPbCT5Ew74kmlT7lCDKd36B3cnF+NRxcn+AlqzODomEWldtRuAxjgfBtcjhxGSPptIsIPOQKOj/lUfIEDnL58Jszo4RKpUZHZXYzISnkuASejKHVjD15xbBm45s6YFWhvRaDyS60pkusnlAab1IFeKNxeNTYqx806wRfvBhRIHKp+n7jcK/eaB8ctrVWCjSHt92r3ln/vKe9fYgvRARL88J11TCJmRHrd8ASq3cO/511FWc+mIlKjF2gXSKOoezkse5JDkAVhOVsIgqgTlNqb/jLpfqccTk4H4J8Vna57LHarPK3WYp89EJVUn7I9cfD1lcPVOY7CsQoU8pgkWpmm3YaOtyJNb7PgBe7XOGrgLPvHGYTDUM+v3C7l5cDoKBPuYuAqbW+EYIg6dwJWRBfSfYuGSTKxudTF7vOF6CBaQF84X/O1sIftvRcEKvppErbyrB2JIc3TL5gsQvw6Ub+PJyQ74vZyYKw4xAA0xryNxK3R8r9MoBrFKlacoBxAT0CUUriJuD0Zytcy8kdSpIK6JFb4zKpBBtWOeWa4adtiWu2s2xw6YXIxsZNcx02RPqFrBd6kQy7b896elGHjIJ5WxIu4RdqhTWbRTLUOhNVqjnQ8ZNwFjS+SHdCR7o+8u0+l7GrheGp1iVRJSK9ythX1dnGa4pxl/JVxXZWGqoGWlknycGVKuZOxKhs5/jy1G79VSU3GCujd6SVvhh+6A34el8M3KshIDD35AOSM6f6y4WtbwZ3ZSaaO3UJ1ODF4V5fIeyo7o+kXfnwlYEpr5A5kwm45s4kf5i9xsm4gIYmFDcXJ11O8RTdL96up7CqHQWx6brBIli5LvBX81li1a08YliiJuS+ZDF8Hy7CFRJiFeuYv2b1jcQumT9HgpDblxUZsQS90CBKj3e+26o0qO8yQ0BD/l73VElrJFQ2m/QMgIokJSUENzXNBlm0u9uKycqtg8RhoUXxG/yDlzGM2X17ffq+NyzhpsK4tqQJwND5GGACVnGxd5zESm4LlspxlGZ0x7nZS6ZxBZ+dNSDH6Da2U7t0ZCCcsWna5OXjzqaxg/QR+j1IzkjAFxCMqt0IXr9+/TZcL6aAydCx0OjvXnClOwCvD0Due4v1smZ8RMfbxS1u7pJ9ohQ5Nq7Pfzi/+OlcZT464x13+Gc6TeHhcB+g9IHNhpfhP6tFeBQFECKt6kGJISo28D2ai5x86J+dwlJf9QY/FmGVe7bhiUrc3GqX4dJPFno1DRaO/LJ/2aPH4XpVeL6l7om0gFM/iooNJ7sovthMoeYSsvfJ85l5Em3fl794cL6Yl12g4zrm7jqOduNxsOjQN/rCfsIfIAbOAMdDsRP8euJ2z87Yj+17YxTW8OPlaX9gduAsQfdBFC7o5jG5yym8hg52gc/0H4MY3bdN68V9fLj42HtRDwUF3/36kZApd62snTLX4Cv+AOGUeTQ7qS0RPIOdQ0+vzLMYenDyuJe2zp86RXwOV9Mi/Dz3AZ6nzBNMQYzEKzhq9zZ5MMc23X9E8FUEzBB02un4ez+i9OWnQX/Ys03YTsuWi8JUCmURB9kmvMmVhSlqysIb01JicdiJ2F+5ZHEP+KHChl9Dh8xFCFiJObwd46oDFr3FXYkqijkWbMGjJyXxdQcNU2Poao6yoRJzOMRUMCZHj1v4Xlmp4DSpBYiE4xHtpZf3knNxo3BsbBEriOZqDTtp0rLKTBEAb0IjNULuDm5kZ8PZgAoIgN8JCZXVod87DuzJ5wiwOPri1eA+I4ETvurQezTRz0iHlK7hL3Jqb3xrp/Y/49We8fktWTi6m8XK4batFwmE0soBqIXjfwFwSL9qk3kY+5UyWxCd0CBLL8Urh6GZ3MbjsaQmOMbZ0BCtP+44ES98wxHwcJdtIAl2GlWaJnRoWdbmlUHLbmq0fE1etiTJstDEa/7jCk1KqBvrWKaZaJjfOeh6yU/fxfXwUmM+hVJvR+Cvz16wqvAIIs6991ip1esNe/PRt6wXEces1neCeimgiByWx1tbLwnGCdhEVlYYLFj8F9v6/MiANvPmcyVexK3Sb0MwE0RPbRnO5xVStyBZqANTgKdPwXy+vE2uh2UwtVlsgdpV//2wN/io22/E3IZyV/a0pkbkxi6TY0NWpfe4DCK9U8I2Q/2hf3ZWBpo4XOVom6VnfNOIJSd5DiO4Zv1z4ihdTj0roTolAujez177uZs9e3lrrxd+rPndTHAy7ci/dFDDCfksHV9gUT750cKfuys41hWMgsFYEYqToNXRQu9U1mKEfYyRXyoViik02UUiLn6Kd5k9zQ+9wXnvzCVatnAkpoj7iHannuHHhTs4vTg/++UP+n5ydtH7uXeiIi+A20oQJyBNwpVZbIQcHEdGfBCkYTrWejKJEwrNsnWdTVXCg1P/IZj4m4UHbN313DNn8NjHMT1CNuKmTCgEQ4PC/jqYVoA7ZToIEZWkdu9N7oKFj2/Mx8N9d7/NBJ4sAksNBU/hrMJ/TdyHMJi6Syh8aJt09ZaZT9/7uNoYh0RsMw54dxHv3iOdfowTz5doJK9LZlQBHB2v3Kn/YLNvwSKEMVWwQfFCfMdXtvkRpYnuefdj7+qye6JR1gHFIQ0HBgh4JfeQjxGflo8QS4ihiO98lLxV8Vb6ycbKNC2lQ71Hi7TYkY+hvML0Gj3yTThsy3mwmsMWxyR2QA2XozXdxXJE0lL7OuSyxOPrYFnWOjQc+0uHHtfIVLQyNqta4jmYsRZu2iPHGcNCk2YgMTuldxslLaTZc5wGX66PTFp8zIaW6PG2HVZiX0vjatK4Djv8KLCHLT5Y6RG0vtOgx+jFz96MzeizycJmYJG9EV+iMWA4KzvYMvABiLv3/gW8qQQpFuI6IPRyTxGkDu22aPy092NfAzWILx2MUlRhyBZq7xIbt4tztQAvxuH8gTB1MFltNCJQIvSkZUB3iM5pUYLFqiLDqqi5a+IqBaR8sXAibdu8+uXq3VWqStNMBP0vHGyixr6XhifJd4wVdk0YI3Raw8kuEf3hjtdNaQC9DZuknxVTgsGM3uw1mgCkif7XNstl7AmeJ0UbIl+npBfUFPBOdO2QFLykHbYUG1rKSF/TFp1G8/CwfVTH+HUws9P+1Q96t0uqm+y2S6CIf47FCwzzxp9qNjTp3qFvSAK4CzSDYTVsOAV1y0oaXBWLAblAR0VJhGHosNoMj0M6UZs9pYAWvZ//kH6dv9WYkZ/9cHX16/vekAAffsFXXJT9NlmJI+lRJRf+WfDow8kIJ6t5bIQLA7joKfJKEwBHksYomidjGEkg1baO2ZCoGWnY9cdGc//QZmGM6BwfC7k+tO1kHBEqZt9kJTWOcJntz3n/k/O/bZ5dvO+fdM9cjZt/snvCtN/5YtIVQ4H9YhiFz217uQVSxfzHtPOPqfkP5U2fRlPaRppI8cKwHjpPSTetzV4QmjU7h+In4lez0+aq1PQt+8ne1rfplk0QvbLw6LHrAG2VeT/09p4GhVcGfzyL4SfdJvzBGC4uNA5fYTk0vyCN/fk2otqMqWb27Nop4nWFbr9tc4U+ryFhrS364pEm3LxJaQIyqpgN6dkk4pcOKEZRUtK/swBOSOyQDlaiPUzHtBtWhnpRo8s1CR8R5QtL2wxthGQJtIX18YkKhBFYHTYMJoSGuxbpNNgrM2UjIr82W8/n995qcleJzJtu9Vev+nu9euTuVkdfGjZgzWfTxrbY5WjWaqbwrsenYl67SC+w25yoQeWpwsVzTLrJzR2sfSzxR/iyyB+dX7y7ODu7+KmUW2Lk+8rDtmZE+wJfc5ze/N6qduX2rwC/VbAYHimEZTajlHoR76Is+ZJ5DFcv7rkN0H3aK/efEPyOIBXZmIgzm02VMUHQkI4pRHk52cKO28yj2nLRkdirWqLXZNiUClh27ghJsK3Sjc7ibMcU6EndCZ5Fm3SX+MdStcZBGjvONqu61hV3bekdT7pjYl61umM8XrMpC/GG4Y18PvQZ6rm1vC/tQRjOXWBNUHRY0bC3WCZ2lLHoKPIrmb/EM1x7xIs+zqUJqFI5VCIiWLDM2ue7AA4htkHIxdmgF9PIRPBwYvUOjfMGmxvBDeY9eMGcGRaRzuP5uMQnEHZ7zmhvRjKraO1jOnFYkrGbZcSnOELA1QueHocpH8Z/1sN6s2mbw4uLM/cSZVFXV0BRX5nbtItL/J3DVOpMr87aOdE4WyDxT/gc7VbnsEljpP1jLoEiyQsXPxHcSw3vNLZRq2fGwswo0SmQsZC/PR7MemfvzA1jRF2vc4MnBMcI2LVa5aG6mJEp4XdHABoTyWeK/6g0viGZLsrmUNWbKO9bdkZWg8Imh6gllbMVnFwHBcI7MJeFuYOSPXFLmeTUS2BPcfl0nN0KkIAT8cGz+LR4BKpwma0fjUrzt9oN3EGjHfFpmbopR+kJMyqNYj2lWzNcdgC5gA+9aEIwjuOxcWLptUGl5CCBfL9+7A2udKye9siRdtwU+9ehtjHqhtItx8RDlyUxk31NiclnjZ0zDqFopeHdu1OYFeL/p4rasLkoaNGRKdtIb5R4OSuGCZzZBkkH7PkMI54gSh2buwCupj1mBER8d8/59dlNwAUbq/slkqQZAU0FG0iIKHuWF3Jg7VbmUeFKiz97S7X4Cl/k5q1YQqIUaZ3C5Sq24/XSj/AbXVA41o566uQEg11Y33MPU3MR4oOEAksa3Uka7ZSg9VkshIMPs5ihds2iAx3ljgl+39D3WUQotrEvoTW8ZOkdlfuu1SzrOgE+R4Rirt1/muL3yjLygb10zOWkKqtRTRvqENdtHeOdfQe3RCVpxq6HB/V6mReDKJkHdUnxMeh+RJuMd1euxKsUiQKGb1xElBU8XjZK48l+0J7ChJgJQacQnfGSGH3jLgQKnGLc+Y+T+ToOHnyDSZwM4t9rRteY3AXAT0d+Fe8kDKBreOiUCos5WRXaxTIUUTphwCla/spDAwfy/Q4/L1jbxudwDQ3Dvszm6L3E7r01nGrs+JXqwqEJwl2zCKuRj7efyX+t/Pm8yg4BPcImnEVI3z8HS99ZIK2V/KwmJF2cvgFOEDFZ3srUUsR0hJXt4IjEOWaD8CYrnd03Ft65kVHTbApsBvYHlN5I5fqBi+gG996tX2E7YjM3EGakKfaYMKqdQp6GLHz9+nXv0Y8mCF7M+T5YwFGbz/2pQeYO0e67092QdotkKB7Qw9g3BWdgFhgGMj7cmxlpG3IqKpqwyZ4TNDpi8Fb2l2eLsXrpzcN4zZWeKLXYtYbh0Lo/dvtnSoNX0SFbJSGYcVCmwoMlCtVKaVQ11n+W3E0G9TUkL79QndV6OffJFQs4DLZhN6Lh0U1y7wo0b9YUWD6RZjft5r7dAhqOV/sOnrTbdh1W6uodyQ3FXHWkgIa5Buqk8p+d9s0eUCZ/7BGBYglCxRSjTrdGHriVJUQGPZTSbRwHwjcj4xPotXaZv2iVQM+UGXAszRjwk0GvO2Qcd+/nk7M/OFf+0yDDhQMK3i+iYI1hlCywBPT5Qkkl8vUruP0nGLgQLYYYHCbsrVZPzZw8yXa+4I2KnOCSGSJBkwV3RV4w9VhEnpo/StwxVWETmK+E62iZd9mWd0FmvIUJ2ZmTVsZySI5x1LHlOHk3Ztvsf+y+R3DpXQ27w57WB9KpMKGa84+pTY448AUo/H8kCDvjQzOytUb/ktBTx4K4sELIfsiXK/suXa/EaNqHZCFmp8bEUMDKMiylK4RSJ6cOeI4cQU4Hvwyu1eT7egE0RjAL/On/C9uXdq7cQjZs9ycMzGf+qVX9dgvKwIpMO0tV68xtCD2J2Cn8i9dWclxi9znrn89eaWKPgXGcL5U4Pdp2nPpUs0s0VqORnXRe8mNVRDMRVM7JBWyQ4zWgMX6eK9QY/0vBF7hrQRp/gU3JGinVPgP/zscdMLxboDsYVYgE52zmE8mK8nDBpZOg1/88RwekFWXa8bmDmbJp7qlYMy5QbcRpLCR/vZWBd+ET0F4rzJcFXCXQxEFEtNEKqF5B75C5uUqfBHT0n9qo5y0uljrxGv+fuWuK289WqJqsVa5j87dHb898IwHR/wZMQswtErMKeJd215Z2HQXxcerun+57EobUZs5Sl93TU0xItg19mvEi5dFtGe4wBXSaHdHB8xa2VcfE6K4X82DxqXLPXFXc8BM3VigaXl0KnknYMF2R7nMdFflLl6l2XOeGX9qmndg9zcPFLf5n2ZUkKIXy5RL5t+QNHHB8CACPEizpBex29Ga/jS8fwrnm5Ug/m250u0ZgftmswmVxbLO5dxsrhgw7AxNVv5CecoOwkSLzENEvjL0lsKOQXfyccB9i0ls7kg5baz2YtUdL1gFNgPaaCou1wkpBSS44LrN9gxv44mR45nbf9os+itxhjfklHef911I5J492gNYsrLVhd6DyRSMjhRRAVQuEPl/wn1UULDhFWGjZdTu7CtiDJZ550ylsSiweF6ZHNgSIsdF44IjbJUNPlsUNGy7f79JfVzBLwkiHkhIcAzcFOz+Hy2gXutplso6aPrQPJoms4B8hHWDpBO04XEcT3xb5cGy+rG6SdoMd9jykUJ4mKcDPch0BHeFTOB+RphC9p6l1NwkoM4FRQpuuxyK9LVAaCd+SIIQ8GlAhKtCrsnBgSeigNE0ZNoD8KI6Mh8jAr0DpuKID+pGgxWTcs9jleS5IQ79a8zZI1sLycZnPZYGRcI2tfLgdeug4uGqA18+655tCGmGFNKCR4yThjPCFKU4WFBELD2VE1rb0pbQX8J79kl5ndwdKcGBgI9zocZ4RD5goB/Cqs9GXdv3Z5NDFBNyacvttKMd6RNEEyxz67mLwsVs8vCyRExu1BEMjG5M5Aexam3bkJoG2kXJz5PcOAHaa2xK2n5IuijyYaGSSf5QBa6A6WBn8gkTo/XJlPtsmpi/t/awNncT7d3Kj2cLSoVYd7ezmfsOlwVq4kacyYhuSvpJGOCL7Tj5ILTpOqhbWZIRIuVCML4b+ZdK93bAbW2xjgip0+ygVcHSWT7ZsppQxTcoYJmXMkjJGSXZqcFQ0MUqti4pmRbkIEgXDoKxZkK229AFgEodTB02J7Vd+UY43nF46laL4jXr5GBgpcHIlrSit6cjOP6Y1lB9L61x8XChdWDX5pbx+hbZE7CZmxQvkfx3+SrZXspGlbpL5yaQbj3EU0CCZrHCzpVAeCm9T0+XcewlEsJykz8mVVgLEKG8iqMXdSdC1bPfsJGROaR4G+Cl+VVDJMQiT7t4UxujczuLCSZ3FdDblNFO2mVy7aVYpWySKstMMUHaa9gnOAfJEV79cDXsfN92oM2C35A7ZmpGxRbPePrTTzEplJwNbSceHBobSCLSrnoksk8yzdG5WR2wEdInhYCylGQ+/54nWya07PSwsPXuKq6/QpjwLZYpmLYWNkC2iEDLtDY+RuV0oQnlAydOC2geLjUmVR0YLJeEGuckQC5+XtjDqpJa0PNyhk7FpeN7cNLlUbmgmtYqQ4iamBhDPRYiKzKyNR6pCYXOQlCZZBKR0xn2RH3Hzf5MfcXOTHzGJVEqvKVyvT1xqxqNJK/ZA6Ah1W00cgaMJgroxyh8TcMsib0F7ExhaGXJc4mkAzevCtkpVsiyOqg4fp8WpdhZcZwNfkfBE0GA2hKBoBi4f4CW6ZxsaKjBN2GCui5t8OLHR7m7xzsghZz6Md1c6dh79mhgTw5g0vDUTyZiLlUvDGSWDlPm6kfDbTZETL5fhFYnyTOO9fkd+7uqC3zkH6YIy/cJxQbwvVeVAY+fXUCc8FXhY2fumREZqnJzBc9rYsM8bb8psPFMhzkzCeJag3Qydkgsf+9KgsZsiDFJ60LzIQ2aRU+iiTKsAW8zCk2+nzIlLG5gBJOXmyCVK8KAOTlHCW7R70Gr4tSr3jYlyMkrHnBpPrUGz1XZJG3sqMcTYQhb+zM9ZVj6eF4eF49iPHpD5+Z81oFGdLYx85/OidBwYukvkWpIMS3Q/6P3XtSpML9PCOMwzWVhmH6dWZQgK21kiyCY+DlfuME0kohZUa+RR+jEQ6bzgDP1SGeWoMhUvOSi8gdRVzpFDqDJDRkFhw3l5UyC3v3PyTQDtfKUPr0rQD2eGluY4ewJUy1WyZFkDvpwt6XEa7OhGDnQ0cnQmeJnR/VkzrFfa4Ado44dG3fCzJPAA2odBCUuYVH4jtJA79y8II/UXoohviS5YBAndzmahTazxKzV+TuXgnayYNhWLd7hsNiMe73DUIsgopHqyItm0BEc4JfkxZLlohzKop9gpbSeRK0pC9w4/mOKBEMKzCK32trkG9CPLErGdEhJWogg7s1gI8ZkriCTK7/Azpe9Suow7+D2hx4lwRI6IrO+ZOVr2aubl5au6UEXfcYEi7hSsjBIquIAjS9rlhEgnT+RmB6cmUgoKjE7297Pa+1WjOCpCbRFKi1okZmVcprAunCHAyv48XJKyBo9Th0bBoQkTe9Bw6J0etkjzUuq5+gLwXK7H82Di+o84KdgLFppeikRNSDOhcd8Cy3uCfnYCE51fuCfXV8OLj8Avk9zIfN4+BhEaFYvbo8NtUKP7VeT7knmkMtEpnW4RiEarIUTSerGqsA+hHpQ3XugIyxODsPpFloI9RirqwY/IToyJwO6DVV4x6FOQnzivJUxxo5nddTu3hc8lRDUbx006CKLEUcdZxtGQTktU5YNGngaTYCkCF+BKwX/oYjBdYeQxnyJdwaMK/Mbvv8M61gBLF7RAbB0cuRq6FwVxiFp0TyxkVg1mHfMl26KetLj6HAas7drqd/SMkW13WeYg1oTuNa/9HS7Bd7xsyY7Uv6vwQlVe06pR7iGXRwGrABvdbNfFaru9ny/7g5KYyWKmErxktZ+igAxDKtEKwx1bANNLpDR8Em/754gStGrAFNj4hV125nihwqETz/8SjWbJuih1j05etZl9vUkzyddtawVlqebxBdrLUgUl00trms0oqltCUZ3Hv95yOX/6dgwpJzxFviOTwRHyp93Ly7NftAwqEbLJRU6tjI45l5k85q2Ojv8UdaDausUq7YUPeaRwnF4vGKqYqrUNmrusOCZpxPnRSF18BQ9/vLzzYt8xLwc9YnnMlzD1PNWxq2buvwUXnyKkHM2vEGBLinR2Nl8k8i5L5ppUy04406LII8YEC45Cy8iEtLQKWTWYbQpPAeBf++80OZO+rTwg4ibJ0y0EAnnh7gtEA6nyXnTnJJaeCjGyZPapFEKi1Iozx/qVykUZ/+ZOUMKmm3wHKVoPOhvGGIpgGSwW6H52F879Krlao56auYRBmYUXRSGadscTqCzc1Gq6yB08GCEZsyr97CRTacs6/qwJ7iHciLYO7VEilcpG/fj8grAfclQPJ21CnoJ4bZtM+vLutDzgRw77CVTGmBrWBAXUAtJLd+9z+WMOwI//jc452xiAf5YswBt7eRPwz9vZgJe46LC1KgtCmnqVuHk0n0m4kWjTMqdaSgujP7Z5R0tOksrxUCRgsXUeCTo7dbW+i48NlTEJF8yHmAUnIOPe9Qcf9aCUtWhOdywPJ28y7jS2TthitzetEW9Hjv2CF5KuPRGxlMSnKMNMZ5RMVQQ1LZtrwewekcBmLMyWJ4eFU0OOr0bEivMvGbhsRAKZk3fDxmOX4VpmM01xozQKZQsI72ZdOp9Sza/y+irMJzmox3TmsnTWppQ4stIjoUMKk0g8RESdT1CYPlLbhVlMocr/5oj2ssZFeLD07o+I/DPRETCi1YukbbBZ6/kqtXrumO97F3CIB7+Q1ca5i77dyGAgVMBbaWgpgJfK2f6s6PvfKeljnIPLRT2dAm+SSoGAc2ZKRVnyXjaIlIZNRMQFSLILpUSQt2zRzYJj6DAxVhJtYPj2uk0gk8TJsN6I3yxWBjdExTzn69VdGAW/87RtZJv4ftA9Z5qWyJ/7ABClpfJCTq7gegv1evQVA0D8SWAlIWz3DDNrifOcwCp9/P8RNMs6VEDtX7jl/365NiYFqWgFKRSb5imuwRY/wDXfYiIz/uCmwYxDzarQ41WrJKYxKbj1aa80CV/SShPtf+Dugn8q2XJisL+z66D1n1wPFbMkp3F/6g/U3WGGC+5+WfTHTJuys2mKCyn+2PXJ0q1VDvZIpZwug+OINWD6pWajEDCBpwJgH5U0MUD3bPDR5s7Rb9xOxaWbjnK4VICEX90B61ZhcWzS9A6WrnUfDb7v0R+MPegP+6hEGfS6Z7kUV1sGdGDRXTX2IBtWQSmyU6c+kyQaLOorCzqmCIOPG015xUyWkoPHws/lBtBTI0lWmoadZEbj8bhYajSR6eO4QEoSlq1/JZL+u3Ee8sJQgqKr2ZT0DUnQ2CYJDU/NZVAwqWgVePBkPaEsYUFskFYtvvOnNf0d0NDgk23go55FDgGmAUBrWdeFjXVdRBSua3Zww/3HYFVhmGNTBp/mZstblAtH4XzuR9z+tv6t7W9LzG/TzjVGuChJH1ycnUHlukzLv379+gOwdf5UGj+5G5Ihcbj0I0L4PFAIjxVEku9ddh/uAtL2g+WKBTKIcwGAgntUnvL06sXnQnuFli/TVfE9WvTOg3HxBfuAVzW8QRTvw+Kzf8Xhovg0lJMCUWw/BGVoWRTAkDTFapFffIbkieLpU1x8iJMuPl1Hc5wSJazRvqVwFNq3HE8V3/8eUCAz+WxcXfZOnOxK1uKlP3FxGVySa4oEvhWTAZqLYGHaFKZHFp1KcAlM3K6pMA3P3Gt3+X7vw+ka+qOecQwVHJx1jH9r89ADhALHFYbGylUyseB+uhj88O7s4ifHrN0Gq7v1ePdzGH2azcPPMTKj0/UEp1CdAgntR9U738OsEPfVaeDdLmBswaT2dD+XDwXXPg167xygf2bx7sq7haYm1UkULinu2ywWs2OEWLVZb+436q1MuiyyEeRJJB1TGgrJU1j8uJTyrwo8wsTkVURMcmtCo4OxINFtBHUAUaZVuql0zVKXFdlq1+KhH3JPf/s1s1NwMcnxQRVxAM7Dgc9ot0oWCGsfhsNL8e4DEEWAW6yOMtkpK+Pyiixm9RsK9vnmzafP+CUJy0vWgMVRdC/7m3PApCpIexV+8hdKvdJd7Wu9MNPmiaYDJr4/vBiUBFzGCk5ai0WSp5E59Jc9mDI5tl/IgrgDFJpyOaVVZPEcfSDep46JtvXw5AlPFPMAT6K8AOWKpIQmQGB2XSgaI1ynuzR0lPGIyRg8gmQ2b0Wh2A4KLJhoOz+n7zJTRkVm3706udAkfR+HU6aKY6lPaGKJsTWRb3c1iTNjBTSElZOD3gFfRvNutVrGnd1dbxlwBIMH0NyhpWX5Y2EYYpHZh44bQ+zjR+hN380xVG99LwLaga8SbT/MfoKkFrzFsx0wXLz7sJjycezgnbbZktL8ufo+WH1Yj6vdZVD9UQR2NQFpNauNRrV5CFzPScgw2fBp6ec6pF6eX6jtoEA9uSUdr4P51EUlCxBvKd6wajy88f/YSdI5oMoaezYKLxp2BiSqeYixLAqHHPnxMlyUZwuUjzYrXWMyBccRB4FD3LA7vL4yy7KWMZ4iaYdk7IAsMe1V2g2S5YwV+M4hch8b1wVRzlHBVA/hGulrDsuc5WPZJzQZnTktLxMThIl7+I1sjPFLiZUxq8JEqO16W1gBMTyBTzKoeKtmWvVmrhl4UrZTgvBwWCv82DDPwTP+jiUHgHk6MmlUgx8scqJow9oKIqBajURPGLWZjryZxP7Gd2tgHilkuvwQBdVAbEwzD2eRx6IrlWvGyYcayyOBROkJfOBoGcqsjechYhm4gT4HiylQMrWFvzItxK+6Kh5RATFHDTjcCTvShK1Kq8atmnfv/R4uPOiISsMFhjK2d2jyOOidArt6MiwF2r8bpz7sAfIL/vzJ8DAOl7iJCBfAqSY9LsNERgb9cbRYK2n/5ehEg84TqEhwTWNvawSyAYngJZqum0Aix3pUsXVXRUQieslk0aMiOt0XBRO+qzExDCKid93+2TVKnBjjozjOSE7gmUtIiYQM43c5vyIVVzwqJeiKZFczfDKjZVOZhYE85ORUJeym3ro30RnTSSZEjt2sN1TdeWNMWgv05kyfmIFr1VR9wRGD57Ov5Au2uDwz89XFvuaInu3oRsT+dxblzgM+YbJae3MD7wRE79CFx2QyMVuXiX9shHBUIwOlEGs06ET1vncLR7tWBlyvNgEdd4xwu2eYCvsXF9i7c5X7FAU8Hvv/e/fnq8nFl9F/ZehhS9pwC9rv2fpLSLgXoFVkPLagpJjslNAf8Obb0lEJ1QTV/xqaKR1ljnRKDFm7b6965yey9lnHzXLgf/AXHhzECgARS+1uE4/BdVM84FJR3wHsJIEdkknQCQnqiMHk5qqoMMKgIouCwaV8q2FxZHxJcIqabmyT2Dum2cD3yyh4oAAmyG4R0wio9/rtWf/ETTlf97R/dXJ2cXWtUGukHWZs8PrDD9dv3d6PPZ5UlLxxgzhe+8LUlpFlikroiNYdogxqSLUaAP2soQsUDqsC6Uo790AW2NQTubHzYDOwj/utA5ZOaolrwg9CktYgWxF2/OrqujhbOOm3KMV2eHExl9Ex/5buG7UU7/LnMTehuKsJg2XRFBptkimzpZ8Vb4QVdZxsVW6EzUvIBsxySfl5KUWb9kW7BWfJHElE5i6fFy6naWX7RmJVAk3oHoF1u96YYtIFQjycBAyZ4ubDKesNzGw3eITwJX4yIEpmKb+yzbP+jz2XWhDyOwXkCHNwxfqhAXjhViM86SjgtkuZ/eRZq6B7OOi/f98boGdRtoJ281mPSPfzQTL4WvoReonAUB8Cz2WXhQt3iJmG5AfowPCPjXb76GjPZmvJ/Ta754oUqCirTAGYaaTjXZJgyjgcH5B5WRp+jqMyR7UuVx+6eKBOrgeYMNT92O2XHeD8+WFwxpz6WZwlvKEAJVwA0eF2r4cfLgYYU0t9XhNrBMlroSPQoMKlopM5aSUOFh01wGjgXDg2UKJDDcrrn5Itnuy+0Gk827jYhZvFf1xFQP65vwdLuk07r8oYDum+/bV/qbxviUTguoXar8HyHYqlg7D2Fo1P+hfUBJEBmLwoeFBSAehXFDu8QA1/YbyNSv72p2IYa5SN5mPv49veQC2jSSt+CWo4NGLcKYYGomxq6RmtqVEqXuOEEks1wGTi7Nkz66mLhr9n/Stdzlq0TimmWEuidpDXFO90MwXBbpVZWAtiNFSvWIlogZ5iTFl3DKfrn43kRWI8fHb+A61SDbYZhRVzBIjo++8b+9YWsgiD94B6H5aj7K4m9NTckwpeo+oBY53yIglwwAkd6C2NWdRuvsNEKWJjchozkqPKeczSzvV8chZAsAmAj+wsaOTJW3lOHKgv1F592e29SRpl+bISmpJa1WuyWe2iG1C0CmZ4DsmjBmk8yaTIzlgHZUO3Fg4sZRnLqNtI0QPcRtpgrsqccvXcpviaC452xaji/2StUtbLHfOfcGG4wP35TqNe/yf7UoKHefPooIFufROMJ4foF/cgeZd0ReH5GrZwrkWNmZBsKELzskqOqpligl3pauDFgKrjBG0iyEtfcVNYiaDNFSCL4GCRhrggGCofMiDl4jrDwyJVl/YjlJcuZhAbbUPlQcEbCoGFUxPaUEar4xvkORWOkfSOZW7V0NhUIu+cV4pJqIYURgexBYYtnkoNTsIFpZbihBq3DTFFTBUFlY7sIbt78wIgcSMDz1+AYr7E6cLiQlpQEq4rM1V8tepNRbgpUYvtHDfU26AWS3tKfUO5MX3H3AGUIafNS+R3iIRO++9VbnqkxXXyd/Yxee/RuxvpAksc+Pib4nWmPyDJ2DLaMrJjZGbOHJPQJioLC4tFoKAz2IvTjt1Loh5P+UyvFPhjy+DVW0bSLeGIlN6qGQ634FbqOAS5EtOk9VzlSn+132rCBW5g9kpcVwtogPH4Etf/AlY/5X/0HJjEJG1ktbR4ochoycYRuW6ynOgW/rZbdr0NX8o3kBjAEoaHM3MEFR7zTVGuHRVYwQgAxWM6BU3ZLVg4MY2v5eHYPaXMIS/yN0tH7ktytRL3kcWhdvpSsCfJ8dgmoXlSGzBaYmadQ48ZE2uZOMrbTmd+PhcoLYCeeH2f+AgjqcUBihikErqL27XpA2FkWc9UYG0JAwR7S3n31weQ4M7Uqc28qbb+EdLuh4YcpuiulgQqUnK5Op5UCrXQkVj6xHIerbnFG2GdjqfAJ8EaL5vlnfWe+psY42IIgBwn/LWwpO2Zl8ocEA4sN5ljM8pEOunAftbSCB1aBwE5ZkcH2MHPOxwIpv585VW44TPGyLAsub08/0m3onxF86AsSXrZV0WBWsDEkKSMM1GJwkU5gFbMeyDSMAtfhw6PudUmLymraGx2biQ4GRX0DfDYYW3wIscaG6xcjBYoa0mxIj5+7BcPl1B7rcL7YMKjldSM4Z0f+XhOp7LSehEal93hyYfd095Zb9hDFVJ1vcQDyYyaNOFbskuGBoO4XvBpdlJLQgqmaXbgz3OJuJa1eEOV4XJIq8uxVuCcjP8F10Ky0I4DH+lCYEJEwDknPxQ5KNL8pcTCV+jJSgRw1Lhu7OJtOnQMZiKYBAQfTTHFDFH5gwj1rWqOrGZ2jkIiCdTVnVeiiKCqcpeMMuGPM8DtOKWwX0qS3CxFKcq4jNIh0Yc4MSPoIHNoMiMRZxEZOjqNfGEu3v5fPTLY0KxNItVMAiLxZN/Cv4hWWUZaqgBEmZhNHVWoIS1uS2LUiUtYf5l8KwoAmKdFjLbGFfSnF+FBbDSDcTVCFa7bcl5k5iwUYnnPCvJenzqp2w73Z5dRs4jykiLnnOyTt5K4GCH/+P76Ix13hVQWtxPgxTGXT0CxL1pGtW9U3xpVw9zBRdgx4QtvUplX2YwpHn/1HfyhBOYLQMH4IGA5kflcd81PPrlJVYHwVETSwNB1OmAwq5iN+S2i9Y+oLn2itAD0sM9ikQR+jKhbfnMFpPRkhQ4LP/hPJ+hwgIIsKlDSyTXwNj/ARbrAijFKqB3GZqXTwLdk206OuFTrJFws4LANhTa7XtrHFXoWRd158OD3AbIj4GadvWTY6csTFId99B6dpqY5eRmvrj6411cAcFc9QOqwlDvm/zF35BKnvXfd67MhOalgGAW276NXCkdtmITtAkGAztpkWd2o11HScU/K6pzn135dPiD2xFtKgtMydSN3ux70Pl4M0fH/4yXcpBgtT05afpzXzMPYSmLVMSEqN3rMZrKSeRZO33QUZyFcyOmr0kxP5DG6IYtVWew5LZ7Lum1mvYZ1npc6X8s8YccFZjCjonOx1pXYLjgGP2t3kaKMMWOzfIwx9tRx2KL+UUkcu2bM9IxduXyBMfmbyq2cwRg2Z5Gd/BVCsCZEeDoqal/OknVXy3sI0zB5OW02LNGOOh1W6b3Nq+YiyZUIz+QOC2HjSuVo24wjC2Qjx8nHLMzMVwlzIv2M8OTdpls1lOZbSjZWF/tOKNB5q/IJUerPBYhl5Msq8CoX0oo9pKOPTShDG8grVzxlG2I/lIpANI0KrYIq9lUhWwJf2fIgEalqgXeZRwAjZfj84oFLV1vhdi8vFF9TIGeVK/AljZNmK+MM2YVwMXYxqoqtD1HynK7Mh+5Vz9zWTZxuQMkDWLZYwAhUau9w/BbBxeVr/cTpBiUrxa/ylzuWbmAnaYuUo2wHCyw8L6ugxHjCvasPXcJ2xyrRv0QQp8kBeUWNgoIbb+hsN45Ju5QqSwvLkLH2Atb7AyxGZoJ24nhW8GVHz5+8MZUQLx8njqsOi26I2INqZOXOzCKZ7ScWET52ksgBa1lpMGg975i4yuYjpFYSCouBC8r5kkdAzomKFibkKxoblTjyfoVTcuPfmRToJV7JBQtcYOCd7mVfafWSutaNsnzHB3d48QOQmCONmoiEvvzGdPRmlty+sngD5bZSddWQqQOZOChGzt3yUYRuytYP3PCB+fSbEvSm4LFj/rZIiRp4w37g47LgP/VXulCIL0JKMN3lemWmATBr95/QPIUWpB4eAEvqPwaAQcJP6ujfBU5DH6chx7EngU87nPYXkVg6AknlpQrPGe6+lBzYgtaVE9/m4q2W8ga5AOLP25IGSgo3CY++bSvZzvH2/vPxy7kWqXf+Y+9M55GZV+RKNLNJ8UlSWhiDYWa4uRcEki8SdNSBpAFONIcZEmUL0j3ToGVtu+Db0fe5BUgyeYk11d20TCz1MnwlLNAoiZ/ISFjJ2LzRJDH3eNFaIAFzy+qksXl2sTGLISp+SRenRxkMrb8GN0o7CDhQta2IETObkZbL7ZEWdy4jtLdkO8M2RNvXscGSsBXK5foq6Ua+EbHLbF8kUuY0OHbHjexzp7f3MwrbHPiAl/3hscFIY27m+msXT7wj82cvuDKIEHJ0tNFxNiA06cGcooEb1QDimn9pjrYy6/hz9zXTjm5QAfPWFQPkkylqlLqwUrN17M13EaCnkfcZvmJbxjQKZisW7JN3j+Rg7M18Y7xeGXCX33sLeIphbJdokf3qzx1xCdtuyuiQr/qVd21Zcg4elIyrBEpv4a8U7uVakfCSyRpiuGsDgirgJsVBZJxkehTlI0gMJxz57U+XOFnbSzEYy9HYKpiRIghWSXwjXbynUjcn6DqIgwUMGmGTitlXJJ/oQS+WNsHS342PQQwVb3eDBe25wShJYwGwHRksegk6Hhrx02J156+CieBduGyxth3iTOXLxyJ+y8fuL+7bHjO6ODbeU4S1YW/wsX+ebpgQSasidIglbGzHjuWzs/6IOja8dDFqgZjUEtaQCJL1gkWbRePkW2/yBHPyZ8HjN2TPbm6ANaswAScgwG2St/5hTGBrqlPDhP9VZ0bDem04DtRUiRFeG6PRV3WXYws3dSotsbLjRMfFGUxxkw567/o/m9qgUjaP8/Qqa2fKn9aIO/pTAYUsnajGi2M/HUeNLRnaPd10mnvtVuNwZNXu/EdOPaIUvVXf258c+a2jvf3W0Xh2OK0fHozHrfF06je8o/3WZH98MJ3NJnt7Db99OGsdTr39o9b4aDxtHh1MWhmlZH6FClsIU6axVZm22YgnEdyC8S5MY+Wm03fjVbhc+lO0AUPzFFesA2wq28HxpDmpHzUnvnfQ8LyJ15gctRvNxrjenDbG08ODyeywNZ3tzVRwhIOI/IcqhXQwPvS6pwlUJAKmHBxglWkwmxnVKnAG/kr9auIBezXNlSmRoMCZBNTt/5tiuuEaV6WzopGbDBGV5eO4XeIwRXhuhNNVOAnnYgLxMUe5FHnfg8X15gbJlXlsTRRLLfwVQvrLgriNg4UXT4Kg+GYSLp8UT5Hnjl8eDG42Abrp24SCAySM1t9/cYw4Fp1w6zhxq2itGlK8HmNEbbgJt40t59+zUG/bRp1bBKtV1k2E5iie1+4RSHjhJRLHijbWwXSrmHMfeoOe4dCCVVwWY85FRBmH8we/YtWY/YtUgUd8i6GSmFht6GP7XvR0mmTyYLenw8PUVekc8ZrVzO0Opw2jRYoxpHwoU13KMjA76bxGXG8mgJ2Qx0NDosldQynHf5XlatjNt6Fu5oo0syQgCpdTdQBJ3eKiUiM3z+xMdIqKF03m20wo03+GbK8QrEA7SQDBzIVqlQ9F3VR2GPoGSVBBsF5DmaAEJrbxJQMkHUrKymdtPRf2ARENLMsLwyxKkxH4G8AxN8XCChT7KYRVxD+WYoiqIIuZgri3k5p89DHJLDxsNA8P20f1xuHhoSw4IB4JXzcOjxp79YNm5mX/V4RMOamw9JYlgYf3pmcab4x2piZRoPhujO8y99HJ8Gd4kXXZxQjstH54IZJJoW0ovHdhFi07NSo22nv7CtuOEq9eAwNq7Fcb9WqrMazXO/T/Hfpr8oYTk2SjUbRSux/jnkZo9gRg8ClYYN4UVNmz9Cm2MYbD5NQL4EU54YHUAhD2osh7qjT2LUWRm/oIS0EbqpdtfIl95gGDriTAyZNPKF4IK+Z3/T5MByvZxmFmhBqOl50tSjFfmPM0jHnipGIkC+9zZlZ7jWbR5zwC6htLmUDFDq8HPRJhuyTDlmTXKB4zi83fdNCujjVi4fzZV0XBdrveabdpjcYmUl751kjGSuEiMivCxK0N22jW24fsr2UblaYNEH20nz4AwNtvtNvssfWStMgVqMTO2e6uAUtks4PFflhKbzU2oX1jx6iwIQPt27DgJDX2O+39puo5LU4GPOuPh63yzYde9hr1DgyDLdtvj3t7vz16nqkxSK13OKSg90fxdNwuVxxSWOYXB+eXn144n/JEMTHhloPWQbtx2GzX67gi7E3eFdaLV1BWrlktRJ8mCKQm91uHbW1bywhGGD1lwJYVtNQlt1shURg2DTdItRk+oAcAs9wsCiIfuDsCoqNkZAEzKmweYAmCXycBJ+WEtwN70t3LYC8eJGDPHnwt2PNUQMmotWCfnXjzUBPD/abDIP6udtY/v/7ZfXelKQcHpkXbgbRv7fq6f4qyV4etiFUjcHbnvjJ9SwGt/td//ZdJgdRto9VMlxM/4EjSslZxj+u6Ue/td/bwVCNSE1eeKVJnmevVrNrYr8590yJcV1pCFR6Jwc5NHjc0Dzv8Cf3ApmEwBTcJJEwEl1iDn61mhbdoGf806o8z/q+gqo4/ubewuplFNsferD6r16fVRgPjV8G/agv+VdvSP1PaAEV0MRaFS2QktFm0M5ud9K3gR32wExA6ZGe6965voL7V3A4I+nS5EhDAwak/NsjS2zhqavZdDUcJIDXhmORnyM4kob2qQGwKXCFB1QHBeLIVWw5DmspBky+sjSDC/wAQbDmjpJ0G4I4cENFaHzVHWSgq0Wyld8yme4ijXUBUbKs7AmYabPlgKeFdE+BevGf1BFzr8Fkls/aWvj7bpDf57lnfjdweKq5MOOEur6MK9MKCy8ogrVgVpqkARNes80uqTgR5IW0HXRZ889YL2j5kOfj2Md0ObLxVDNKg2XFRpbjnbEwd7HPDvmf2nOl9ipHWKK9mhWgLFhDbKKEwqBgxWfiJKhH2RTL4Iq1NnlwpMGrefI4X8c1IGb3bm1bC2cw2WFo+JT6iFmrecukvppVMaUutvIEiImAZGzRc3hRUB3/cwFtYzL85vJFOaQTRLomvgfSg4HjJbWNw/safYvDXcCEkkTShMnVzOoSCdSHmUeVR6ulKpu1iqREr2KxNTKjYMw0AZJqx2dIVASHJucgT3hbcCEhbw0bBc13yknmCLSSaEmWftanvL/GLuiQSUHjeyTADq92Y/PibI40OjoqnwelQIt7W7RYviycFSxraHJuKCdyYiF/cdcyyUOZqZ94V7bxEA2N/zoZo3iLbq9LjhWmiaXc+9qgnkisAZcdeskEKk2UFeS6816F0YVfj9dKPSMhdYQbajqBoGS0q2VU7xH1t4kNVlqhll1ab9xGXYqqyFvAW/4Lddow6u787iP5xtB2j+XwjTWG0RbsfRLt7+0hi+LO91jajSa9zokYeWxP825xQI+398Utm1GrtJ6vy/fdA76q4x0a93WmwaydLX7ebWtq6eMkXTjna7nB8VUmtzChZVqcM+9iGCyPht0XhHMeEFvzHVbsiQZylyrpOAirhrW8IAz8g3E1uX26k/vlG6qCfTVrHJWRbOOhTaAUuNINGMhKruxpLBCd5Zeaw1snwZ72bepIxvAMzuke3NjJNiGHPfRf1hygUmzAhnc2EwQAKwGzA86Z4cO/9CzBQB+jdsux1rChUxqLYGJGjaV3xgJeAc8IHxER7W7RNpe/Z4MzosynGN4vxAe5s8gjoEeCzKaggvJJsCEq7oQHyjIz80jITHt7l+JxNjqW8FWWJ0S1tGkOJwKXmZjBlB0VAz9rN41nEBZCz34lHrTrED7vDrE1xEcobSTIbyqkxofAs1o+VEr0DlDEd7ZfUkQVPArovG+jPzOIaG/wbrqMAf3PKobBsFVGgnoCtzyo8p+aTol1uQylSoBtms9Y6qrVMlGjIKXkNs1FrH9TqwHDrdyFJmt0pUhUIH2ke6E6RQKG0dQKFpQ4K+s4y2Zs7xs0XkQOanRieBLrDBInS6s34Yoxe2mPBO0oxzWKyZbydt055mqQENcyr60s0geydkg2lqRis+fbs4uQHKDC8uDjDU4tWzWbZ7pByBnBmTKAl8szkm8Xmrtzr8+6P3f4ZmmUWfCvlCDv8RlGkMBriigx9VOclulf8eeIpMvKQaztaZCCzQZZVrghMAviJ8rQlu41TmMb6SOoqCll/3THDhvmsxuxYev+zFruZEH02I/m2qolcCK+dUL8A/e2tKkv2j2z0AsHYhpLk1o6A5gy19jbUOPNjWMj1fWXBMlzaBqEEUf2uhtnQNUHGpWbOw1V/UakQqQskLVB1ewckG6UvFt+DDY0g7qNs78jcfcdFohgqCn5+7/DfO0yIO2PPbZaTk7VuvdLBFGpmuASEwdbXwo6k4vk6MIIGtgMj6tg2biqAy5B3H30j+Ck7dgKXuRgRFb1XY5dd3ngEZ0AnxDKrtHEN3VIq80VMqHqJOAvHxii4P0DuTHWE4LKhnfdEP0aVAisp0DQB2zZgK1rgXhwxrWfkC0W42l7+jqUxdSnYDl+0wr1o81Uqh+4Eh7tc455uIYlKXY6LXrhpG+B9ywkUdlc/F25Vy0V97iSa6EcsxFepeEqZUs2bZlheJp5BPZV1jC9v9vZHxn87RuPYSF/xGjEcn6nW8UOCgQFKkuKBf+s/VlhyEDjr7y+HLlr6YdT1wYlpdTLiuc1rQOP965YAmXCxBof17BrQu2+2CN3BoPvLy9bg7mkcwRJE/r8oqqnL8rW6FDt00/WvWJTjguSDzbM+Yq9u2vvNTvvgUKcb5ipvS6xPPV0chZx568X58MvbQf/UhTXafmXwSGI87MUUloVMD5NV0i8JXpdoEEHk/h5czHso6Djcs7Rp0/gaSghg8xru1YXhxfbrlF2reD1GCpEMRhz8QwqL8kXs/TzsnZ9iLNaLq5ctYwhM0NxbbrF+X7Uc24BUo17/1kCVekQCGz84w3BK2y7K5yhc3LokFmAsPAGYRAQs4A2SAN/g7keQvF+vuI85hiSgbpDVpEhq8Am9VbE3/H7P3C7ImNjUgq1QA20hrZYdecUwULbLRtERbi0JDX/TGnFSA2iMHacgt9W1R5PRNMdCxqECu06aqMb+lo0mK1NsWGhRvpiJFGbPTqclpNFwywGlvoecMknU0Ypr2yXK7IVmaqlI39jb+tiLXhzxRXX8OaRbGe5b6MNKqFvOTgo5nwuzYG5/L7tIkBtB66pHcZg2a9clpdQx10Nnr1t8BTVyOs4/c+VyJ87+ae8ckMEv26MAmmuGAEnlBtvcMhQfH0094PoWtjPNI1KTo0yJtOXNvX1r482zxe3NiTidWR+zPKjb2TFZOTpv86KrYZUadTJNO7wH+wVUkRDbbL1BaNG6RpKIuvajGQsxiXSie8s8EO/DB8yVMcUYkVAsitbkEPdNKCa+5sxiqIRw/rMAXEY4K9gxFuzKEZ4QaPzOnlUyWlZV3cTw8rVwwc+p6PEOyarmEQt+9haYXrc42tfb8K5scDXaQ2G1aasNVxItBNmtTFD+7Lr4xXXVqd/8SUUkVOfdRP5yDg3wjkhUH2NkQMP8LgtFib+NAVP5Hu9dbA5LJqOwSi59GGFSjmJ/inU3R5W5dz+eekxos+hIiE8ovRU2sS8RzW2B+pchut0CV+ktkJAhY/nJOl6F9/Aw8m+/8RlRGRLJVnGyqauxkyEFt8ZN6vOUXpHb4ZT4LozYesRE5okLgMlU9Guy1Wm++nAxYDFcTXZnS0YPHCjeuB1jbJobIAGvFzYiulfqzNQSUHzjqGl1tkbc3CCG21hsIjA2DlbYaujWlsMeqmLcCAU5LlOX0kIzHzR34QPmDh7KxDNAUIuQ+V9BWosYLolaBL0GmLaEzjhw1aQQ9EhVyI4sSivXLBOnr6e4E2uWLMktxrotSZlo2Vh7aCdBOadZJpwbob5htHLBU6Ks5UQPpGmZv38RTZ8omjRt8vc4WjrkWzbL9kHbKntNS6AJzqtrGPdV2yyDQdbu3/62bZNCjycazWhcv2KbUlBTDVQwNVkgU0yo2lBHavkz/EaCyn5EJoOsxCQzPvptEbLQyN61qIFEpYysFmLaVIeOZiJ59puRC1ocwYRkBeb7WClnZ4V16EOE10nNIiS+PGHUWTIsLW5gcUMcWSSs75UDBXaM8MCa7rA2ZPZ2GS4rdV0DFPKxUAfBHGP4IFTyKAWm6OtvCcvPtJ9HR0fbS6n8Jwf+23SHSDJysUM0ws2SfTi3Ce2SyPP5F7g8UE6z9KZTzMTCqG4taPzdSEfBI7kAkHnz+ZMxmYcwYGOBeRfQU3xq3PpAEa2iJ0bfJCShMvsaa/x+jcmUYCRJq1OW02wdxHeGGDFjDTiY7jLo8AxybIxq20rd9HZMBe5A6WX+Uhf5vzzC4Et85JV5vUXgDY0sUmO7xmvZBnOfapH4CcnQpl1q1iD0bAlamd602+0OtMJsqn/91dRYRjLdkGLjUjN13qL1/BJtk1LBtEldzXiJDdSGPGJtoVJ+NBfnFM3SNhkg9BeV1xgK10XVexIQ63TQfzd8bRv6IIC5Jljc3ayVzEhqoGiv8S4xYOoupm/XU+ChX2y9kdoLkqwYzVlmsctSJwaEu0i96sVBCbIitMcMKlOfLbQQfaWX+BbtFdNWttPVizhnPPKxLQ1Dbe3NFa7yHMlRr3nU2G8fNA9bzS2hMNcznET5SaqMVna5LajTOlbVbXBHy6qx3UjKhFOrtrvfHgcrHgZ6E8UidrnSAJSHtrOEgVrb2Trkd1zstryJYgNLRzyGowkIM5jwUROQktGD75GzernMM8trUUNIHVFbVZKu46/gFi7GkN74i0n0hK4Fetqp4KFVYoirldPTSDqJyNkphMLT1ZSG3tlozt3adjzJEpS32UAvsfpjs17ftuF0PctbPtpP/NCsv04pQWCZSkH1sEcB4xeYfJjZt43hsEzRRmk5XwNDsPDd2ZqZduugDw7xPTLfUp61Cjru4yLCxjRsY/U7pvp1NiReY9crC2BPbWYyexlHuCOsrx1Dmb4LSlglMhssQ6cDytVw+eswtKr4+jLhDfXHPzdtxZ+YkeihRLJDV6Q7hYsdQ6Lh/RawVLAPJVvGatGNxe7YSkMr2GMRO1jcKpgWDpJsweFqRftjBGuyxHRZ8EPWdE242TbKV4eXJpqqUiIbnHhzLyJsmPDo7sRbbsCJ7F7GLWcmzVXYcMLx+60XbDebF1PubdjqTHaArxGVJmHdx+aX14+vOw0b/zafzT/ZGMlBpPTftDMlPB8jkYJwspqjbwdGJGOPwsUcUIP3hKFNaD+Yup6ZJet3Q+udJ7qlriqzKUITSyZlqFws0/gBtwS9l0JU0Y1u10gY1ygsy3g9m1FQkeVTmUINBR0oNSQLltoEbQqgYcRini2eXl5g5MNBRerLsmrk3QFkuKbhrCthZlbYAcpx8BMTz8fsK/Y59xc2janGfdXpO5MN8h/LRWjpQjfT/nzyo4U/rxwdcdE+p6p2uJga/k8r/TLzT2wNrqzmPny2bLRsb+w1NR2ojUQ3g2rp+Knb7QcuGx83yqAczUwpOJY745TiYjZHrRaz90ZMA1Tk5C6YT13OT2xQRBTjaSFHU6HYy/hcB9AUiK1Go6hQffwDvcEM2Cs0s3d7Pxt/yL/P3+pAO2H+KqYc6s0OYxvYq98WZpnfxmyK6ScopvRrjPEz2cVJ786mu693pJwemCbgwh2c/jSwNjSI0VMzM5zamVn9kZ3ThtZEoFVsKljc9i9I/JmGZ222NrWQFK1bmmjVdIoxeq8QZLIkXzesJmq/uZdPFW9AHlyXwlZlds8C6r+JZxfoqxlc6Lm91VLRxbNIY2lqyVzMPkajZF40Lv5O3IiriWtNDrQk+5z28xZjAZ7erFZx3Z1FaBLmireoxizz05oLIu2/oj5c6hM/qac718IYgY4tC42LxAId6hVLPfcn1YknH/pnpyK4uvaSKgUZM4mDeAzHiAVib9hjuO7fNIAaNRngYJK4Rl0TqcIjfxmHQhDWEoKsYv25WZ32uqdn/fPen5wXDuqYRhbPfX9Z2aMp1epbOYPkZ2RUxXTRAPZVieCHCxZwq9eL9Dc5qVKoNwAO/ebLzkQoGpRdW7dJzCDXt4VHKXcVtV7YX0mahu07ZYTHlvkfNl/SL5mtVuGEk1wvWHpIYDxJDsSca4m+x2jvsAj+fPoiiQcM0ZTcbm0jqzUif8esg6QtnHpJMsLTjzCfPj3svxRClGpLGGrHYLLR7fWp/lxuh+b8gslavEPRwOjruyYDVR7Bns8il/hvs+a12KKIe89bzGV62KZF1LpJAmdu85NTwW1jPfsNxC8vOihFIbj3iTKeLlbdy34hfIK/DKVwU0kMRsV5c91gAfSrS+fIxmAiMATHVEM3mw8VgebZF12xUnaOSvBsylBGkeGLwgZE4RjtBGclgqWkq4SVMqmaaetCsmQmQYANxasUWp9kkBhrhW1TReR37r696p2f9JLseyVRVXgCcmNSS5NmP+e7pZO5jHwKIgvkKZm5oF6dBSPQ5z0TIVP4bqHCBv8Sq731+qDSxhSVs5YKoind2rFgsxhZREpS3ymjztJN5m1LWbT1uDC/R6yrKvwsbBGAv/uu2z+7HvS0VHqyNyyMAwuP0K4/bwYQ2inMRy/YPjI/gt9z2AUaj/XSAZUACoIBS8DeSQc7ZYNVLgv5BVaFhTg3DUim96yAHiGCYfu/NcwANuIgUwYaTCgRI3JMk9zrL0rFjFD7iEhQcx5ftNmb1pd7PIi0rcz5fsOK49aLMW5a7hLIwxsY09Zvt81UlHc25p1tCKrAstlTtAHePo/p+zzCWKPp41nyWIUaeTus75tRabjI5Fx3sicfusMME4rmRQU+NTMXTo1ddCdJ8OWXKHl58iFxqy0DJRBS7iDHyK+RncAEgUluo8QOlO33pKbIfqSK8kJDwKgVScCWpvj2xUyyOVE8laOjo+cyZ0xKSuytwvtgwkMkuwJSOa/DrRZcnJH+SoWhwppk6Asl2So02gxd8PXGld7CDZlrax8wVUvgTzVpujAvPFIQiIuY0wZ+gS2DXjh9AVCFX8gnDSCKrrbRNvI/avSmMcq0Sz0CC3qTud9sQ+Cy2NzOvZ3aQVKyic5TCD9o/80B5+UtiGNII+Mw+pKBNLAZW4cRc3eiEr2zlFoO5WmgkOVxdoTJlb7VqES+bDk690jjVaCtLIURx7pqsZe2diabXHr+Np4vQbHBiXrKsqlIELjirIkbmZK1lLOo25GEdpZOtTMkESdJUhJlc1DfLA1jF0kJu3AX27nbT9xhdnpP2ClO16tlFOiFrcH2qm7OpfBqpXzWNtgpBykk/KjABlcEaqHNuewOTzCMm3naO+th8m81Siqzeviqvdau5MZhJxhRO1K9tQleO5Sg2b2NvPt7L0oMgJHQi93Pd8GKBx2jywUIxWgCt7Ee2G/DECWRppTKyaAemFFhKoioipxdsBhVE2O0eex04lfOIrPnYy27Lwuk4/NwhbxUZVJTJFPEYWlNAiiPKW4XDR56/A23R/wwcKsMHAk+Yc8THyYxaCjS5chl47nMNiBmmoieqrtT/2EXvZx0PbFvLesFqmucooN/xGFJV023ZFRaCTy/B0tOctF2wsl8up8HC5GbWDWqcI0XSxDW3qIlSv9CL5vmaW1qvwZLUphBTZjyZ5a01Ismd8GDXneWBhQTCn8aYdnZQoMUGJrUbR+eVFSZXPJcDZt1h5pAOxs/WqCn42qFZuZo57GqXbn9d2fnPxh/GPXw4ODAQpsDrV81U9/QDJkeALVI2DifTwmfCauEXoZUrMR8AmYpTv18Hn6eB8zuP1iVGokw6y8CG9z6m0yWWwMNFPD3607jmUVqU6S7pVLsCbNi2I6GmNRINjmhkZMCHwmctPcO/0UO48JXKNMzlkgkis3n5/K1EdgP+sSQdLCbLMZHamvCN53QYUhh634vWTnaD6Ju5dWr1XZzC1i+cLRc5WilZHM2to1vYx9IgxU9evwWvRWf/pUzANqOoox+bQ+PSqOYTTsy2mRsxHb/BeZkAEsOmizwPKpbuv+gu0/2oGyIP7AIAdBZclcXmMXpPPVChfF/9qKp661Xd2EU/O6Vu2pzYxbKXrSO5pgZiT+qDdhnxbxbrZZxZ3cXKRKW8BEotftddPFj3qSx88Xsyv0ho/LWB2ozMkTymaveyaA3NJ+tzVQA3Wfn4YDPsIJ5qPhk+dgqiQ0OC0reqmNMxhnaO8KgviAiEYPmsvXaeB7isOHb52AxDT/HtYW/gjlYG5XPCXufjAL98pdo6/zJXzBHKjR6i13mpVhiOkWSkgHQY0Doau9AFrMRdqRZ19nXMo2AT97HLu9PXCT4q7zao6RIeEP69w6ZNZTUoqjrrMbEW6adjRO7BH7tmdppXyz9hR91SoeW0XGIYGeC4OF7zpQVx+yZKAPPxNeSDsgMhjWeABC3IthMvYvuhbCV/95AYsx5j0l1C8n9RmcDicnEqcmRJA6j9mE4vGRB5cURRVrPhTKFE2CeiUhxnexCPbMjUzZqvrUCTLUuwaJJ26DQEGjAwKK/bnn0GMD8ZxzcOpeD/o9d4NW2ugUK/9Ie14tVtEY1dI27nIteoGVG2mr3OSTwBDhicFpJoK+UP0a6u19RJVETeG948YMmgbLaLDePhpGrWJP1C40rb6PLnpZCLzK0fIM2gV2BfEOUL3CuuUuZ43Zzk931iEeMdwWejHcbu3CHwUj9xyWFeHEAOi1bgSys7ceDVkPZO8bme5YcLeCla/xCekHD3CJpU9uNrdom1fWGvjfZZnzDNX/pdiO2yk283O5SFz2Gi+EyAWQifx1jCNAlvuFR3Es0xvoQLHmpfXkUlruaiMOCC5vqqi1MTELkg8nDyLvdMwwr8QtLif5viLwy+Qsjr7Cl2T7myrfXsWyC84zILytozGjZy5QaUniYLEyYo7ImS3Q8L7t6Ejnt1oqhr1K6lBj3r+cr5uWPZpLoej2lEPwo+yaPyfVkQjGZv5WdXKJj+JICRqKd3OAs3Xips3Tzf5OzdNNU8k+4AyVpK1gBHuaAx2KnkIrdM/dikJiq4FG+8yithTnEIOnuT4P+ENgmtJzvnW7QFSjTX5QkupDVKppMBFjE2kCJvTinAb8WEsCRlUTBSh/HnncXjnmoglyCDjJnwNDueR70nLawe04riHqRuQ9rXF5OhcomqRUY288K+yjaaGbtw/T3Ew+KIck5KxUBIRR08+qKy2EIKuARhxRy477sDj8IkUqy8Ta3q2vXtyWgK2moHk6Bu8CkU4y/7hkXKymXFsOU8eWySkL5TMVFx1aLBwfmoTNo4t82NkZxm8aYBGu7PXqVTSPuUroW1yXtjOvi3eC6BRuqZQTVKwmx//Hi9BqO7tWHLhw4ctZ3UO2QHAvKNY7x1tLM7lKCbWNHuRymlNha0dxE15xtzObr+I6l78m1nCavh3lV4KoZowz5yWluinfRzKFw3ByDBNICgwOFtQon4Zw2EbUGsh6JLqNviNSXT9DHomVU326B2HNDBwY3nD/4Bjl1GpS72kBE5C2mBv7Hk0NySrR00MG0Y0Qw17RUMOsYXFbmP/g8+Q/BUhDHa18kyU6vFH/xIAPX+w+Mc+wY//Hli2iJBE6GRGx9o8XSZqJ/bVSrYl78PR4eNlC+ilDXSJWCAgowyQgr5fvTuGPIrQOwvHrJGhn//GemXI1e13hqVczxtt86KBTitWvAdEQ1TAJExsm8SJoD3WUbr6vN8J4L+CacBKmJMyDi3oAGVqnweh5Fktuqi1UU3N4C5YP2CRtqWcYff6hHtgRaP4zu4TZ8CDyXFUFVcA0TwmJi+Xb76GjPojEqGxiHUxYbSdb0kjJXo+jlB6KKOMPEcTEzwp/QjFDbg/1iTbJFYya4qeXApibILbRbZ5StqS/M/IXI+y1Kt444gFf89MTVEE7Qegys07rabNfqTEnNhYLV+2ABwA/g22CSWGiaLcLkSRxW6HS97BjLSXUShcsqhn2MV6y76jyY+ZOnSZKJDWiiiT+vBosqrMgtzAVanqFYir8HjnsNR+ree6QHMGwKjQyMjehNOKt2SCLLH9JxyD7i8gHpmYRfOD5n1yG/rDqG3zzw/MmBN54dHU1aB0d73qF3sOe16vvTo73GQbM93jucNpvthuftHc72J169Nd5rHE2O6vv+5KjZzjZ+cnE+HFycnQGKER20pz7UGjfG3oHfgor70PLMa46nB21//2gyaTZbB7M9b9LaO2wcjf2jg/3G4eGhN63vNxr+fuNAdNAffrh+6w4H/ffve4P++Xu3ezK8GGQRZf6AJTjz6uqD+wGj4TB9BKvFdGdx7fIE4+eeUoFslesrnEhJFVEoWw0zLm2shoWy1X7oYSDf/sfu4Bd9NShUrAV9XZyfltYTlJ6y/rvu2RnGes5W//HySt0lreQ72IPeAJo93zzXfAXRHGCBZQLkVQMFRR0BxLukXYHj+H8eUhMSJC7k+zLyZ6zXclSQkstGRmYx81eTu+rUX0KrmagmS1QQAykBUyG3HDit2TMrqIke095xWggJHcr1yjFbcL+c+4gTsyqKb0gAca6VH7/ez8MBHAuZY+XOfBg4dB6MbSOMmaE4/cAgcmgu8jnyllIdMjrhhWpEbZpcA7j7OYw+zebh51jC7tVpOPnkR1UUlAKKv69OA+92AVRwMKk93c9NSxO1ilHzYmg1xq+S+YpIwG7ddJp77VbjcGTV7vxHTv9ajmO26nv7kyO/dbS33zoazw6n9cOD8bg1nk79hne035rsjw+ms9lkb6/htw9nrcOpt3/UGh+Np82jg0kro7DKpLUwP5D/hZlisqKJ1xLNIqOFE73+76ygofKfne//+P57y/jt9W9aUuv1DnYGtMlnP6pYO9Hr34Dk+k0lf2AloYRbualXj0Y7lvnbolJ785/Wf2vJ9bTOb43fFnlZJlkI+bEToQ/xYoppsvhkbFx3G55//AP+XOU5B75XvD4RyjfIAwXMzi6wKYMWfz1yHLRQqVCgWpIu8xdFz5XI++yYZu1fIfAjAhJrUzp0FaQjLJ5QjKiWtAcrgRD1OHMwhQYoWQAKY2jhIYjCxY2puhhZZEfMH+IwiOBW8Lp7rpgvWD4+cm8SWJgj25Qhw8xChglwAYeHLIpcZTz0wsnPYacfUZj4JITqxN3MfW9hCNT6DTHSzQ1wFxW23vH6voTVQP6YmIw/gLSEFqdkpVedGQ3rNZJqr/9DtSGvjdHoq7rLcTabOi3sbK5jDea9HPTe9X8uQbwcHl5lQf+bI1kuBXi1xYn4t+DW/AoVthCmTGOrMkWoEU+iYLmKd5mncTJ9MtVeYhQboNmBTHfFOsCmsh0cT5qT+lFz4nsHQKtOvMbkqN1oNsb15rQxnh4eTGaHrelsb6aCIxxE5D9UKZKkgWH4E6hgZCeAQg4OsMo0mM2AVf6fdeCv1K8mHhy1aa5MXhKBohNS3sG5WizgA0gmA8iKRUwQJAQqqFBb+czt8hse3PW9F38y6gcHrzLyLfQmdvSnipeQ75f7T9MggiVTvALC/L5ifSHbgbnxAO02Xh/T55eHv+Off/zj5m83HVLpdEajN8+vn5P3/6BCf38jF2DvSQo3M8x/ADf4+j8e4IlM25EYDvYW+4bXX/IsQPU/TnvvutdnQ3r6/Dqj98OFz1eWqfpqs5mrkShgVV0qaOVqrj4BIo6ZA548OBXuy7EnUOv/Nv77plv91av+7o74FyAa3OroS/3/ae9qe9MGYvD3/QqLoTGpvZEASWlX0KatlSptXaVN/cQ08ZKsqGlgoZSxlv8+25eXuwQCmtSpqu4bQs459vl8th/fZb9pr6prBiEx4ycpvri39x2mkxUO23rJFPTZTJv+Sv847oDrOE1H2855xEQNctQ4B8zeZq/e+b6Xe5M468ZFcj0OAsEX+nYaM+Q2o/OQVIvrk2Jmdy1k8Ons8uTHxy+f35+dV6DR5Z7rcB4E6Nj7i2uo3bNVQNVe1fAvzLanIE5//8pr9IUGKsri8bW3RCPV9vHbiLeKXlSDYyCrhW5m4XV8QA+whlc3kxG4llVGtEleZwYz9INI/9MLQSxBXECN9yh9MFCEbnRfqWfgV9qaW66TCGdJhFIUnOeHh6TvRz9Kny2tXlgrCo67hy6TqsMcHRlOzMPawIM43Nv1eq8X1qvUxL96dHY2RQLyznqcCHnLWoGnZl84bgnb8klInIGa4aMDIPWvociy+c00acaOJLuspUZqXLMhBoDiG7RBTFMXkLgeVQNEqKlA4XOkUXJQrr7G4moceHB2+rXDlSgQEdDdhm9hNNHmxJ+Su8wbG5HS9KirIcDdFPcwkOFL2cKnJvVK3uQrVX9aoVvaVQ8l7X89926pfCP65vVxXlfqjkteUswLY+jug0+msWsr7ASvF0MUWuOhksvwxNYdaXSjOws24fx8lkjlDa8mUEnCNdztOrF1sDLiSOjk/DKPqHyg6BpDN754FMMXihNAqe1uxVCGcoCnD4oo0iTCX8TX0kNy2VywhOl8gD/lHfOC7ltMGi0oA/OjyR8v1BWjF77mUzrDKZI2knde33YdDMNdZ+B6B87AaVmt1qF32Bi02m3XbzVd68DvW42NVTL5plr4RiV3rtZRBe5NPAFpvUxpFNALZpSvoJaFtr5oHNQ+tY/RaVF8QtOiHDQ7OfEPzxa6+TXQVoQTiSoIboQ9Au6b1aqE8ZcKxKi/REU31Z2BWq2oJs+Ve+/OC7JKYGrgmDRH8WvK+YytOw3Sy03cx7kNFshaScwK5kqrN/Jhe8hdQiLVVVnjE7Ym47uuggwSZExnB0yQj6gZUNCAgk8PFOQ3eAaoIJcIDSxoYEEDCxpY0MCCBhY0sKCBBQ0saGBBAwsaWNDAggYWNLCggQUNLGhgQQMLGljwKcCCXHh9PrigKk4BGGTAKPERI/mh7LQUJIvY5VDRf0cH5UsJRat0F+x4tA4L3A3AkyPuAN2NMXmJPIPdPQ529xc3vsBXtLUBAA==';
const growthBlob = raw => createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex');
const growthDigest = raw => createHash('sha256').update(raw).digest('hex');
const growthSyntheticAfter = Buffer.concat([growthBefore, Buffer.from('\n# private synthetic growth admission fixture\n')]);
function growthFixtureMaterial(actual = false) {
  const after = actual ? Buffer.concat([growthBefore, gunzipSync(Buffer.from(growthFrozenAppend, 'base64'))]) : growthSyntheticAfter;
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
