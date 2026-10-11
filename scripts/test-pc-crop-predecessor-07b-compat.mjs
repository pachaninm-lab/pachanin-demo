import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PROGRAM = 'scripts/pc-crop-predecessor-trigger-governance.mjs';
const SCOPE = 'docs/platform-v7/autopilot/scopes/pc-crop-predecessor-5580-20261011.json';
const LOCK = 'docs/platform-v7/autopilot/pc-crop-predecessor-trigger-lock.json';
const WORKFLOW = '.github/workflows/pc-crop-07b.yml';
const WORKFLOWS = ['07a', '07b', '08b', '08c', '08d'].map(x => '.github/workflows/pc-crop-' + x + '.yml');
const PINNED = execFileSync('git', ['show',
  '666b86471404c57fe175057bc2dcdd367e20fca8:' + WORKFLOW], { cwd: ROOT });

test('every admitted SOURCE leaf triggers the independent native scope step', () => {
  const workflow = readFileSync(join(ROOT, '.github/workflows/pc-crop-predecessor-trigger-governance.yml'), 'utf8');
  const triggers = workflow.split('\npermissions:\n')[0];
  const scopes = ['pc-crop-predecessor-5580-20261011.json',
    'pc-crop-07b-routing-5580-20261011.json', 'protected-entry-locale-5580-20261011.json'];
  for (const manifest of scopes) {
    const scope = JSON.parse(readFileSync(join(ROOT, 'docs/platform-v7/autopilot/scopes', manifest)));
    for (const path of scope.allowedPaths) {
      assert.equal(triggers.split("      - '" + path + "'").length - 1, 2,
        'Both PR and push must trigger the scope check for ' + path);
    }
  }
});

function fixture(t, variant = 'compatibility', scopeBeforeBase = true) {
  const directory = mkdtempSync(join(tmpdir(), 'pc-crop-predecessor-07b-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const put = (path, bytes) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), bytes);
  };
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Guard regression fixture');
  git('config', 'user.email', 'guard-fixture@example.invalid');
  for (const path of WORKFLOWS) put(path, execFileSync('git', ['show',
    '43aa983e9ccc4f723cbb964b7b76a898172b05fe:' + path], { cwd: ROOT }));
  for (const path of [LOCK, PROGRAM]) put(path, readFileSync(join(ROOT, path)));
  if (scopeBeforeBase) put(SCOPE, readFileSync(join(ROOT, SCOPE)));
  git('add', '.'); git('commit', '-qm', 'Actual Git fixture authority');
  const base = git('rev-parse', 'HEAD');
  if (!scopeBeforeBase) put(SCOPE, readFileSync(join(ROOT, SCOPE)));
  if (variant === 'compatibility') put(WORKFLOW, PINNED);
  git('add', '.'); git('commit', '--allow-empty', '-qm', 'Actual fixture candidate');
  const run = (args = [], override = {}) => spawnSync(process.execPath, [PROGRAM, ...args], {
    cwd: directory, encoding: 'utf8',
    env: { ...process.env, GOVERNANCE_BASE_SHA: base, GITHUB_SHA: git('rev-parse', 'HEAD'),
      EVIDENCE_DIR: 'evidence', ...override },
  });
  const commit = () => { git('add', '.'); git('commit', '--allow-empty', '-qm', 'Negative vector'); };
  return { directory, put, git, base, run, commit };
}

function pass(result) {
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.status, 'PASS');
  assert.equal(report.workflowCount, 5);
  assert.equal(report.boundaries.acceptanceWeakening, false);
  assert.ok(Object.values(report.invariants).every(x => x === true));
  return report;
}

function reject(result) {
  assert.notEqual(result.status, 0, 'A drifted or unauthorized vector was accepted');
}

test('all five original locked variants remain accepted and apply is idempotent', t => {
  const f = fixture(t, 'legacy');
  assert.equal(pass(f.run()).boundaries.pcCrop07BFiniteCompatibility, false);
  pass(f.run(['--apply']));
  assert.equal(f.git('diff', '--name-only'), '');
});

