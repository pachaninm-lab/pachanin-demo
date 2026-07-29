#!/usr/bin/env node
import fs from 'node:fs';

const LOCK_PATH = 'docs/platform-v7/autopilot/project-locks/pc-crop-remainder.json';
const failures = [];

function readJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`invalid JSON ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition, message, target = failures) {
  if (!condition) target.push(message);
}

function validateLock(lock, target = failures) {
  assert(lock.schemaVersion === 'platform-v7.active-project-lock.v1', 'lock schema mismatch', target);
  assert(lock.id === 'PC-CROP-REMAINDER', 'lock id mismatch', target);
  assert(lock.status === 'active', 'project lock is not active', target);
  assert(Number.isInteger(lock.governanceIssue) && lock.governanceIssue > 0, 'governance issue missing', target);
  assert(Number.isInteger(lock.activeIssue) && lock.activeIssue > 0, 'active issue missing', target);
  assert(/^PC-CROP-\d+[A-Z]?$/.test(lock.activeSlice), 'active slice is not PC-CROP', target);
  assert(Array.isArray(lock.sequence) && lock.sequence[0] === lock.activeSlice, 'active slice is not first in sequence', target);
  assert(lock.productionHosting === 'REG_RU_VPS_ONLY', 'production authority is not REG_RU_VPS_ONLY', target);
  assert(lock.operationalStatus === 'NOT_ATTESTED', 'operational status must remain NOT_ATTESTED', target);
  assert(Array.isArray(lock.allowedBranchPrefixes) && lock.allowedBranchPrefixes.length === 4, 'branch prefixes incomplete', target);
  assert(Array.isArray(lock.forbiddenProgramTokens) && lock.forbiddenProgramTokens.includes('qwen'), 'forbidden program tokens incomplete', target);
  assert(lock.rules?.exactIssueRequired === true, 'exact issue requirement disabled', target);
  assert(lock.rules?.sourceControlledScopeRequired === true, 'scope requirement disabled', target);
  assert(lock.rules?.projectLockBindingRequired === true, 'project lock binding disabled', target);
}

function validateContext(lock, context) {
  const local = [];
  const branch = String(context.branch || '');
  const title = String(context.title || '');
  const issue = Number(context.issue);
  const scope = context.scope || {};
  const governance = branch === lock.governanceBranch;

  assert(lock.allowedBranchPrefixes.some((prefix) => branch.startsWith(prefix)), `branch is outside PC-CROP prefixes: ${branch}`, local);

  const branchAndTitle = `${branch}\n${title}`.toLowerCase();
  for (const token of lock.forbiddenProgramTokens) {
    assert(!branchAndTitle.includes(String(token).toLowerCase()), `forbidden program token in branch/title: ${token}`, local);
  }

  if (governance) {
    assert(issue === lock.governanceIssue, 'governance branch issue mismatch', local);
    assert(scope.issue === lock.governanceIssue, 'governance scope issue mismatch', local);
  } else {
    assert(issue === lock.activeIssue, `only active issue #${lock.activeIssue} is allowed`, local);
    assert(title.startsWith(lock.activeSlice), `title must start with ${lock.activeSlice}`, local);
    assert(scope.issue === lock.activeIssue, 'scope issue does not match active issue', local);
    assert(scope.activeSlice === lock.activeSlice, 'scope active slice mismatch', local);
  }

  assert(scope.projectLockId === lock.id, 'scope is not bound to active project lock', local);
  assert(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope production authority mismatch', local);
  assert(scope.operationalStatus === 'NOT_ATTESTED', 'scope operational status mismatch', local);
  assert(Array.isArray(scope.allowedPaths) && scope.allowedPaths.length > 0, 'scope allowed paths missing', local);
  assert(!scope.allowedPaths?.some((path) => path === '**' || path === 'apps/**'), 'unsafe wildcard scope is forbidden', local);

  return local;
}

const lock = readJson(LOCK_PATH);
validateLock(lock);

if (process.argv.includes('--self-test')) {
  const accepted = validateContext(lock, {
    branch: 'agent/pc-crop-10b-truth-sync-3390',
    title: 'PC-CROP-10B: synchronize government-system truth',
    issue: 3390,
    scope: {
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3390,
      activeSlice: 'PC-CROP-10B',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['scripts/pc-crop-10b/verify.mjs'],
    },
  });
  assert(accepted.length === 0, `valid PC-CROP-10B scope rejected: ${accepted.join('; ')}`);

  const drift = validateContext(lock, {
    branch: 'ops/qwen-model-host-repair',
    title: 'Repair Qwen activation',
    issue: 3372,
    scope: {
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3372,
      activeSlice: 'PC-CROP-10B',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['.github/workflows/qwen.yml'],
    },
  });
  assert(drift.some((message) => message.includes('outside PC-CROP') || message.includes('forbidden program token')), 'TAI/Qwen drift was not rejected');

  const wrongIssue = validateContext(lock, {
    branch: 'agent/pc-crop-11-lab',
    title: 'PC-CROP-11: laboratory work',
    issue: 3400,
    scope: {
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3400,
      activeSlice: 'PC-CROP-11',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['scripts/pc-crop-11/verify.mjs'],
    },
  });
  assert(wrongIssue.some((message) => message.includes('only active issue')), 'out-of-sequence PC-CROP issue was not rejected');

  const report = {
    schemaVersion: 'pc-crop.project-lock-acceptance.v1',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    lockId: lock.id,
    governanceIssue: lock.governanceIssue,
    activeIssue: lock.activeIssue,
    activeSlice: lock.activeSlice,
    productionHosting: lock.productionHosting,
    operationalStatus: lock.operationalStatus,
    failures,
  };
  fs.mkdirSync('artifacts/pc-crop-project-lock', { recursive: true });
  fs.writeFileSync('artifacts/pc-crop-project-lock/acceptance.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
}

const scopePath = process.env.PC_CROP_SCOPE_PATH;
assert(Boolean(scopePath), 'PC_CROP_SCOPE_PATH is required');
let scope = {};
if (scopePath) scope = readJson(scopePath);

const runtimeFailures = validateContext(lock, {
  branch: process.env.PC_CROP_BRANCH,
  title: process.env.PC_CROP_TITLE,
  issue: process.env.PC_CROP_ISSUE,
  scope,
});
failures.push(...runtimeFailures);

const report = {
  schemaVersion: 'pc-crop.project-lock-acceptance.v1',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  lockId: lock.id,
  branch: process.env.PC_CROP_BRANCH,
  issue: Number(process.env.PC_CROP_ISSUE),
  activeIssue: lock.activeIssue,
  activeSlice: lock.activeSlice,
  scopePath,
  productionHosting: lock.productionHosting,
  operationalStatus: lock.operationalStatus,
  failures,
};
fs.mkdirSync('artifacts/pc-crop-project-lock', { recursive: true });
fs.writeFileSync('artifacts/pc-crop-project-lock/acceptance.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
