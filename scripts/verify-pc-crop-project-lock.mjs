#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const LOCK_PATH = 'docs/platform-v7/autopilot/project-locks/pc-crop-remainder.json';
const EVIDENCE_DIR = 'artifacts/pc-crop-project-lock';
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

function writeReport(report) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(`${EVIDENCE_DIR}/acceptance.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitSucceeds(...args) {
  try {
    execFileSync('git', args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function validateOwnerAuthorizedExceptions(lock, target = failures) {
  const exceptions = lock.ownerAuthorizedExceptions;
  assert(Array.isArray(exceptions) && exceptions.length === 1, 'owner-authorized exception set must contain exactly one entry', target);
  if (!Array.isArray(exceptions) || exceptions.length !== 1) return;

  const exception = exceptions[0];
  assert(exception.id === 'PRODUCTION_AI_RECOVERY_3372', 'owner-authorized exception id mismatch', target);
  assert(exception.status === 'expired', 'closed owner-authorized exception must be expired', target);
  assert(exception.issue === 3372, 'owner-authorized exception issue mismatch', target);
  assert(exception.governanceCommentId === 5120686584, 'owner authorization evidence mismatch', target);
  assert(exception.expiresWhenIssueClosed === true, 'owner-authorized exception expiry contract mismatch', target);
  assert(
    JSON.stringify(exception.branchPrefixes) === JSON.stringify([
      'agent/qwen-recovery-',
      'fix/qwen-recovery-',
      'ops/qwen-recovery-',
    ]),
    'owner-authorized exception branch prefixes mismatch',
    target,
  );
  assert(exception.titlePrefix === 'QWEN-RECOVERY:', 'owner-authorized exception title prefix mismatch', target);
  assert(
    Array.isArray(exception.allowedProgramTokens)
      && exception.allowedProgramTokens.includes('qwen')
      && !exception.allowedProgramTokens.includes('model-admission'),
    'owner-authorized exception token allowance is unsafe',
    target,
  );
  assert(
    Array.isArray(exception.allowedPathPrefixes) && exception.allowedPathPrefixes.length === 3,
    'owner-authorized exception path prefixes incomplete',
    target,
  );
  assert(
    Array.isArray(exception.forbiddenPathPrefixes)
      && exception.forbiddenPathPrefixes.includes('docs/platform-v7/crop-platform/'),
    'owner-authorized exception PC-CROP path protection incomplete',
    target,
  );
  assert(
    exception.allowedPurpose === 'restore-accepted-restricted-qwen-contour-only',
    'owner-authorized exception purpose mismatch',
    target,
  );
  assert(exception.productionHosting === 'REG_RU_VPS_ONLY', 'owner-authorized exception hosting mismatch', target);
  assert(exception.operationalStatus === 'NOT_ATTESTED', 'owner-authorized exception status mismatch', target);
}

function validateLock(lock, target = failures) {
  assert(lock.schemaVersion === 'platform-v7.active-project-lock.v1', 'lock schema mismatch', target);
  assert(lock.id === 'PC-CROP-REMAINDER', 'lock id mismatch', target);
  assert(lock.status === 'completed', 'project lock is not completed', target);
  assert(lock.governanceIssue === 3389, 'governance issue mismatch', target);
  assert(lock.activeIssue === null, 'completed project lock must not retain an active issue', target);
  assert(lock.activeSlice === null, 'completed project lock must not retain an active slice', target);
  assert(
    JSON.stringify(lock.sequence) === JSON.stringify([]),
    'completed PC-CROP sequence must be empty',
    target,
  );
  const completion = lock.completion || {};
  assert(completion.slice === 'PC-CROP-10D', 'completion slice mismatch', target);
  assert(completion.issue === 3504, 'completion issue mismatch', target);
  assert(completion.pr === 3506, 'completion PR mismatch', target);
  assert(
    completion.mergeSha === '2a2a58778d194d4abc37c4dde429993dc8546d1f',
    'completion merge SHA mismatch',
    target,
  );
  assert(completion.exactMainStatusContext === 'PC-CROP-10D exact-main', 'completion exact-main context mismatch', target);
  assert(completion.completedAt === '2026-07-30T19:53:53Z', 'completion timestamp mismatch', target);
  assert(
    completion.finalTruthPath === 'docs/platform-v7/crop-platform/agricultural-government-systems.final-truth.v1.json'
      && completion.finalTruthBlobSha === '20650c296b75c6a3a248e40ce67f78a7f023496f',
    'final-truth completion binding mismatch',
    target,
  );
  assert(
    completion.readinessPath === 'docs/platform-v7/crop-platform/agricultural-government-systems.readiness.v2.json'
      && completion.readinessBlobSha === 'f175a5583771275562ceaa2a5af09f7f9c86c867',
    'readiness completion binding mismatch',
    target,
  );
  assert(completion.internalRepositoryRemainderComplete === true, 'internal repository completion missing', target);
  assert(completion.industrialLiveReady === false, 'industrial live readiness was elevated', target);
  assert(completion.implementationAuthorized === false, 'external implementation was authorized', target);
  assert(
    gitSucceeds('merge-base', '--is-ancestor', completion.mergeSha, 'HEAD'),
    'completion merge is outside exact-head ancestry',
    target,
  );
  for (const [path, blobSha] of [
    [completion.finalTruthPath, completion.finalTruthBlobSha],
    [completion.readinessPath, completion.readinessBlobSha],
  ]) {
    if (!path || !blobSha) continue;
    assert(gitSucceeds('cat-file', '-e', `${completion.mergeSha}:${path}`), `completion path missing at merge: ${path}`, target);
    if (gitSucceeds('cat-file', '-e', `${completion.mergeSha}:${path}`)) {
      assert(git('rev-parse', `${completion.mergeSha}:${path}`) === blobSha, `completion merge blob drift: ${path}`, target);
    }
    assert(gitSucceeds('cat-file', '-e', `HEAD:${path}`), `completion path missing at exact head: ${path}`, target);
    if (gitSucceeds('cat-file', '-e', `HEAD:${path}`)) {
      assert(git('rev-parse', `HEAD:${path}`) === blobSha, `completion exact-head blob drift: ${path}`, target);
    }
  }
  assert(lock.governanceBranch === 'governance/pc-crop-project-lock-3389', 'governance branch mismatch', target);
  assert(lock.productionHosting === 'REG_RU_VPS_ONLY', 'production authority is not REG_RU_VPS_ONLY', target);
  assert(lock.operationalStatus === 'NOT_ATTESTED', 'operational status must remain NOT_ATTESTED', target);
  assert(
    JSON.stringify(lock.allowedBranchPrefixes) === JSON.stringify([
      'agent/pc-crop-',
      'fix/pc-crop-',
      'governance/pc-crop-',
      'ops/pc-crop-',
    ]),
    'branch prefixes incomplete',
    target,
  );
  assert(Array.isArray(lock.forbiddenProgramTokens) && lock.forbiddenProgramTokens.includes('qwen'), 'forbidden program tokens incomplete', target);
  assert(lock.rules?.exactIssueRequired === true, 'exact issue requirement disabled', target);
  assert(lock.rules?.sourceControlledScopeRequired === true, 'scope requirement disabled', target);
  assert(lock.rules?.projectLockBindingRequired === true, 'project lock binding disabled', target);
  assert(lock.rules?.runtimeChange === false, 'governance lock cannot authorize runtime changes', target);
  assert(lock.rules?.authorizationChange === false, 'governance lock cannot authorize authorization changes', target);
  assert(lock.rules?.tenantBoundaryChange === false, 'governance lock cannot authorize tenant-boundary changes', target);
  assert(lock.rules?.productionTopologyChange === false, 'governance lock cannot authorize topology changes', target);
  validateOwnerAuthorizedExceptions(lock, target);
}

function getOwnerAuthorizedException(lock, scope) {
  const requestedId = String(scope?.ownerAuthorizedExceptionId || '');
  if (!requestedId) return null;
  return lock.ownerAuthorizedExceptions?.find(
    (entry) => entry.id === requestedId && entry.status === 'active',
  ) || null;
}

function validateCommonScope(lock, scope, target) {
  assert(scope.projectLockId === lock.id, 'scope is not bound to project lock', target);
  assert(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope production authority mismatch', target);
  assert(scope.operationalStatus === 'NOT_ATTESTED', 'scope operational status mismatch', target);
  assert(Array.isArray(scope.allowedPaths) && scope.allowedPaths.length > 0, 'scope allowed paths missing', target);
  assert(
    !scope.allowedPaths?.some((path) => path === '**' || path === 'apps/**' || String(path).includes('**')),
    'unsafe wildcard scope is forbidden',
    target,
  );
}

function validateContext(lock, context) {
  const local = [];
  const branch = String(context.branch || '');
  const title = String(context.title || '');
  const issue = Number(context.issue);
  const scope = context.scope || {};
  const governance = branch === lock.governanceBranch;
  const requestedExceptionId = String(scope.ownerAuthorizedExceptionId || '');
  const ownerException = getOwnerAuthorizedException(lock, scope);
  const exceptionContext = Boolean(ownerException);

  if (requestedExceptionId && !ownerException) {
    local.push(`unknown or inactive owner-authorized exception: ${requestedExceptionId}`);
  }

  const branchAndTitle = `${branch}\n${title}`.toLowerCase();
  const allowedExceptionTokens = new Set(ownerException?.allowedProgramTokens || []);
  for (const token of lock.forbiddenProgramTokens) {
    const normalized = String(token).toLowerCase();
    if (exceptionContext && allowedExceptionTokens.has(token)) continue;
    assert(!branchAndTitle.includes(normalized), `forbidden program token in branch/title: ${token}`, local);
  }

  if (governance) {
    assert(lock.allowedBranchPrefixes.some((prefix) => branch.startsWith(prefix)), `branch is outside PC-CROP prefixes: ${branch}`, local);
    assert(issue === lock.governanceIssue, 'governance branch issue mismatch', local);
    assert(scope.issue === lock.governanceIssue, 'governance scope issue mismatch', local);
    assert(scope.activeSlice === lock.activeSlice, 'governance scope active slice mismatch', local);
    assert(scope.status === 'active', 'governance maintenance scope must remain active', local);
  } else if (lock.status === 'completed') {
    local.push('PC-CROP project lock is completed; only the governance branch is allowed');
  } else if (exceptionContext) {
    assert(
      ownerException.branchPrefixes.some((prefix) => branch.startsWith(prefix)),
      `branch is outside owner-authorized exception prefixes: ${branch}`,
      local,
    );
    assert(issue === ownerException.issue, `only exception issue #${ownerException.issue} is allowed`, local);
    assert(title.startsWith(ownerException.titlePrefix), `exception title must start with ${ownerException.titlePrefix}`, local);
    assert(scope.issue === ownerException.issue, 'exception scope issue mismatch', local);
    assert(scope.activeSlice === lock.activeSlice, 'exception scope must preserve active PC-CROP slice', local);
    assert(scope.ownerAuthorizedExceptionCommentId === ownerException.governanceCommentId, 'exception owner authorization evidence mismatch', local);
    assert(scope.exceptionExpiresWhenIssueClosed === ownerException.expiresWhenIssueClosed, 'exception expiry contract mismatch', local);
    assert(scope.exceptionPurpose === ownerException.allowedPurpose, 'exception purpose mismatch', local);
    assert(
      Array.isArray(scope.allowedPaths)
        && scope.allowedPaths.every((path) => ownerException.allowedPathPrefixes.some((prefix) => String(path).startsWith(prefix))),
      'exception scope contains a path outside the narrow recovery prefixes',
      local,
    );
    assert(
      !scope.allowedPaths?.some((path) => ownerException.forbiddenPathPrefixes.some((prefix) => String(path).startsWith(prefix))),
      'exception scope overlaps protected PC-CROP paths',
      local,
    );
  } else {
    assert(lock.allowedBranchPrefixes.some((prefix) => branch.startsWith(prefix)), `branch is outside PC-CROP prefixes: ${branch}`, local);
    assert(issue === lock.activeIssue, `only active issue #${lock.activeIssue} is allowed`, local);
    assert(title.startsWith(lock.activeSlice), `title must start with ${lock.activeSlice}`, local);
    assert(scope.issue === lock.activeIssue, 'scope issue does not match active issue', local);
    assert(scope.activeSlice === lock.activeSlice, 'scope active slice mismatch', local);
  }

  validateCommonScope(lock, scope, local);
  return local;
}

