#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-repair-diagnose.yml';
const runnerPath = 'scripts/production-p0-reviewer-repair-diagnose.sh';
const wrapperPath = 'scripts/production-p0-reviewer-repair-diagnose-deployed-sha.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-repair-diagnose.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-repair-diagnose-3802.json';
const branch = 'fix/p0-reviewer-post-30d-diagnostic-3846';
const diagnosticBaseRevision = '479ecd970bd5e75e81f245dbe8987e08aca08d9f';
const deployedRevision = 'd87d89694bd32c8dbd90b57fdde15b69b060c0ba';
const revisionGateValues = [
  'API_INSPECT_FAILED',
  'WEB_INSPECT_FAILED',
  'API_REVISION_INVALID',
  'WEB_REVISION_INVALID',
  'API_REVISION_MISMATCH',
  'WEB_REVISION_MISMATCH',
];

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const fail = (code) => {
  console.error(`CHECKER_FAIL=${code}`);
  process.exit(1);
};

const requireMarkers = (code, source, markers) => {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(code);
  }
};

requireMarkers('WORKFLOW_MARKERS', workflow, [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-reviewer-membership-diagnose current-main'",
  'permissions:\n  contents: read',
  'issues: write',
  'cancel-in-progress: false',
  `bash -n ${runnerPath}`,
  `bash -n ${wrapperPath}`,
  `bash ${wrapperPath}`,
]);

requireMarkers('RUNNER_MARKERS', runner, [
  "COMMAND='/production p0-reviewer-membership-diagnose current-main'",
  'Prisma.TransactionIsolationLevel.Serializable',
  'FROM auth.repair_single_reviewer_membership()',
  'P0_REVIEWER_ROLLBACK_ONLY',
  "before.join('|') !== after.join('|')",
  'PRODUCTION_MUTATION=ROLLBACK_ONLY_NONE_DURABLE',
]);

requireMarkers('WRAPPER_MARKERS', wrapper, [
  `DIAGNOSTIC_BASE_SHA='${diagnosticBaseRevision}'`,
  `DEPLOYED_SHA='${deployedRevision}'`,
  'failure_line="${BASH_LINENO[0]:-0}"',
  '- failure line: \\`$failure_line\\`',
  'ssh_rc=0',
  "runtime_code='REMOTE_EXECUTION_FAILED'",
  "remote_stage='SSH_NOT_CONFIRMED'",
  'P0_REVIEWER_REMOTE_STAGE=HOST_READY',
  'P0_REVIEWER_REMOTE_STAGE=CONTAINERS_RESOLVED',
  'P0_REVIEWER_REMOTE_STAGE=REVISIONS_CONFIRMED',
  'P0_REVIEWER_REMOTE_STAGE=NODE_EXECUTION_STARTED',
  'P0_REVIEWER_REVISION_GATE=',
  'runtime_code="REVISION_GATE.${BASH_REMATCH[1]}"',
  '- remote stage: \\`$remote_stage\\`',
  'P0_REVIEWER_DIAG_STAFF_DB_URL_MISSING',
  'P0_REVIEWER_DIAG_ROLLBACK_SENTINEL_NOT_RAISED',
  'P0_REVIEWER_DIAG_ROLLBACK_PROOF_FAILED',
  'P0_REVIEWER_DIAG_TRANSACTION_ERROR',
  'P0_REVIEWER_DIAG_FATAL',
  '- runtime code: \\`$runtime_code\\`',
  '- raw runtime output: \\`NOT_PUBLISHED\\`',
  "['reviewer membership repair structural precondition failed', 'STRUCTURAL_PRECONDITION']",
  "['unique active PLATFORM_OWNER identity is required', 'OWNER_IDENTITY']",
  "['reviewer membership pre-state is inconsistent', 'MEMBERSHIP_PRESTATE_INCONSISTENT']",
  "['reviewer has a conflicting pre-existing membership state', 'CONFLICTING_EXISTING_MEMBERSHIP']",
  "['reviewer membership repair postcondition failed', 'POSTCONDITION']",
  "reasonCode = 'DATABASE_CHECK_CONSTRAINT'",
  'diagnostic.reasonCode',
  "reason code: \\`$reason_code\\`",
  'if count != 1:',
  'text.replace(old, new, 1)',
  'bash -n "$PATCHED"',
  'exec bash "$PATCHED"',
  ...revisionGateValues,
]);

