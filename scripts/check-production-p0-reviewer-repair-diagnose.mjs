#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-repair-diagnose.yml';
const runnerPath = 'scripts/production-p0-reviewer-repair-diagnose.sh';
const wrapperPath = 'scripts/production-p0-reviewer-repair-diagnose-deployed-sha.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-repair-diagnose.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-repair-diagnose-3802.json';
const branch = 'fix/p0-reviewer-repair-diagnostic-deployed-sha-3802';

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
  'contents: read\n      issues: write',
  'cancel-in-progress: false',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  `bash -n ${runnerPath}`,
  `bash -n ${wrapperPath}`,
  `bash ${wrapperPath}`,
]);

requireMarkers('reviewed runner', runner, [
  "COMMAND='/production p0-reviewer-membership-diagnose current-main'",
  "DIAGNOSTIC_BASE_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
  "DEPLOYED_SHA='159b597c512aa88f24ffe9a9f37863fe5892c02f'",
  'Prisma.TransactionIsolationLevel.Serializable',
  'FROM auth.repair_single_reviewer_membership()',
  'P0_REVIEWER_ROLLBACK_ONLY',
  'PRODUCTION_MUTATION=ROLLBACK_ONLY_NONE_DURABLE',
]);

requireMarkers('deployed-sha wrapper', wrapper, [
  "SOURCE='scripts/production-p0-reviewer-repair-diagnose.sh'",
  "DIAGNOSTIC_BASE_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
  "DIAGNOSTIC_BASE_SHA='fc7bea2b225ce88e5cf10230d0188ffb2952381e'",
  "DEPLOYED_SHA='159b597c512aa88f24ffe9a9f37863fe5892c02f'",
  "DEPLOYED_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
  "'scripts/production-p0-reviewer-repair-diagnose-deployed-sha.sh'",
  "if count != 1:",
  "text.replace(old, new, 1)",
  "target.write_text(text, encoding='utf-8')",
  'bash -n "$PATCHED"',
  'exec bash "$PATCHED"',
]);

const pythonMatch = wrapper.match(/python - "\$SOURCE" "\$PATCHED" <<'PY'\n([\s\S]*?)\nPY/);
if (!pythonMatch) {
  console.error('Exact diagnostic wrapper patcher is missing.');
  process.exit(1);
}
const pythonSyntax = spawnSync('python', ['-m', 'py_compile', '-'], {
  input: pythonMatch[1],
  encoding: 'utf8',
});
if (pythonSyntax.status !== 0) {
  console.error('Diagnostic wrapper Python patcher is not syntactically valid.');
  process.exit(1);
}

for (const pattern of [
  /curl|wget|nc\s|socat|eval\s|source\s|\.\s+\//,
  /(?:PASSWORD|TOTP|TOKEN|COOKIE|DATABASE_URL)/i,
  /\b(?:psql|UPDATE|DELETE|INSERT|ALTER|CREATE|DROP|TRUNCATE)\b/i,
  /error\.(?:message|stack)/,
]) {
  if (pattern.test(wrapper)) {
    console.error(`Diagnostic wrapper exceeds the exact SHA/file-list correction boundary: ${pattern}`);
    process.exit(1);
  }
}

const replacementCount = (wrapper.match(/text\.replace\(old, new, 1\)/g) || []).length;
if (replacementCount !== 1 || !wrapper.includes('for old, new in replacements.items():')) {
  console.error('Diagnostic wrapper must apply only the declared exact replacement map.');
  process.exit(1);
}

const expectedPaths = [workflowPath, wrapperPath, checkerPath, scopePath].sort();
const actualPaths = [...scope.allowedPaths].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
  console.error('Governed diagnostic correction scope does not match the exact four-file surface.');
  process.exit(1);
}
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
    || scope.branch !== branch
    || scope.status !== 'active'
    || scope.operationalStatus !== 'P0_REVIEWER_REPAIR_ROLLBACK_DIAGNOSTIC_DEPLOYED_SHA_CORRECTION'
    || scope.issue !== 3802
    || !Array.isArray(scope.acceptance)
    || scope.acceptance.length < 7
    || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY'
    || scope.boundaries?.productionMutation !== 'ROLLBACK_ONLY_NONE_DURABLE'
    || scope.boundaries?.piiOutput !== false
    || scope.boundaries?.credentialOutput !== false
    || scope.boundaries?.deploymentMutation !== false
    || scope.boundaries?.securityWeakening !== false
    || scope.boundaries?.arbitrarySqlSurface !== false
    || scope.boundaries?.newRecurringCostRub !== 0) {
  console.error('Governed diagnostic correction scope or boundaries are incomplete or unsafe.');
  process.exit(1);
}

console.log('PASS: only the diagnostic base/deployed SHA pins and exact correction-file allowlist are changed; rollback and no-PII/no-credential boundaries remain intact.');