test('exact admitted full07Bvariant is accepted and all three triggers retained idempotently', t => {
  const f = fixture(t);
  assert.equal(pass(f.run()).boundaries.pcCrop07BFiniteCompatibility, true);
  pass(f.run(['--apply']));
  assert.equal(f.git('diff', '--name-only'), '');
  assert.deepEqual(readFileSync(join(f.directory, WORKFLOW)), PINNED);
});

test('any substantive body byte drift rejects before apply', t => {
  const f = fixture(t);
  f.put(WORKFLOW, PINNED.toString().replace('timeout-minutes: 45', 'timeout-minutes: 44'));
  f.commit();
  const before = readFileSync(join(f.directory, WORKFLOW));
  reject(f.run(['--apply']));
  assert.deepEqual(readFileSync(join(f.directory, WORKFLOW)), before);
});

test('an extra trigger rejects before apply', t => {
  const f = fixture(t);
  f.put(WORKFLOW, PINNED.toString().replace('  workflow_dispatch:', "      - 'apps/api/**'\n  workflow_dispatch:"));
  f.commit();
  reject(f.run(['--apply']));
});

test('one absent additive trigger rejects before apply', t => {
  const f = fixture(t);
  f.put(WORKFLOW, PINNED.toString().replace("      - 'scripts/test-pc-crop-07b-routing-compat.py'\n", ''));
  f.commit();
  reject(f.run(['--apply']));
});

test('even a harmless workflow comment byte drift rejects the fixed variant', t => {
  const f = fixture(t);
  f.put(WORKFLOW, Buffer.concat([PINNED, Buffer.from('\n# not the admitted variant\n')]));
  f.commit();
  reject(f.run());
});

test('changed lock bytes reject and are never regenerated', t => {
  const f = fixture(t, 'legacy');
  const before = readFileSync(join(f.directory, LOCK));
  f.put(LOCK, Buffer.concat([before, Buffer.from('\n')]));
  f.commit();
  reject(f.run(['--apply']));
  assert.deepEqual(readFileSync(join(f.directory, LOCK)), Buffer.concat([before, Buffer.from('\n')]));
});

test('missing lock rejects and is not recreated', t => {
  const f = fixture(t);
  unlinkSync(join(f.directory, LOCK)); f.commit();
  reject(f.run(['--apply']));
  assert.throws(() => readFileSync(join(f.directory, LOCK)));
});

test('other predecessor job body drift remains rejected', t => {
  const f = fixture(t);
  const path = WORKFLOWS[0];
  f.put(path, readFileSync(join(f.directory, path)).toString() + '\n# altered legacy body\n');
  f.commit();
  reject(f.run());
});

test('candidate-owned changed scope cannot authorize itself', t => {
  const f = fixture(t);
  f.put(SCOPE, readFileSync(join(f.directory, SCOPE)).toString() + '\n');
  f.commit();
  reject(f.run());
});

test('working-tree-only authority mutation rejects', t => {
  const f = fixture(t);
  f.put(SCOPE, readFileSync(join(f.directory, SCOPE)).toString() + '\n');
  reject(f.run());
});

test('stale accepted base without admission rejects even if candidate supplies exact metadata', t => {
  const f = fixture(t, 'compatibility', false);
  reject(f.run());
});

test('malformed, missing-object and candidate-head bases reject', t => {
  const f = fixture(t);
  for (const value of ['not-a-sha', '1'.repeat(39), 'f'.repeat(40), f.git('rev-parse', 'HEAD')]) {
    reject(f.run([], { GOVERNANCE_BASE_SHA: value }));
  }
});

test('real nonancestor authority commit rejects', t => {
  const f = fixture(t);
  const unrelated = f.git('commit-tree', f.git('rev-parse', f.base + '^{tree}'), '-m', 'Nonancestor authority');
  reject(f.run([], { GOVERNANCE_BASE_SHA: unrelated }));
});

test('changed regular-file mode on pinned workflow rejects', t => {
  const f = fixture(t);
  chmodSync(join(f.directory, WORKFLOW), 0o755); f.commit();
  reject(f.run());
});

test('changed regular-file mode on authority rejects', t => {
  const f = fixture(t);
  chmodSync(join(f.directory, SCOPE), 0o755); f.commit();
  reject(f.run());
});

