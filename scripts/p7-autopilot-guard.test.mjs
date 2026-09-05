import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const implementationBranches = [
  'fix/p0-registration-authority-rollover-4637',
  'fix/p0-owner-control-plane-audit-lock-4698',
  'docs/pc-crop-post-registration-progress-4997',
  'governance/pc-crop-post-registration-progress-scope-4997',
  'governance/pc-crop-inventory-reservation-scope-4997',
];
const sourceGuard = path.resolve('scripts/p7-autopilot-guard.sh');
const sourceResolver = path.resolve('scripts/p7-source-controlled-scope.mjs');
const sourceWorkflow = path.resolve('.github/workflows/platform-v7-autopilot-guard.yml');

function write(root, file, content, mode) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  if (mode) fs.chmodSync(target, mode);
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

function commit(root, message) {
  git(root, ['add', '--all']);
  git(root, ['commit', '-m', message]);
}

function fixture(t, implementationBranch) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-immutable-scope-guard-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  write(root, 'scripts/p7-autopilot-guard.sh', fs.readFileSync(sourceGuard, 'utf8'), 0o755);
  write(root, 'scripts/p7-source-controlled-scope.mjs', fs.readFileSync(sourceResolver, 'utf8'), 0o755);
  write(root, '.github/workflows/platform-v7-autopilot-guard.yml', 'name: fixture\n');
  write(root, 'docs/platform-v7/autopilot/autopilot-state.json', `${JSON.stringify({
    allowedCurrentScope: ['README.md'],
    approvedConcurrentScopes: {
      [implementationBranch]: ['allowed.txt', 'approved/**'],
    },
  }, null, 2)}\n`);
  write(root, 'README.md', 'baseline\n');
  write(root, 'allowed.txt', 'baseline\n');
  write(root, 'apps/api/src/app.module.ts', 'unapproved source\n');
  write(root, 'apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx', 'unapproved legacy trigger\n');

  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'PC-CROP Guard Test']);
  git(root, ['config', 'user.email', 'pc-crop-guard@example.invalid']);
  commit(root, 'baseline');
  const baseline = git(root, ['rev-parse', 'HEAD']);
  git(root, ['switch', '-c', implementationBranch]);
  return { root, baseline, implementationBranch };
}

function runGuard({ root, baseline, implementationBranch }) {
  return spawnSync('bash', ['scripts/p7-autopilot-guard.sh'], {
    cwd: root,
    env: {
      ...process.env,
      BASE_REF: baseline,
      HEAD_REF: 'HEAD',
      GITHUB_HEAD_REF: implementationBranch,
    },
    encoding: 'utf8',
  });
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

for (const implementationBranch of implementationBranches) {
test(`${implementationBranch}: accepts only a path approved by the immutable base state`, (t) => {
  const context = fixture(t, implementationBranch);
  write(context.root, 'allowed.txt', 'authorized change\n');
  commit(context.root, 'authorized change');

  const result = runGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /Scope guard passed\./u);
});

test(`${implementationBranch}: does not inherit allowedCurrentScope`, (t) => {
  const context = fixture(t, implementationBranch);
  write(context.root, 'README.md', 'not branch-approved\n');
  commit(context.root, 'try global current scope');

  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Files outside current autopilot scope/u);
});

test(`${implementationBranch}: does not inherit a legacy diff-triggered scope expansion`, (t) => {
  const context = fixture(t, implementationBranch);
  write(
    context.root,
    'apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx',
    'legacy trigger must remain unapproved\n',
  );
  commit(context.root, 'try legacy triggered scope');

  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /OwnerAccessCenter\.tsx/u);
});

test(`${implementationBranch}: validates both sides of a rename into approved scope`, (t) => {
  const context = fixture(t, implementationBranch);
  fs.mkdirSync(path.join(context.root, 'approved'), { recursive: true });
  git(context.root, ['mv', 'apps/api/src/app.module.ts', 'approved/app.module.ts']);
  commit(context.root, 'try rename into approved scope');

  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /apps\/api\/src\/app\.module\.ts/u);
});

test(`${implementationBranch}: does not treat a plain file as a subtree prefix`, (t) => {
  const context = fixture(t, implementationBranch);
  fs.rmSync(path.join(context.root, 'allowed.txt'));
  write(context.root, 'allowed.txt/evil.sh', 'unapproved descendant\n');
  commit(context.root, 'try plain-entry subtree expansion');

  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /allowed\.txt\/evil\.sh/u);
});

test(`${implementationBranch}: rejects branch-local state expansion`, (t) => {
  const context = fixture(t, implementationBranch);
  const stateFile = path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json');
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  state.approvedConcurrentScopes[implementationBranch].push('README.md');
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  write(context.root, 'README.md', 'self-authorized attempt\n');
  commit(context.root, 'try state expansion');

  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), implementationBranch.startsWith('governance/') ? /Files outside current autopilot scope/u : /Mutable scope authority changed/u);
});

