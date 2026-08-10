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
const branch = 'fix/p0-reviewer-diagnostic-current-main-3820';
const diagnosticBaseRevision = '98447a394ecd156a2a736574eb3d3ccdbac49bd9';
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
if (!pythonMatch) {
  console.error('Exact diagnostic reason patcher is missing.');
  process.exit(1);
}
const pythonSyntax = spawnSync(
  'python',
  ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'],
  { input: pythonMatch[1], encoding: 'utf8' },
);
if (pythonSyntax.status !== 0) {
  console.error('Diagnostic reason patcher is not syntactically valid Python.');
  process.exit(1);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-reviewer-reason-'));
const sourcePath = path.join(tempRoot, 'source.sh');
const patchedPath = path.join(tempRoot, 'patched.sh');
try {
  fs.writeFileSync(sourcePath, runner, 'utf8');
  const patchResult = spawnSync(
    'python',
    ['-c', pythonMatch[1], sourcePath, patchedPath],
    { encoding: 'utf8' },
  );
  if (patchResult.status !== 0 || !fs.existsSync(patchedPath)) {
    console.error('Exact diagnostic reason patch did not materialize successfully.');
    process.exit(1);
  }

  const patched = fs.readFileSync(patchedPath, 'utf8');
  const shellSyntax = spawnSync('bash', ['-n', patchedPath], { encoding: 'utf8' });
  if (shellSyntax.status !== 0) {
    console.error('Patched diagnostic shell is not syntactically valid.');
    process.exit(1);
  }

  requireMarkers('patched diagnostic', patched, [
    `DIAGNOSTIC_BASE_SHA='${diagnosticBaseRevision}'`,
    `DEPLOYED_SHA='${deployedRevision}'`,
    "reasonCode: 'NONE'",
    "let reasonCode = 'UNCLASSIFIED'",
    "reasonCode = 'DATABASE_CHECK_CONSTRAINT'",
    'diagnostic.reasonCode',
    'meta_keys reason_code',
    '"$reason_code"; do',
    "reason code: \\`$reason_code\\`",
    'PRODUCTION_MUTATION=ROLLBACK_ONLY_NONE_DURABLE',
  ]);

  const embeddedNodeMatch = patched.match(
    /docker exec -i "\$api_id" \/nodejs\/bin\/node --input-type=commonjs - <<'NODE'\n([\s\S]*?)\nNODE/,
  );
  if (!embeddedNodeMatch) {
    console.error('Patched CommonJS diagnostic executor is missing.');
    process.exit(1);
  }
  const nodeSyntax = spawnSync(process.execPath, ['--check'], {
    input: embeddedNodeMatch[1],
    encoding: 'utf8',
  });
  if (nodeSyntax.status !== 0) {
    console.error('Patched diagnostic Node executor is not syntactically valid.');
    process.exit(1);
  }

  for (const unsafe of [
    /console\.(?:log|error)\([^\n]*safeMessage/,
    /JSON\.stringify\(\s*(?:meta|error)/,
    /reasonCode\s*=\s*safeMessage/,
    /\$safeMessage/,
    /meta\.message[^\n]*(?:console|issue|body)/,
  ]) {
    if (unsafe.test(patched)) {
      console.error(`Raw database diagnostic material could escape: ${unsafe}`);
      process.exit(1);
    }
  }

  const reasonCodes = [
    'STRUCTURAL_PRECONDITION',
    'OWNER_IDENTITY',
    'MEMBERSHIP_PRESTATE_INCONSISTENT',
    'CONFLICTING_EXISTING_MEMBERSHIP',
    'POSTCONDITION',
    'DATABASE_CHECK_CONSTRAINT',
    'UNCLASSIFIED',
    'NONE',
  ];
  for (const code of reasonCodes) {
    if (!patched.includes(code)) {
      console.error(`Reason-code allowlist is incomplete: ${code}`);
      process.exit(1);
    }
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const expectedPaths = [wrapperPath, checkerPath, scopePath].sort();
const actualPaths = [...scope.allowedPaths].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
  console.error('Governed reason-classification scope does not match the exact three-file surface.');
  process.exit(1);
}
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
    || scope.branch !== branch
    || scope.status !== 'active'
    || scope.operationalStatus !== 'P0_REVIEWER_REPAIR_ROLLBACK_DIAGNOSTIC_CURRENT_MAIN_PIN'
    || scope.issue !== 3802
    || scope.trackingIssue !== 3810
    || scope.diagnosticBaseRevision !== diagnosticBaseRevision
    || scope.deployedRevision !== deployedRevision
    || !Array.isArray(scope.acceptance)
    || scope.acceptance.length < 9
    || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY'
    || scope.boundaries?.productionMutation !== 'ROLLBACK_ONLY_NONE_DURABLE'
    || scope.boundaries?.piiOutput !== false
    || scope.boundaries?.credentialOutput !== false
    || scope.boundaries?.rawDatabaseMessageOutput !== false
    || scope.boundaries?.deploymentMutation !== false
    || scope.boundaries?.securityWeakening !== false
    || scope.boundaries?.arbitrarySqlSurface !== false
    || scope.boundaries?.newRecurringCostRub !== 0) {
  console.error('Governed current-main diagnostic-pin scope or boundaries are incomplete or unsafe.');
  process.exit(1);
}

console.log('PASS: rollback-only reviewer diagnostic is bound to the exact current-main base and exact healthy deployed revision; raw database text remains private.');