test('default first-parent authority also verifies the exact admitted variant', t => {
  const f = fixture(t);
  pass(f.run([], { GOVERNANCE_BASE_SHA: '' }));
});

test('unrelated later FGIS assertion additions do not inherit whole-file freezes', t => {
  const f = fixture(t);
  f.put('apps/web/tests/unit/platformV7IntegrationControlTower.test.ts', '// Later independently admitted assertions\n');
  f.commit();
  pass(f.run());
});

const SOURCE_HELPER = 'scripts/p7-source-controlled-scope.mjs';
const FINISH_BRANCH = 'fix/pc-crop-predecessor-5580-20261011';

function sourceFixture(t) {
  const f = fixture(t, 'legacy');
  const scope = JSON.parse(readFileSync(join(ROOT, SCOPE)));
  for (const path of scope.allowedPaths) {
    const pin = scope.pinnedCompatibilitySource.find(entry => entry.path === path);
    const bytes = pin ? execFileSync('git', ['cat-file', 'blob', pin.afterBlob], { cwd: ROOT })
      : readFileSync(join(ROOT, path));
    f.put(path, path === PROGRAM ? Buffer.concat([bytes, Buffer.from('\n// actual scope fixture change\n')]) : bytes);
  }
  f.commit();
  f.resolve = (helper = SOURCE_HELPER, override = {}) => spawnSync(process.execPath, [helper], {
    cwd: f.directory, encoding: 'utf8',
    env: { ...process.env, GITHUB_HEAD_REF: FINISH_BRANCH, BASE_REF: f.base,
      HEAD_REF: f.git('rev-parse', 'HEAD'), ...override },
  });
  return f;
}

test('accepted-base SOURCE helper accepts exactly all eight admitted regular files', t => {
  const f = sourceFixture(t);
  const result = f.resolve();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n').sort(),
    JSON.parse(readFileSync(join(ROOT, SCOPE))).allowedPaths.sort());
});

function combinedNativeClassifier(t) {
  const f = sourceFixture(t);
  f.git('branch', 'main', f.base);
  f.git('remote', 'add', 'origin', f.directory);
  const workflow = readFileSync(join(ROOT, WORKFLOW), 'utf8');
  const match = workflow.match(/      - name: Enforce exact PC-CROP-07B scope[\s\S]*?        run: \|\n([\s\S]*?)\n      - name:/);
  assert.ok(match, 'Actual PC-CROP-07B classification step missing');
  const script = match[1].split('\n').map(line => line.replace(/^          /, '')).join('\n');
  f.classify = () => spawnSync('bash', ['-c', script], {
    cwd: f.directory, encoding: 'utf8',
    env: { ...process.env, EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: FINISH_BRANCH,
      BASE_BRANCH: 'main', EXACT_HEAD: f.git('rev-parse', 'HEAD'), EVIDENCE_DIR: join(f.directory, 'evidence') },
  });
  return f;
}

test('actual complete07Bscope step admits only the accepted whole eight-leaf repair', t => {
  const f = combinedNativeClassifier(t);
  const result = f.classify();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('PC_CROP_07B_PINNED_COMBINED_PASS'));
  assert.equal(readFileSync(join(f.directory, 'evidence/scope-mode.txt'), 'utf8'), 'SLICE_REMEDIATION\n');
});

test('actual complete07Bscope step rejects extra runtime and candidate-owned authority', t => {
  for (const alterAuthority of [false, true]) {
    const f = combinedNativeClassifier(t);
    f.put('apps/api/src/app.module.ts', '// unauthorized runtime change\n');
    if (alterAuthority) {
      const scope = JSON.parse(readFileSync(join(f.directory, SCOPE)));
      scope.allowedPaths.push('apps/api/src/app.module.ts');
      f.put(SCOPE, JSON.stringify(scope));
    }
    f.commit();
    reject(f.classify());
  }
});

