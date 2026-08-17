#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Which project authority a pull request is working under, and whether it is
 * allowed to.
 *
 * The old shape asked one question — does this branch name start with a
 * PC-CROP prefix — and then judged everything against a single lock. That made
 * the branch name the authority, which is the weakest possible one: renaming a
 * branch left the work unsupervised, and a second programme could not exist at
 * all without reopening the first one's completion.
 *
 * The order is now the other way round. Resolve the branch's source-controlled
 * scope, read the projectLockId it declares, load that lock, and judge against
 * it. A pull request with no lock-bound scope is not a violation — it is simply
 * not this gate's business, and it says NOT_APPLICABLE rather than inventing a
 * verdict.
 *
 * The escape a rename used to offer is closed from the other side: each active
 * lock declares the paths that belong to its programme, and a scope that lists
 * one of those paths without binding to that lock is refused. So is a pull
 * request that changes them with no bound scope at all. The name of the branch
 * decides nothing either way.
 */

const LOCKS_DIRECTORY = 'docs/platform-v7/autopilot/project-locks';
const SCOPES_DIRECTORY = 'docs/platform-v7/autopilot/scopes';
const LOCK_PATH = `${LOCKS_DIRECTORY}/pc-crop-remainder.json`;
const FEDERAL_ACCOUNTING_LOCK_PATH = `${LOCKS_DIRECTORY}/pc-crop-federal-accounting.json`;
const EVIDENCE_DIR = 'artifacts/pc-crop-project-lock';

/** What the governance branch is allowed to touch: the lock machine, nothing else. */
const GOVERNANCE_MACHINE_PREFIXES = [
  '.github/workflows/pc-crop-project-lock.yml',
  '.github/workflows/production-docker-headroom-recovery.yml',
  'docs/platform-v7/autopilot/project-locks/',
  'docs/platform-v7/autopilot/scopes/pc-crop-project-lock-3389.json',
  'docs/platform-v7/autopilot/scopes/pc-crop-hosted-docker-headroom-recovery-3785.json',
  'scripts/verify-pc-crop-project-lock.mjs',
  'scripts/production-docker-headroom-recovery.sh',
];

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

function normalizePath(value) {
  return String(value ?? '').trim().replace(/\\/g, '/');
}