const lock = readJson(LOCK_PATH);
validateLock(lock);

if (process.argv.includes('--self-test')) {
  const completedTerminalSlice = validateContext(lock, {
    branch: 'agent/pc-crop-10d-final-truth',
    title: 'PC-CROP-10D: final internal repository truth and closure',
    issue: 3504,
    scope: {
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3504,
      activeSlice: 'PC-CROP-10D',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['scripts/pc-crop-10d/verify.mjs'],
    },
  });
  assert(
    completedTerminalSlice.some((message) => message.includes('project lock is completed')),
    'completed PC-CROP-10D slice was not rejected',
  );

  const governance = validateContext(lock, {
    branch: 'governance/pc-crop-project-lock-3389',
    title: 'PC-CROP governance: complete project lock',
    issue: 3389,
    scope: {
      status: 'active',
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3389,
      activeSlice: null,
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: [LOCK_PATH],
    },
  });
  assert(governance.length === 0, `valid governance transition rejected: ${governance.join('; ')}`);

  const expiredRecovery = validateContext(lock, {
    branch: 'ops/qwen-recovery-unprivileged-probe-3372',
    title: 'QWEN-RECOVERY: expired recovery probe',
    issue: 3372,
    scope: {
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3372,
      activeSlice: null,
      ownerAuthorizedExceptionId: 'PRODUCTION_AI_RECOVERY_3372',
      ownerAuthorizedExceptionCommentId: 5120686584,
      exceptionExpiresWhenIssueClosed: true,
      exceptionPurpose: 'restore-accepted-restricted-qwen-contour-only',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['.github/workflows/tai-qwen-unprivileged-probe.yml'],
    },
  });
  assert(
    expiredRecovery.some((message) => message.includes('unknown or inactive owner-authorized exception')),
    'expired owner-authorized recovery exception was not rejected',
  );

  const completedPreviousSlice = validateContext(lock, {
    branch: 'agent/pc-crop-10c-tenant-authorized-read-adapter',
    title: 'PC-CROP-10C: completed previous slice',
    issue: 3446,
    scope: {
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3446,
      activeSlice: 'PC-CROP-10C',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['scripts/pc-crop-10c/verify.mjs'],
    },
  });
  assert(
    completedPreviousSlice.some((message) => message.includes('project lock is completed')),
    'completed PC-CROP-10C slice was not rejected',
  );

  const drift = validateContext(lock, {
    branch: 'ops/qwen-model-host-repair',
    title: 'Repair Qwen activation',
    issue: 3372,
    scope: {
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3372,
      activeSlice: null,
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['.github/workflows/qwen.yml'],
    },
  });
  assert(drift.some((message) => message.includes('outside PC-CROP') || message.includes('forbidden program token')), 'unrelated TAI/Qwen drift was not rejected');

  const wildcard = validateContext(lock, {
    branch: 'agent/pc-crop-10d-unsafe',
    title: 'PC-CROP-10D: unsafe wildcard',
    issue: 3504,
    scope: {
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3504,
      activeSlice: 'PC-CROP-10D',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['apps/**'],
    },
  });
  assert(wildcard.some((message) => message.includes('unsafe wildcard')), 'unsafe wildcard scope was not rejected');

  const report = {
    schemaVersion: 'pc-crop.project-lock-acceptance.v1',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    lockId: lock.id,
    governanceIssue: lock.governanceIssue,
    activeIssue: lock.activeIssue,
    activeSlice: lock.activeSlice,
    completionMergeSha: lock.completion?.mergeSha || null,
    internalRepositoryRemainderComplete:
      lock.completion?.internalRepositoryRemainderComplete === true,
    industrialLiveReady: lock.completion?.industrialLiveReady === true,
    ownerAuthorizedExceptionId: lock.ownerAuthorizedExceptions?.[0]?.id || null,
    productionHosting: lock.productionHosting,
    operationalStatus: lock.operationalStatus,
    failures,
  };
  writeReport(report);
  process.exit(failures.length === 0 ? 0 : 1);
}