test('reproduced old candidate-scope expansion passes old helper but corrected helper rejects', t => {
  const f = sourceFixture(t);
  const old = execFileSync('git', ['show', '43aa983e9ccc4f723cbb964b7b76a898172b05fe:' + SOURCE_HELPER], { cwd: ROOT });
  f.put('scripts/legacy-scope-helper.mjs', old);
  const authority = JSON.parse(readFileSync(join(f.directory, SCOPE)));
  authority.allowedPaths.push('apps/api/src/app.module.ts');
  f.put(SCOPE, JSON.stringify(authority));
  f.put('apps/api/src/app.module.ts', '// Unauthorized runtime path\n');
  f.git('add', SCOPE, 'apps/api/src/app.module.ts'); f.git('commit', '-qm', 'Prior scope expansion vector');
  const prior = f.resolve('scripts/legacy-scope-helper.mjs');
  assert.equal(prior.status, 0, prior.stderr);
  assert.ok(prior.stdout.includes('apps/api/src/app.module.ts'));
  reject(f.resolve());
});

test('extra generic infrastructure path rejects despite unchanged authority', t => {
  const f = sourceFixture(t);
  f.put('docs/platform-v7/autopilot/unapproved.json', '{}\n'); f.commit();
  reject(f.resolve());
});

test('working-tree-only scope expansion rejects before generic allowlists', t => {
  const f = sourceFixture(t);
  f.put(SCOPE, readFileSync(join(f.directory, SCOPE)).toString() + '\n');
  reject(f.resolve());
});

test('partial or stale-empty complete SOURCE diff rejects in direct helper', t => {
  const f = sourceFixture(t);
  reject(f.resolve(SOURCE_HELPER, { HEAD_REF: f.base }));
  f.git('reset', '-q', f.base, '--', PROGRAM); f.git('commit', '-qm', 'Partial exact source vector');
  reject(f.resolve());
});

test('real nonancestor accepted source base rejects', t => {
  const f = sourceFixture(t);
  const other = f.git('commit-tree', f.git('rev-parse', f.base + '^{tree}'), '-m', 'Other authority');
  reject(f.resolve(SOURCE_HELPER, { BASE_REF: other }));
});

test('SOURCE leaf chmod, deletion and rename reject', t => {
  const f = sourceFixture(t);
  chmodSync(join(f.directory, PROGRAM), 0o755); f.commit(); reject(f.resolve());
  chmodSync(join(f.directory, PROGRAM), 0o644); f.commit();
  f.git('mv', PROGRAM, PROGRAM + '.renamed'); f.git('commit', '-qm', 'Unauthorized rename');
  reject(f.resolve());
  f.git('mv', PROGRAM + '.renamed', PROGRAM); f.git('commit', '-qm', 'Restore exact source path');
  assert.equal(f.resolve().status, 0);
  f.git('rm', PROGRAM); f.git('commit', '-qm', 'Unauthorized deletion');
  reject(f.resolve());
});

test('alternate scope-directory environment cannot replace accepted source authority', t => {
  const f = sourceFixture(t);
  f.put('alternate/forged.json', JSON.stringify({ schemaVersion: 'platform-v7.concurrent-scope.v1',
    status: 'active', branch: FINISH_BRANCH, allowedPaths: ['apps/api/src/app.module.ts'] }));
  const result = f.resolve(SOURCE_HELPER, { P7_SCOPE_DIRECTORY: 'alternate' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes('apps/api/src/app.module.ts'));
});

test('other governance branches retain the existing candidate-only admission behavior', t => {
  const f = sourceFixture(t);
  const branch = 'governance/fixture-existing-mechanism';
  f.put('docs/platform-v7/autopilot/scopes/ordinary.json', JSON.stringify({
    schemaVersion: 'platform-v7.concurrent-scope.v1', status: 'active', branch,
    allowedPaths: ['docs/platform-v7/autopilot/scopes/ordinary.json'],
  }));
  const result = f.resolve(SOURCE_HELPER, { GITHUB_HEAD_REF: branch });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'docs/platform-v7/autopilot/scopes/ordinary.json');
});

