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
const branch = 'fix/p0-reviewer-safe-runtime-marker-3821';
const diagnosticBaseRevision = '67510071067f26832bcd770b186ef7c84cdb49d1';
const deployedRevision = 'b81ee2e51f9fbf5ec66603211c3f32224532e782';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const requireMarkers = (label, source, markers) => {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      console.error(`Missing ${label} marker: ${marker}`);
      process.exit(1);
    }
  }
};

requireMarkers('workflow', workflow, [
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

requireMarkers('reviewed rollback runner', runner, [
  "COMMAND='/production p0-reviewer-membership-diagnose current-main'",
  'Prisma.TransactionIsolationLevel.Serializable',
  'FROM auth.repair_single_reviewer_membership()',
  'P0_REVIEWER_ROLLBACK_ONLY',
  "before.join('|') !== after.join('|')",
  'PRODUCTION_MUTATION=ROLLBACK_ONLY_NONE_DURABLE',
]);

requireMarkers('reason wrapper', wrapper, [
  `DIAGNOSTIC_BASE_SHA='${diagnosticBaseRevision}'`,
  `DEPLOYED_SHA='${deployedRevision}'`,
  'failure_line="${BASH_LINENO[0]:-0}"',
  '- failure line: \\`$failure_line\\`',
  'ssh_rc=0',
  'runtime_code=\'REMOTE_EXECUTION_FAILED\'',
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
]);

const pythonMatch = wrapper.match(/python - "\$SOURCE" "\$PATCHED" <<'PY'\n([\s\S]*?)\nPY/);
if (!pythonMatch) process.exit(1);
const pythonSyntax = spawnSync('python', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], { input: pythonMatch[1], encoding: 'utf8' });
if (pythonSyntax.status !== 0) process.exit(1);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-reviewer-runtime-'));
const sourcePath = path.join(tempRoot, 'source.sh');
const patchedPath = path.join(tempRoot, 'patched.sh');
try {
  fs.writeFileSync(sourcePath, runner, 'utf8');
  const patchResult = spawnSync('python', ['-c', pythonMatch[1], sourcePath, patchedPath], { encoding: 'utf8' });
  if (patchResult.status !== 0 || !fs.existsSync(patchedPath)) process.exit(1);
  const patched = fs.readFileSync(patchedPath, 'utf8');
  if (spawnSync('bash', ['-n', patchedPath], { encoding: 'utf8' }).status !== 0) process.exit(1);
  requireMarkers('patched diagnostic', patched, [
    `DIAGNOSTIC_BASE_SHA='${diagnosticBaseRevision}'`,
    `DEPLOYED_SHA='${deployedRevision}'`,
    'failure_line="${BASH_LINENO[0]:-0}"',
    '- failure line: \\`$failure_line\\`',
    'ssh_rc=0',
    "runtime_code='REMOTE_EXECUTION_FAILED'",
    'TRANSACTION_ERROR.${BASH_REMATCH[1]}',
    'FATAL.${BASH_REMATCH[1]}',
    '- runtime code: \\`$runtime_code\\`',
    '- raw runtime output: \\`NOT_PUBLISHED\\`',
    "reasonCode: 'NONE'",
    "let reasonCode = 'UNCLASSIFIED'",
    'meta_keys reason_code',
    'PRODUCTION_MUTATION=ROLLBACK_ONLY_NONE_DURABLE',
  ]);
  for (const unsafe of [
    /console\.(?:log|error)\([^\n]*safeMessage/,
    /JSON\.stringify\(\s*(?:meta|error)/,
    /\$safeMessage/,
    /raw runtime output:\s*\\`\$output/,
    /runtime code:\s*\\`\$runtime_line/,
  ]) {
    if (unsafe.test(patched)) process.exit(1);
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const expectedPaths = [wrapperPath, checkerPath, scopePath].sort();
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expectedPaths)) process.exit(1);
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
    || scope.branch !== branch
    || scope.status !== 'active'
    || scope.operationalStatus !== 'P0_REVIEWER_REPAIR_ROLLBACK_DIAGNOSTIC_SAFE_RUNTIME_MARKER'
    || scope.issue !== 3802
    || scope.trackingIssue !== 3810
    || scope.diagnosticBaseRevision !== diagnosticBaseRevision
    || scope.deployedRevision !== deployedRevision
    || scope.boundaries?.productionMutation !== 'ROLLBACK_ONLY_NONE_DURABLE'
    || scope.boundaries?.piiOutput !== false
    || scope.boundaries?.credentialOutput !== false
    || scope.boundaries?.rawDatabaseMessageOutput !== false
    || scope.boundaries?.rawRuntimeOutput !== false
    || scope.boundaries?.deploymentMutation !== false
    || scope.boundaries?.securityWeakening !== false
    || scope.boundaries?.arbitrarySqlSurface !== false
    || scope.boundaries?.newRecurringCostRub !== 0) process.exit(1);

console.log('PASS: non-zero reviewer diagnostic execution is converted only to an allowlisted runtime code; raw remote output remains private and production stays rollback-only.');