test(`${implementationBranch}: rejects a branch-local scope manifest`, (t) => {
  const context = fixture(t, implementationBranch);
  write(context.root, 'docs/platform-v7/autopilot/scopes/attack.json', `${JSON.stringify({
    schemaVersion: 'platform-v7.concurrent-scope.v1',
    branch: implementationBranch,
    status: 'active',
    allowedPaths: ['README.md'],
  }, null, 2)}\n`);
  write(context.root, 'README.md', 'manifest-authorized attempt\n');
  commit(context.root, 'try manifest expansion');

  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), implementationBranch.startsWith('governance/') ? /Files outside current autopilot scope/u : /Mutable scope authority changed/u);
});

test(`${implementationBranch}: rejects changes to the guard authority`, (t) => {
  const context = fixture(t, implementationBranch);
  fs.appendFileSync(path.join(context.root, 'scripts/p7-autopilot-guard.sh'), '\n# branch-local mutation\n');
  commit(context.root, 'try guard mutation');

  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), implementationBranch.startsWith('governance/') ? /Files outside current autopilot scope/u : /Mutable scope authority changed/u);
});

test(`${implementationBranch}: fails closed without immutable base authority`, (t) => {
  const context = fixture(t, implementationBranch);
  const stateFile = path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json');
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  delete state.approvedConcurrentScopes[implementationBranch];
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  commit(context.root, 'base without implementation authority');
  const unauthorizedBase = git(context.root, ['rev-parse', 'HEAD']);
  write(context.root, 'allowed.txt', 'attempt without base authority\n');
  commit(context.root, 'attempt without authority');

  const result = runGuard({ ...context, baseline: unauthorizedBase });
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /no immutable approved scope/u);
});
}

test('runs immutable authority checks from a read-only trusted-base workflow', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  for (const marker of [
    'pull_request_target:',
    'group: platform-v7-autopilot-guard-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}',
    'name: PC-CROP implementation immutable scope · trusted base',
    "github.event.pull_request.head.ref == 'fix/p0-registration-authority-rollover-4637'",
    "github.event.pull_request.head.ref == 'fix/p0-owner-control-plane-audit-lock-4698'",
    "github.event.pull_request.head.ref == 'docs/pc-crop-post-registration-progress-4997'",
    'run: node docs/platform-v7/crop-platform/post-registration/verify-w0.mjs',
    'HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}',
    'if [ "$HEAD_REPOSITORY" != "$GITHUB_REPOSITORY" ]; then',
    'PC-CROP immutable-scope authority rejects same-name branches from forks.',
    'checks: write\n      contents: read',
    'ref: ${{ github.event.pull_request.base.sha }}',
    'git fetch --no-tags origin "$HEAD_SHA"',
    'IMMUTABLE_SCOPE_BRANCH: ${{ github.event.pull_request.head.ref }}',
    'BASE_REF="$BASE_SHA" HEAD_REF="$HEAD_SHA" GITHUB_HEAD_REF="$IMMUTABLE_SCOPE_BRANCH"',
    'Emit required guard context from trusted base on the PR head',
    '"repos/$GITHUB_REPOSITORY/check-runs"',
    "-f name='guard'",
    '-f head_sha="$HEAD_SHA"',
    "-f status='completed'",
    "github.head_ref == 'docs/pc-crop-post-registration-progress-4997') && 'PC-CROP immutable scope · PR-head defense' || 'guard' }}",
    'needs: standard_validation',
    "if: always() && github.event_name != 'pull_request_target'",
    'git show "$BASE_SHA:scripts/p7-autopilot-guard.sh" > "$TRUSTED_GUARD"',
    'standard_validation:',
    'STANDARD_VALIDATION_RESULT: ${{ needs.standard_validation.result }}',
    "- '.github/workflows/production-full-stack-exact-sha.yml'",
    "- 'docs/ops/production-p0-all-role-registration.md'",
  ]) {
    assert.ok(workflow.includes(marker), `missing trusted-base workflow marker: ${marker}`);
  }
});

for (const branch of implementationBranches.filter((name) => name.startsWith('governance/'))) {
  test(`${branch}: permits governance authorities only when the base lists them explicitly`, (t) => {
    const context = fixture(t, branch);
    const stateFile = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, stateFile), 'utf8'));
    state.approvedConcurrentScopes[branch] = [stateFile, 'scripts/p7-autopilot-guard.sh'];
    write(context.root, stateFile, JSON.stringify(state));
    commit(context.root, 'record prior two-file governance approval');
    const baseline = git(context.root, ['rev-parse', 'HEAD']);
    state.approvedConcurrentScopes['future/branch'] = ['future.txt'];
    write(context.root, stateFile, JSON.stringify(state));
    fs.appendFileSync(path.join(context.root, 'scripts/p7-autopilot-guard.sh'), '\n# approved governance change\n');
    commit(context.root, 'apply approved governance changes');
    assert.equal(runGuard({ ...context, baseline }).status, 0);
    write(context.root, 'README.md', 'unapproved despite a governance branch');
    commit(context.root, 'attempt to exceed the prior approval');
    assert.notEqual(runGuard({ ...context, baseline }).status, 0);
  });
}