function downstreamFixture(t, branch, manifest, candidate) {
  const f = fixture(t, 'legacy');
  const file = 'docs/platform-v7/autopilot/scopes/' + manifest;
  const bytes = readFileSync(join(ROOT, file));
  const scope = JSON.parse(bytes);
  f.put(file, bytes);
  f.put(SOURCE_HELPER, readFileSync(join(ROOT, SOURCE_HELPER)));
  for (const path of scope.allowedPaths) {
    try {
      f.put(path, execFileSync('git', ['show', '43aa983e9ccc4f723cbb964b7b76a898172b05fe:' + path],
        { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }));
    } catch { /* These are legitimately added helper leaves in the compatibility SOURCE. */ }
  }
  // Trusted helper has just been accepted; unrelated sources still have their before values.
  f.put(SOURCE_HELPER, readFileSync(join(ROOT, SOURCE_HELPER)));
  f.commit();
  f.acceptedBase = f.git('rev-parse', 'HEAD');
  for (const path of scope.allowedPaths) {
    f.put(path, execFileSync('git', ['show', candidate + ':' + path], { cwd: ROOT }));
  }
  f.commit();
  const workflow = readFileSync(join(ROOT, '.github/workflows/pc-crop-predecessor-trigger-governance.yml'), 'utf8');
  const match = workflow.match(/      - name: Validate complete accepted-base finish SOURCE scope[\s\S]*?        run: \|\n([\s\S]*?)\n      - name:/);
  assert.ok(match, 'Actual native scope step missing');
  const script = match[1].split('\n').map(line => line.replace(/^          /, '')).join('\n');
  f.nativeScope = (head = f.git('rev-parse', 'HEAD')) => spawnSync('bash', ['-c', script], {
    cwd: f.directory, encoding: 'utf8',
    env: { ...process.env, GITHUB_HEAD_REF: branch, GOVERNANCE_BASE_SHA: f.acceptedBase, EXACT_HEAD: head },
  });
  return f;
}

test('actual native accepted-base step accepts the original exact compatibility SOURCE', t => {
  const f = downstreamFixture(t, 'fix/pc-crop-07b-routing-5580-20261011',
    'pc-crop-07b-routing-5580-20261011.json', '666b86471404c57fe175057bc2dcdd367e20fca8');
  const result = f.nativeScope();
  assert.equal(result.status, 0, result.stderr);
});

test('actual native accepted-base step accepts the original exact routing SOURCE', t => {
  const f = downstreamFixture(t, 'fix/protected-entry-locale-5580-20261011',
    'protected-entry-locale-5580-20261011.json', '786f62889f8a17f9d25e92e5b8a6e4941d8f205d');
  const result = f.nativeScope();
  assert.equal(result.status, 0, result.stderr);
});

test('actual native step rejects a candidate validator replacement using accepted-base executable', t => {
  const f = downstreamFixture(t, 'fix/protected-entry-locale-5580-20261011',
    'protected-entry-locale-5580-20261011.json', '786f62889f8a17f9d25e92e5b8a6e4941d8f205d');
  f.put(SOURCE_HELPER, 'process.exit(0);\n'); f.commit();
  const candidate = spawnSync(process.execPath, [SOURCE_HELPER], { cwd: f.directory });
  assert.equal(candidate.status, 0);
  reject(f.nativeScope());
});

test('actual native step rejects stale-empty SOURCE even when legacy shell guard returns early PASS', t => {
  const f = downstreamFixture(t, 'fix/protected-entry-locale-5580-20261011',
    'protected-entry-locale-5580-20261011.json', '786f62889f8a17f9d25e92e5b8a6e4941d8f205d');
  f.git('checkout', '-q', '--detach', f.acceptedBase);
  assert.equal(f.git('diff', '--name-only', f.acceptedBase + '...HEAD'), '');
  const shell = execFileSync('git', ['show', '43aa983e9ccc4f723cbb964b7b76a898172b05fe:scripts/p7-autopilot-guard.sh'], { cwd: ROOT });
  f.put('scripts/legacy-shell-guard.sh', shell);
  const legacy = spawnSync('bash', ['scripts/legacy-shell-guard.sh'], {
    cwd: f.directory, encoding: 'utf8',
    env: { ...process.env, BASE_REF: f.acceptedBase, HEAD_REF: f.acceptedBase,
      GITHUB_HEAD_REF: 'fix/protected-entry-locale-5580-20261011' },
  });
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.ok(legacy.stdout.includes('No changed files.'));
  reject(f.nativeScope(f.acceptedBase));
});
