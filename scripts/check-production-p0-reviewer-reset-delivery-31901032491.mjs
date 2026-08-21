#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-delivery-31901032491.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-delivery-31901032491.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-delivery-31901032491.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-delivery-31901032491-3785.json';
const command = '/production p0-reviewer-reset-delivery-diagnose 31901032491';
const sourceRun = 31901032491;
const deployed = '056ed4461dafb5e7dab2efc9ea5a0d5877523169';
const coreBlob = '115fee96ea9feb45b75291031f263d7856e7790d';
const since = '2026-08-15T18:24:20Z';
const until = '2026-08-15T18:25:20Z';

const fail = (message) => {
  console.error(`reviewer reset delivery 31901032491 contract: ${message}`);
  process.exit(1);
};
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) fail(`${label}: missing ${JSON.stringify(needle)}`);
};

for (const path of [workflowPath, scriptPath, checkerPath, scopePath]) {
  if (!fs.existsSync(path)) fail(`missing ${path}`);
}

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

for (const needle of [
  command,
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  "node-version: '24'",
  'persist-credentials: false',
  'bash scripts/production-p0-reviewer-reset-delivery-31901032491.sh',
]) requireText(workflow, needle, 'workflow');

for (const needle of [
  `CORE_BLOB='${coreBlob}'`,
  `TARGET_COMMAND='${command}'`,
  `TARGET_RUN='${sourceRun}'`,
  `TARGET_SHA='${deployed}'`,
  `TARGET_SINCE='${since}'`,
  `TARGET_UNTIL='${until}'`,
  'git cat-file blob "$CORE_BLOB"',
  '[[ "$(git hash-object "$tmp")" == "$CORE_BLOB" ]]',
  'PC_P0_REVIEWER_RESET_DELIVERY_CURRENT_VALIDATE_ONLY',
  'MAIL_SENT_BY_DIAGNOSTIC=NO',
  'PRODUCTION_MUTATION=NONE',
  'StrictHostKeyChecking=yes',
]) requireText(script, needle, 'script');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schemaVersion');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope issue binding');
if (scope.sourceRun !== sourceRun) fail('scope sourceRun');
if (scope.deployedRevision !== deployed) fail('scope deployed revision');
if (scope.branch !== 'diag/p0-reviewer-reset-delivery-31901032491-3785') fail('scope branch');
const expectedPaths = [workflowPath, scriptPath, checkerPath, scopePath].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) fail('scope allowedPaths');

const b = scope.boundaries || {};
const requiredFalse = [
  'databaseMutation', 'identityMutation', 'passwordMutation', 'credentialMutation',
  'mfaMutation', 'sessionMutation', 'mailSend', 'runtimeBusinessBehaviorChange',
  'securityGateDisabled', 'piiOutput', 'credentialOutput',
];
if (b.productionMutation !== 'NONE') fail('scope productionMutation');
for (const key of requiredFalse) if (b[key] !== false) fail(`scope ${key}`);
if (b.logReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true) fail('scope read-only/owner/exact-main boundary');
if (b.newRecurringCostRub !== 0) fail('scope recurring cost');

const acceptance = Array.isArray(scope.acceptance) ? scope.acceptance.join('\n') : '';
for (const needle of [
  `source reset run ${sourceRun}`,
  `immutable blob ${coreBlob}`,
  `OCI revision ${deployed}`,
  `${since}..${until}`,
  'password_reset_delivery_result',
  'sends no email',
  'StrictHostKeyChecking=yes',
]) requireText(acceptance, needle, 'scope acceptance');

console.log('reviewer reset delivery 31901032491 contract: PASS');