/** A scope path is under an owned prefix, treating a bare filename as exact. */
function pathIsUnderPrefix(candidate, prefix) {
  const file = normalizePath(candidate);
  const owned = normalizePath(prefix);
  if (!file || !owned) return false;
  if (owned.endsWith('/')) return file === owned.slice(0, -1) || file.startsWith(owned);
  return file === owned || file.startsWith(`${owned}/`);
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

/**
 * The new programme's lock.
 *
 * It deliberately has no allowedBranchPrefixes. Binding is by scope, and a lock
 * that also judged the branch name would quietly reintroduce the thing this
 * rewrite exists to remove.
 */
function validateFederalAccountingLock(lock, target = failures) {
  assert(lock.schemaVersion === 'platform-v7.active-project-lock.v2', 'federal accounting lock schema mismatch', target);
  assert(lock.id === 'PC-CROP-FEDERAL-ACCOUNTING', 'federal accounting lock id mismatch', target);
  assert(lock.status === 'active', 'federal accounting lock must be active', target);
  assert(lock.governanceBranch === 'governance/pc-crop-project-lock-3389', 'federal accounting governance branch mismatch', target);
  assert(lock.governanceIssue === 3389, 'federal accounting governance issue mismatch', target);
  assert(Number.isInteger(lock.activeIssue), 'federal accounting lock needs an exact active issue', target);
  assert(lock.productionHosting === 'REG_RU_VPS_ONLY', 'federal accounting production authority is not REG_RU_VPS_ONLY', target);
  assert(lock.operationalStatus === 'NOT_ATTESTED', 'federal accounting operational status must remain NOT_ATTESTED', target);
  assert(lock.branchAuthority === 'SOURCE_CONTROLLED_SCOPE', 'federal accounting authority must not come from branch names', target);
  assert(lock.allowedBranchPrefixes === undefined, 'federal accounting lock must not judge branch names', target);
  assert(
    Array.isArray(lock.ownedPathPrefixes) && lock.ownedPathPrefixes.length > 0,
    'federal accounting lock must own its programme paths',
    target,
  );
  assert(
    !lock.ownedPathPrefixes?.some((prefix) => String(prefix).includes('*')),
    'federal accounting owned paths must be exact, never wildcards',
    target,
  );
  assert(lock.rules?.exactIssueRequired === true, 'federal accounting exact issue requirement disabled', target);
  assert(lock.rules?.sourceControlledScopeRequired === true, 'federal accounting scope requirement disabled', target);
  assert(lock.rules?.projectLockBindingRequired === true, 'federal accounting project lock binding disabled', target);
  assert(lock.rules?.unsafeWildcardScopeForbidden === true, 'federal accounting wildcard prohibition disabled', target);
  assert(lock.rules?.noAutoMerge === true, 'federal accounting noAutoMerge disabled', target);
  assert(lock.rules?.noDirectPushToMain === true, 'federal accounting noDirectPushToMain disabled', target);
  assert(lock.rules?.noSelfModifyingWorkflow === true, 'federal accounting noSelfModifyingWorkflow disabled', target);
  assert(lock.rules?.mergeIsNotProductionAcceptance === true, 'merge must never count as production acceptance', target);
}

function getOwnerAuthorizedException(lock, scope) {
  const requestedId = String(scope?.ownerAuthorizedExceptionId || '');
  if (!requestedId) return null;
  return lock.ownerAuthorizedExceptions?.find(
    (entry) => entry.id === requestedId && entry.status === 'active',
  ) || null;
}

/**
 * A source root granted whole is the same grant as `**`, spelled differently.
 *
 * Banning the wildcard alone leaves the hole open: the guard that consumes
 * these scopes treats a bare directory as everything beneath it, so `apps/**`
 * and `apps` are one permission wearing two spellings. Found by writing the
 * test rather than by reading the rule.
 */
const UNSAFE_SCOPE_ROOTS = new Set([
  '', '.', '/', '*', '**',
  'apps', 'packages', 'scripts', 'docs', 'src', 'lib', 'test', 'tests',
  '.github', 'apps/api', 'apps/web', 'apps/api/src', 'apps/web/app',
]);

function validateCommonScope(lock, scope, target) {
  assert(scope.projectLockId === lock.id, 'scope is not bound to project lock', target);
  assert(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope production authority mismatch', target);
  assert(scope.operationalStatus === 'NOT_ATTESTED', 'scope operational status mismatch', target);
  assert(Array.isArray(scope.allowedPaths) && scope.allowedPaths.length > 0, 'scope allowed paths missing', target);
  assert(
    !scope.allowedPaths?.some((path) => String(path).includes('*')),
    'unsafe wildcard scope is forbidden',
    target,
  );
  for (const candidate of scope.allowedPaths || []) {
    const normalized = normalizePath(candidate).replace(/\/+$/, '');
    assert(
      !UNSAFE_SCOPE_ROOTS.has(normalized),
      `scope grants a whole source root, which is a wildcard by another name: ${candidate}`,
      target,
    );
  }
}

/**
 * A programme's paths belong to its programme.
 *
 * Without this, the branch-name escape simply moves house: rename the branch,
 * write a scope that names no lock, and the work walks out from under its
 * authority carrying the same files. Ownership is checked against every active
 * lock, so it does not matter which scope or which name is used to try.
 */
function validatePathOwnership(locks, boundLockId, paths, target, label) {
  for (const lock of locks) {
    if (lock.status !== 'active') continue;
    if (!Array.isArray(lock.ownedPathPrefixes)) continue;
    if (boundLockId === lock.id) continue;
    for (const candidate of paths || []) {
      const owned = lock.ownedPathPrefixes.find((prefix) => pathIsUnderPrefix(candidate, prefix));
      if (owned !== undefined) {
        target.push(`${label} claims a path owned by ${lock.id}: ${candidate}`);
      }
    }
  }
}

function validateGovernanceMachineScope(scope, target) {
  for (const candidate of scope.allowedPaths || []) {
    const allowed = GOVERNANCE_MACHINE_PREFIXES.some((prefix) => pathIsUnderPrefix(candidate, prefix));
    assert(allowed, `governance scope may only carry the lock machine: ${candidate}`, target);
  }
}

/** The completed PC-CROP-REMAINDER contract, unchanged in substance. */
function validateLegacyContext(lock, context, local) {
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
    validateGovernanceMachineScope(scope, local);
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
}

/** The new programme's contract. Branch names are evidence of nothing here. */
function validateFederalAccountingContext(lock, context, local) {
  const branch = String(context.branch || '');
  const issue = Number(context.issue);
  const scope = context.scope || {};

  assert(lock.status === 'active', `${lock.id} is not active`, local);
  assert(scope.status === 'active', 'federal accounting scope must be active', local);
  assert(String(scope.branch || '') === branch, 'scope branch does not match the pull request branch', local);
  assert(issue === lock.activeIssue, `only active issue #${lock.activeIssue} is allowed`, local);
  assert(scope.issue === lock.activeIssue, 'scope issue does not match the federal accounting active issue', local);
  validateCommonScope(lock, scope, local);
}

/**
 * Resolve the branch's source-controlled scope.
 *
 * Missing is not the same as ambiguous. A branch with no active scope may
 * simply be unrelated work; a branch with two is a genuine authority conflict
 * and there is no safe way to pick one.
 */
function resolveScope(branch, directory = SCOPES_DIRECTORY) {
  const resolved = path.resolve(directory);
  if (!fs.existsSync(resolved)) return { matches: [], scope: null, scopePath: null };
  const matches = fs.readdirSync(resolved, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .filter((filename) => {
      let value;
      try {
        value = JSON.parse(fs.readFileSync(path.join(resolved, filename), 'utf8'));
      } catch {
        return false;
      }
      return value.branch === branch && value.status === 'active';
    });
  if (matches.length !== 1) return { matches, scope: null, scopePath: null };
  const scopePath = `${directory}/${matches[0]}`;
  return { matches, scope: readJson(scopePath), scopePath };
}

/**
 * The verdict for one pull request.
 *
 * NOT_APPLICABLE is a real answer, not a shrug: it means no active lock claims
 * this work, and saying PASS or FAIL instead would be a claim the gate cannot
 * support. It is only reachable once path ownership has been checked, so it
 * cannot be obtained by walking away from a lock.
 */
function evaluate(locks, context) {
  const local = [];
  const branch = String(context.branch || '');
  const changedFiles = context.changedFiles || null;

  if (context.scopeMatches !== undefined && context.scopeMatches.length > 1) {
    local.push(`expected exactly one active scope for ${branch}; found ${context.scopeMatches.length}`);
    return { status: 'FAIL', failures: local, lockId: null, applicability: 'AMBIGUOUS_SCOPE' };
  }

  const scope = context.scope;

  if (!scope) {
    // No scope at all. The only question left is whether the pull request is
    // walking off with a lock's files, which the changed-file list answers when
    // the caller has one.
    if (changedFiles) {
      validatePathOwnership(locks, null, changedFiles, local, 'pull request without a bound scope');
    }
    if (local.length > 0) return { status: 'FAIL', failures: local, lockId: null, applicability: 'UNBOUND_LOCK_OWNED_PATHS' };
    return { status: 'PASS', failures: local, lockId: null, applicability: 'NOT_APPLICABLE' };
  }

  const boundLockId = String(scope.projectLockId || '');

  if (!boundLockId) {
    validatePathOwnership(locks, null, scope.allowedPaths, local, 'scope without a project lock');
    if (changedFiles) {
      validatePathOwnership(locks, null, changedFiles, local, 'pull request without a bound scope');
    }
    if (local.length > 0) return { status: 'FAIL', failures: local, lockId: null, applicability: 'UNBOUND_LOCK_OWNED_PATHS' };
    return { status: 'PASS', failures: local, lockId: null, applicability: 'NOT_APPLICABLE' };
  }

  const lock = locks.find((entry) => entry.id === boundLockId);
  if (!lock) {
    local.push(`unknown projectLockId: ${boundLockId}`);
    return { status: 'FAIL', failures: local, lockId: boundLockId, applicability: 'UNKNOWN_PROJECT_LOCK' };
  }

  validatePathOwnership(locks, boundLockId, scope.allowedPaths, local, `scope bound to ${boundLockId}`);
  if (changedFiles) {
    validatePathOwnership(locks, boundLockId, changedFiles, local, `pull request bound to ${boundLockId}`);
  }

  if (lock.id === 'PC-CROP-FEDERAL-ACCOUNTING') {
    validateFederalAccountingContext(lock, context, local);
  } else {
    validateLegacyContext(lock, context, local);
  }

  return {
    status: local.length === 0 ? 'PASS' : 'FAIL',
    failures: local,
    lockId: lock.id,
    applicability: 'ENFORCED',
  };
}

const lock = readJson(LOCK_PATH);
const federalAccountingLock = readJson(FEDERAL_ACCOUNTING_LOCK_PATH);
const locks = [lock, federalAccountingLock];

validateLock(lock);
validateFederalAccountingLock(federalAccountingLock);

// Two active locks must not claim the same ground, or a pull request could be
// legitimately bound to one and simultaneously in breach of the other.
for (const owned of federalAccountingLock.ownedPathPrefixes || []) {
  assert(
    !(lock.ownedPathPrefixes || []).some((prefix) => pathIsUnderPrefix(owned, prefix)),
    `overlapping owned path between project locks: ${owned}`,
  );
}

if (process.argv.includes('--self-test')) {
  // Pinned, not read back from the lock. A test that derives the expected issue
  // from the file it is testing agrees with any value that file happens to
  // hold, which is how sabotage of `activeIssue` slipped past the first draft
  // of this suite.
  const FEDERAL_ACCOUNTING_ISSUE = 4321;
  assert(
    federalAccountingLock.activeIssue === FEDERAL_ACCOUNTING_ISSUE,
    `federal accounting active issue drifted: expected ${FEDERAL_ACCOUNTING_ISSUE}, found ${federalAccountingLock.activeIssue}`,
  );

  const federalScope = (overrides = {}) => ({
    status: 'active',
    branch: 'claude/autonomous-execution-contract-oc7ds7',
    projectLockId: 'PC-CROP-FEDERAL-ACCOUNTING',
    issue: FEDERAL_ACCOUNTING_ISSUE,
    productionHosting: 'REG_RU_VPS_ONLY',
    operationalStatus: 'NOT_ATTESTED',
    allowedPaths: ['apps/web/app/platform-v7/accounting/page.tsx'],
    ...overrides,
  });

  // 1. The completed lock still refuses a new implementation pull request.
  const completedTerminalSlice = evaluate(locks, {
    branch: 'agent/pc-crop-10d-final-truth',
    title: 'PC-CROP-10D: final internal repository truth and closure',
    issue: 3504,
    scope: {
      status: 'active',
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3504,
      activeSlice: 'PC-CROP-10D',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['scripts/pc-crop-10d/verify.mjs'],
    },
  });
  assert(
    completedTerminalSlice.failures.some((message) => message.includes('project lock is completed')),
    'completed PC-CROP-10D slice was not rejected',
  );

  // 2. Its completion evidence is unchanged — validateLock above proves the
  //    merge SHA, both blob SHAs and the exact-head ancestry.
  assert(lock.status === 'completed', 'PC-CROP-REMAINDER completion was reopened');
  assert(
    lock.completion?.mergeSha === '2a2a58778d194d4abc37c4dde429993dc8546d1f',
    'PC-CROP-REMAINDER completion merge SHA drifted',
  );
  assert(
    lock.completion?.internalRepositoryRemainderComplete === true
      && lock.completion?.industrialLiveReady === false
      && lock.completion?.implementationAuthorized === false,
    'PC-CROP-REMAINDER completion semantics drifted',
  );

  // 3. The new lock accepts its own active programme.
  const federalAccepted = evaluate(locks, {
    branch: 'claude/autonomous-execution-contract-oc7ds7',
    title: 'feat(web): task-first accounting surface',
    issue: FEDERAL_ACCOUNTING_ISSUE,
    scope: federalScope(),
  });
  assert(
    federalAccepted.status === 'PASS' && federalAccepted.applicability === 'ENFORCED',
    `valid federal accounting context rejected: ${federalAccepted.failures.join('; ')}`,
  );

  // 4. An accounting scope naming the wrong lock fails.
  const wrongLockId = evaluate(locks, {
    branch: 'claude/autonomous-execution-contract-oc7ds7',
    title: 'feat(web): task-first accounting surface',
    issue: FEDERAL_ACCOUNTING_ISSUE,
    scope: federalScope({ projectLockId: 'PC-CROP-REMAINDER' }),
  });
  assert(
    wrongLockId.status === 'FAIL'
      && wrongLockId.failures.some((message) => message.includes('owned by PC-CROP-FEDERAL-ACCOUNTING')),
    'accounting scope bound to the completed lock was not rejected',
  );

  // …and an id that names no lock at all fails as unknown, never as PASS.
  const unknownLockId = evaluate(locks, {
    branch: 'claude/autonomous-execution-contract-oc7ds7',
    title: 'feat(web): task-first accounting surface',
    issue: FEDERAL_ACCOUNTING_ISSUE,
    scope: federalScope({ projectLockId: 'PC-CROP-INVENTED' }),
  });
  assert(
    unknownLockId.failures.some((message) => message.includes('unknown projectLockId')),
    'unknown projectLockId was not rejected',
  );

  // 5. An accounting scope on the wrong issue fails.
  const wrongIssue = evaluate(locks, {
    branch: 'claude/autonomous-execution-contract-oc7ds7',
    title: 'feat(web): task-first accounting surface',
    issue: 3389,
    scope: federalScope({ issue: 3389 }),
  });
  assert(
    wrongIssue.status === 'FAIL' && wrongIssue.failures.some((message) => message.includes('only active issue')),
    'federal accounting scope with the wrong issue was not rejected',
  );

  // 6. Renaming the accounting branch does not switch the lock off.
  const renamed = evaluate(locks, {
    branch: 'feature/looks-unrelated',
    title: 'feat(web): task-first accounting surface',
    issue: FEDERAL_ACCOUNTING_ISSUE,
    scope: null,
    scopeMatches: [],
    changedFiles: ['apps/web/app/platform-v7/accounting/page.tsx'],
  });
  assert(
    renamed.status === 'FAIL'
      && renamed.failures.some((message) => message.includes('owned by PC-CROP-FEDERAL-ACCOUNTING')),
    'a renamed branch escaped the federal accounting lock',
  );

  // 7. A wildcard scope fails.
  const wildcard = evaluate(locks, {
    branch: 'claude/autonomous-execution-contract-oc7ds7',
    title: 'feat(web): task-first accounting surface',
    issue: FEDERAL_ACCOUNTING_ISSUE,
    scope: federalScope({ allowedPaths: ['apps/**'] }),
  });
  assert(
    wildcard.failures.some((message) => message.includes('unsafe wildcard')),
    'unsafe wildcard scope was not rejected',
  );

  // 7b. A whole source root is the same grant as a wildcard, and fails too.
  for (const root of ['apps', 'apps/web', 'scripts', '.github']) {
    const wholeRoot = evaluate(locks, {
      branch: 'claude/autonomous-execution-contract-oc7ds7',
      title: 'feat(web): task-first accounting surface',
      issue: FEDERAL_ACCOUNTING_ISSUE,
      scope: federalScope({ allowedPaths: [root] }),
    });
    assert(
      wholeRoot.failures.some((message) => message.includes('whole source root')),
      `scope granting the whole ${root} root was not rejected`,
    );
  }

  // A single wildcard character is enough to be refused, not just '**'.
  const singleStar = evaluate(locks, {
    branch: 'claude/autonomous-execution-contract-oc7ds7',
    title: 'feat(web): task-first accounting surface',
    issue: FEDERAL_ACCOUNTING_ISSUE,
    scope: federalScope({ allowedPaths: ['apps/web/app/platform-v7/*'] }),
  });
  assert(
    singleStar.failures.some((message) => message.includes('unsafe wildcard')),
    'single-star wildcard scope was not rejected',
  );

  // 8. Another workstream cannot take the accounting paths.
  const foreignWorkstream = evaluate(locks, {
    branch: 'agent/pc-crop-01b4-private-bff-live-registry',
    title: 'PC-CROP-01B.4: take the accounting surface',
    issue: 2946,
    scope: {
      status: 'active',
      branch: 'agent/pc-crop-01b4-private-bff-live-registry',
      issue: 2946,
      allowedPaths: ['apps/web/app/platform-v7/accounting/page.tsx'],
    },
  });
  assert(
    foreignWorkstream.status === 'FAIL'
      && foreignWorkstream.failures.some((message) => message.includes('owned by PC-CROP-FEDERAL-ACCOUNTING')),
    'a foreign workstream claimed accounting paths',
  );

  // 9. The governance branch may carry the lock machine and nothing else.
  const governance = evaluate(locks, {
    branch: 'governance/pc-crop-project-lock-3389',
    title: 'PC-CROP governance: separate the federal accounting authority',
    issue: 3389,
    scope: {
      status: 'active',
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3389,
      activeSlice: null,
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: [LOCK_PATH, FEDERAL_ACCOUNTING_LOCK_PATH, 'scripts/verify-pc-crop-project-lock.mjs'],
    },
  });
  assert(governance.status === 'PASS', `valid governance transition rejected: ${governance.failures.join('; ')}`);

  const governanceOverreach = evaluate(locks, {
    branch: 'governance/pc-crop-project-lock-3389',
    title: 'PC-CROP governance: reach into the product',
    issue: 3389,
    scope: {
      status: 'active',
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3389,
      activeSlice: null,
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: [LOCK_PATH, 'apps/web/lib/platform-v7/routes.ts'],
    },
  });
  assert(
    governanceOverreach.failures.some((message) => message.includes('governance scope may only carry the lock machine')),
    'governance branch was allowed outside the lock machine',
  );

  // 10. Every pre-existing negative case still holds.
  const expiredRecovery = evaluate(locks, {
    branch: 'ops/qwen-recovery-unprivileged-probe-3372',
    title: 'QWEN-RECOVERY: expired recovery probe',
    issue: 3372,
    scope: {
      status: 'active',
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
    expiredRecovery.failures.some((message) => message.includes('unknown or inactive owner-authorized exception')),
    'expired owner-authorized recovery exception was not rejected',
  );

  const completedPreviousSlice = evaluate(locks, {
    branch: 'agent/pc-crop-10c-tenant-authorized-read-adapter',
    title: 'PC-CROP-10C: completed previous slice',
    issue: 3446,
    scope: {
      status: 'active',
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3446,
      activeSlice: 'PC-CROP-10C',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['scripts/pc-crop-10c/verify.mjs'],
    },
  });
  assert(
    completedPreviousSlice.failures.some((message) => message.includes('project lock is completed')),
    'completed PC-CROP-10C slice was not rejected',
  );

  const drift = evaluate(locks, {
    branch: 'ops/qwen-model-host-repair',
    title: 'Repair Qwen activation',
    issue: 3372,
    scope: {
      status: 'active',
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3372,
      activeSlice: null,
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['.github/workflows/qwen.yml'],
    },
  });
  assert(
    drift.failures.some((message) => message.includes('outside PC-CROP') || message.includes('forbidden program token')),
    'unrelated TAI/Qwen drift was not rejected',
  );

  const legacyWildcard = evaluate(locks, {
    branch: 'agent/pc-crop-10d-unsafe',
    title: 'PC-CROP-10D: unsafe wildcard',
    issue: 3504,
    scope: {
      status: 'active',
      projectLockId: 'PC-CROP-REMAINDER',
      issue: 3504,
      activeSlice: 'PC-CROP-10D',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      allowedPaths: ['apps/**'],
    },
  });
  assert(legacyWildcard.failures.some((message) => message.includes('unsafe wildcard')), 'unsafe wildcard scope was not rejected');

  // Unrelated work is told so honestly, rather than being failed or claimed.
  const unrelated = evaluate(locks, {
    branch: 'fix/some-unrelated-typo',
    title: 'fix: a typo in the public site',
    issue: 0,
    scope: null,
    scopeMatches: [],
    changedFiles: ['apps/web/app/page.tsx'],
  });
  assert(
    unrelated.status === 'PASS' && unrelated.applicability === 'NOT_APPLICABLE',
    `unrelated pull request was not reported as NOT_APPLICABLE: ${unrelated.failures.join('; ')}`,
  );

  // Two active scopes for one branch is an authority conflict, not a choice.
  const ambiguous = evaluate(locks, {
    branch: 'claude/autonomous-execution-contract-oc7ds7',
    title: 'feat(web): task-first accounting surface',
    issue: FEDERAL_ACCOUNTING_ISSUE,
    scope: null,
    scopeMatches: ['a.json', 'b.json'],
  });
  assert(
    ambiguous.status === 'FAIL' && ambiguous.applicability === 'AMBIGUOUS_SCOPE',
    'duplicate active scopes were not rejected',
  );

  const report = {
    schemaVersion: 'pc-crop.project-lock-acceptance.v1',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    mode: 'self-test',
    lockId: lock.id,
    governanceIssue: lock.governanceIssue,
    activeIssue: lock.activeIssue,
    activeSlice: lock.activeSlice,
    completionMergeSha: lock.completion?.mergeSha || null,
    internalRepositoryRemainderComplete:
      lock.completion?.internalRepositoryRemainderComplete === true,
    industrialLiveReady: lock.completion?.industrialLiveReady === true,
    ownerAuthorizedExceptionId: lock.ownerAuthorizedExceptions?.[0]?.id || null,
    federalAccountingLockId: federalAccountingLock.id,
    federalAccountingStatus: federalAccountingLock.status,
    federalAccountingActiveIssue: federalAccountingLock.activeIssue,
    productionHosting: lock.productionHosting,
    operationalStatus: lock.operationalStatus,
    failures,
  };
  writeReport(report);
  process.exit(failures.length === 0 ? 0 : 1);
}

const branch = String(process.env.PC_CROP_BRANCH || '');
const changedFiles = String(process.env.PC_CROP_CHANGED_FILES || '')
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const resolved = resolveScope(branch);
const verdict = evaluate(locks, {
  branch,
  title: process.env.PC_CROP_TITLE,
  issue: Number(process.env.PC_CROP_ISSUE ?? resolved.scope?.issue ?? Number.NaN),
  scope: resolved.scope,
  scopeMatches: resolved.matches,
  changedFiles: changedFiles.length > 0 ? changedFiles : null,
});
failures.push(...verdict.failures);

const report = {
  schemaVersion: 'pc-crop.project-lock-acceptance.v1',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  applicability: verdict.applicability,
  boundLockId: verdict.lockId,
  branch,
  issue: Number(process.env.PC_CROP_ISSUE ?? resolved.scope?.issue ?? Number.NaN),
  scopePath: resolved.scopePath,
  lockId: lock.id,
  activeIssue: lock.activeIssue,
  activeSlice: lock.activeSlice,
  completionMergeSha: lock.completion?.mergeSha || null,
  internalRepositoryRemainderComplete:
    lock.completion?.internalRepositoryRemainderComplete === true,
  industrialLiveReady: lock.completion?.industrialLiveReady === true,
  ownerAuthorizedExceptionId: resolved.scope?.ownerAuthorizedExceptionId || null,
  federalAccountingLockId: federalAccountingLock.id,
  federalAccountingStatus: federalAccountingLock.status,
  productionHosting: lock.productionHosting,
  operationalStatus: lock.operationalStatus,
  failures,
};
writeReport(report);
if (failures.length > 0) process.exit(1);