const scopePath = process.env.PC_CROP_SCOPE_PATH;
assert(Boolean(scopePath), 'PC_CROP_SCOPE_PATH is required');
let scope = {};
if (scopePath) scope = readJson(scopePath);

failures.push(...validateContext(lock, {
  branch: process.env.PC_CROP_BRANCH,
  title: process.env.PC_CROP_TITLE,
  issue: process.env.PC_CROP_ISSUE,
  scope,
}));

const report = {
  schemaVersion: 'pc-crop.project-lock-acceptance.v1',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  lockId: lock.id,
  branch: process.env.PC_CROP_BRANCH,
  issue: Number(process.env.PC_CROP_ISSUE),
  activeIssue: lock.activeIssue,
  activeSlice: lock.activeSlice,
  completionMergeSha: lock.completion?.mergeSha || null,
  internalRepositoryRemainderComplete:
    lock.completion?.internalRepositoryRemainderComplete === true,
  industrialLiveReady: lock.completion?.industrialLiveReady === true,
  ownerAuthorizedExceptionId: scope.ownerAuthorizedExceptionId || null,
  scopePath,
  productionHosting: lock.productionHosting,
  operationalStatus: lock.operationalStatus,
  failures,
};
writeReport(report);
if (failures.length > 0) process.exit(1);
