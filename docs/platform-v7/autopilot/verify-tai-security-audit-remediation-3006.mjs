import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const scopePath = 'docs/platform-v7/autopilot/scopes/agent-tai-security-audit-remediation-3006.json';
const deviationPath = 'docs/platform-v7/autopilot/deviations/pr-3008-security-audit-remediation.json';
const verifierPath = 'docs/platform-v7/autopilot/verify-tai-security-audit-remediation-3006.mjs';
const expectedCloseoutFiles = new Set([scopePath, deviationPath, verifierPath]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const scope = readJson(scopePath);
const deviation = readJson(deviationPath);
const packageJson = readJson('package.json');
const exceptions = readJson('docs/platform-v7/autopilot/security-exceptions.json');
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');

assert(scope.branch === 'agent/tai-security-audit-remediation-3006', 'Unexpected scope branch.');
assert(scope.status === 'closed-after-recorded-deviation', 'Scope status must preserve the post-merge deviation.');
assert(scope.authorizationTiming === 'post-merge-governance-reconciliation', 'The authority must not be represented as pre-merge.');
assert(scope.historicallyAuthorizedPaths?.join('\n') === 'package.json\npnpm-lock.yaml', 'Historical scope must stay limited to package.json and pnpm-lock.yaml.');
assert(new Set(scope.closeoutPaths ?? []).size === expectedCloseoutFiles.size, 'Unexpected closeout path count.');
for (const file of expectedCloseoutFiles) assert(scope.closeoutPaths.includes(file), `Missing closeout path: ${file}`);

assert(deviation.recordType === 'post-merge-scope-deviation', 'Unexpected deviation record type.');
assert(deviation.status === 'recorded-not-concealed', 'Deviation must remain explicitly recorded.');
assert(deviation.scopeDeviation?.pullRequest === 3008, 'Deviation must bind PR #3008.');
assert(deviation.scopeDeviation?.mergedBeforeAuthorityRecord === true, 'Deviation timing must remain explicit.');
assert(deviation.scopeDeviation?.pathsOutsideActiveScopeAtMerge?.join('\n') === 'package.json\npnpm-lock.yaml', 'Deviation paths changed.');
assert(deviation.scopeDeviation?.reviewThread === 'PRRT_kwDOR7So_c6SwFR2', 'Review thread binding changed.');

assert(deviation.finding?.findingId === '1124066', 'Finding ID changed.');
assert(deviation.finding?.advisory === 'GHSA-f88m-g3jw-g9cj', 'Advisory changed.');
assert(deviation.finding?.package === 'sharp', 'Package changed.');
assert(deviation.finding?.lockedVersion === '0.34.5', 'Locked affected version changed.');
assert(deviation.finding?.patchedVersion === '0.35.3', 'Patched version changed.');
assert(deviation.finding?.dependencyPath?.join(' > ') === 'apps/web > next@15.5.18 > optionalDependencies > sharp@0.34.5', 'Dependency path changed.');
assert(deviation.finding?.exceptionAdded === false, 'A security exception must not be added.');

assert(deviation.failedEvidence?.artifactId === 8512387299, 'Original artifact binding changed.');
assert(deviation.failedEvidence?.artifactDigest === 'sha256:b84f5932d05c0b7c0f0cdd36a7ae7bee164ba052b58dcb26289026d7ba6ba392', 'Original artifact digest changed.');
assert(deviation.failedEvidence?.blockedFindings === 1, 'Original blocked finding count changed.');
assert(deviation.reextractedEvidence?.artifactId === 8512555577, 'Re-extracted artifact binding changed.');
assert(deviation.reextractedEvidence?.blockedFindings === 1, 'Re-extracted blocked finding count changed.');
assert(deviation.remediationEvidence?.artifactId === 8513058980, 'Remediation artifact binding changed.');
assert(deviation.remediationEvidence?.artifactDigest === 'sha256:428c31460b6ba9e64178a7bd79567bd4cbb72dc6222add6f2bd45f87b98cb3c9', 'Remediation artifact digest changed.');
assert(deviation.remediationEvidence?.blockedFindings === 0, 'Remediation must have zero blocked findings.');

assert(packageJson.pnpm?.overrides?.sharp === '0.35.3', 'package.json must pin sharp to 0.35.3.');
assert(lockfile.includes('sharp@0.35.3'), 'pnpm-lock.yaml does not contain sharp@0.35.3.');
assert(!lockfile.includes('sharp@0.34.5'), 'pnpm-lock.yaml still contains sharp@0.34.5.');
assert(exceptions.policy?.criticalExceptionsAllowed === false, 'Critical exceptions must remain prohibited.');
assert(Array.isArray(exceptions.exceptions) && exceptions.exceptions.length === 0, 'No security exception is permitted for this remediation.');
assert(deviation.boundaries?.taiOperationalStatus === 'NOT_ATTESTED', 'TAI maturity was overstated.');

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const changed = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const unexpected = changed.filter((file) => !expectedCloseoutFiles.has(file));
  const missing = [...expectedCloseoutFiles].filter((file) => !changed.includes(file));
  assert(unexpected.length === 0 && missing.length === 0, `Closeout scope mismatch: ${JSON.stringify({ unexpected, missing })}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  issue: 3007,
  remediationPr: 3008,
  acceptanceGapIssue: 3012,
  findingId: '1124066',
  package: 'sharp',
  patchedVersion: '0.35.3',
  blockedFindings: 0,
  taiOperationalStatus: 'NOT_ATTESTED'
}, null, 2));