const pythonMatch = wrapper.match(/python3 - "\$SOURCE" "\$PATCHED" <<'PY'\n([\s\S]*?)\nPY/);
if (!pythonMatch) fail('PYTHON_EXTRACT');
const pythonSyntax = spawnSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], { input: pythonMatch[1], encoding: 'utf8' });
if (pythonSyntax.error) fail('PYTHON3_UNAVAILABLE');
if (pythonSyntax.status !== 0) fail('PYTHON_SYNTAX');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-reviewer-revision-'));
const sourcePath = path.join(tempRoot, 'source.sh');
const patchedPath = path.join(tempRoot, 'patched.sh');
try {
  fs.writeFileSync(sourcePath, runner, 'utf8');
  const patchResult = spawnSync('python3', ['-c', pythonMatch[1], sourcePath, patchedPath], { encoding: 'utf8' });
  if (patchResult.error) fail('PYTHON3_UNAVAILABLE');
  if (patchResult.status !== 0 || !fs.existsSync(patchedPath)) fail('PATCH_MATERIALIZE');
  const patched = fs.readFileSync(patchedPath, 'utf8');
  if (spawnSync('bash', ['-n', patchedPath], { encoding: 'utf8' }).status !== 0) fail('PATCHED_BASH_SYNTAX');
  requireMarkers('PATCHED_MARKERS', patched, [
    `DIAGNOSTIC_BASE_SHA='${diagnosticBaseRevision}'`,
    `DEPLOYED_SHA='${deployedRevision}'`,
    'failure_line="${BASH_LINENO[0]:-0}"',
    '- failure line: \\`$failure_line\\`',
    'ssh_rc=0',
    "runtime_code='REMOTE_EXECUTION_FAILED'",
    "remote_stage='SSH_NOT_CONFIRMED'",
    "printf '%s\\n' 'P0_REVIEWER_REMOTE_STAGE=HOST_READY'",
    "printf '%s\\n' 'P0_REVIEWER_REMOTE_STAGE=CONTAINERS_RESOLVED'",
    "printf '%s\\n' 'P0_REVIEWER_REMOTE_STAGE=REVISIONS_CONFIRMED'",
    "printf '%s\\n' 'P0_REVIEWER_REMOTE_STAGE=NODE_EXECUTION_STARTED'",
    'runtime_code="REVISION_GATE.${BASH_REMATCH[1]}"',
    '- remote stage: \\`$remote_stage\\`',
    'TRANSACTION_ERROR.${BASH_REMATCH[1]}',
    'FATAL.${BASH_REMATCH[1]}',
    '- runtime code: \\`$runtime_code\\`',
    '- raw runtime output: \\`NOT_PUBLISHED\\`',
    "reasonCode: 'NONE'",
    "let reasonCode = 'UNCLASSIFIED'",
    'meta_keys reason_code',
    'PRODUCTION_MUTATION=ROLLBACK_ONLY_NONE_DURABLE',
    ...revisionGateValues.map((value) => `P0_REVIEWER_REVISION_GATE=${value}`),
  ]);
  for (const unsafe of [
    /console\.(?:log|error)\([^\n]*safeMessage/,
    /JSON\.stringify\(\s*(?:meta|error)/,
    /\$safeMessage/,
    /raw runtime output:\s*\\`\$output/,
    /runtime code:\s*\\`\$runtime_line/,
    /remote stage:\s*\\`\$stage_line/,
    /(?:api|web) revision:\s*\\`\$(?:api|web)_revision/i,
    /P0_REVIEWER_REVISION_GATE=[^\n]*\$(?:api|web)_revision/,
  ]) {
    if (unsafe.test(patched)) fail('UNSAFE_GUARD');
  }
  const revisionGateOutputCount = revisionGateValues
    .map((value) => patched.split(`P0_REVIEWER_REVISION_GATE=${value}`).length - 1)
    .reduce((sum, value) => sum + value, 0);
  if (revisionGateOutputCount !== revisionGateValues.length) fail('REVISION_GATE_CARDINALITY');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const expectedPaths = [wrapperPath, checkerPath, scopePath].sort();
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expectedPaths)) fail('SCOPE_PATHS');
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
    || scope.branch !== branch
    || scope.status !== 'active'
    || scope.operationalStatus !== 'P0_REVIEWER_REPAIR_ROLLBACK_DIAGNOSTIC_REVISION_GATE'
    || scope.issue !== 3802
    || scope.trackingIssue !== 3799
    || scope.diagnosticBaseRevision !== diagnosticBaseRevision
    || scope.deployedRevision !== deployedRevision
    || scope.boundaries?.productionMutation !== 'ROLLBACK_ONLY_NONE_DURABLE'
    || scope.boundaries?.piiOutput !== false
    || scope.boundaries?.credentialOutput !== false
    || scope.boundaries?.rawDatabaseMessageOutput !== false
    || scope.boundaries?.rawRuntimeOutput !== false
    || scope.boundaries?.rawRevisionOutput !== false
    || scope.boundaries?.remoteStageOnly !== true
    || scope.boundaries?.revisionGateOnly !== true
    || scope.boundaries?.deploymentMutation !== false
    || scope.boundaries?.securityWeakening !== false
    || scope.boundaries?.arbitrarySqlSurface !== false
    || scope.boundaries?.newRecurringCostRub !== 0) fail('SCOPE_METADATA');

console.log('PASS: reviewer repair rollback diagnostic is pinned to the exact current deployed production revision and exact governed main without exposing raw production data.');
