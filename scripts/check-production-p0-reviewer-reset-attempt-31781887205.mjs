#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-attempt-31781887205.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-attempt-31781887205.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-attempt-31781887205.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-attempt-31781887205-3785.json';
const canonicalPath = 'scripts/production-p0-reviewer-reset-attempt-classifier.sh';
const canonicalBlob = '7dcfb19d247aab2f0dc8c8075416673499c9dc84';
const branch = 'diag/p0-reviewer-reset-attempt-31781887205-substage-3785';
const command = '/production p0-reviewer-reset-attempt-classify 31781887205 current-main';
const sourceRun = 31781887205;
const sourceRevision = 'dc5bec67faeaec26ce905c0643dc15d35f99bf50';
const attemptSince = '2026-08-14T07:56:46Z';
const attemptUntil = '2026-08-14T07:57:05Z';
const allowedPaths = [workflowPath, runnerPath, checkerPath, scopePath];

const read = (file) => fs.readFileSync(file, 'utf8');
const workflow = read(workflowPath);
const runner = read(runnerPath);
const scopeText = read(scopePath);
const failures = [];

const requireToken = (name, haystack, token) => {
  if (!haystack.includes(token)) failures.push(`${name}: missing ${JSON.stringify(token)}`);
};
const forbid = (name, haystack, pattern) => {
  if (pattern.test(haystack)) failures.push(`${name}: forbidden ${pattern}`);
};
const run = (args) => spawnSync(args[0], args.slice(1), { encoding: 'utf8' });

for (const path of allowedPaths) requireToken('workflow', workflow, `      - '${path}'`);
for (const token of [
  'name: Production P0 Reviewer Reset 31781887205 Classifier',
  'pull_request:',
  'issue_comment:',
  'permissions:\n  contents: read',
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  `github.event.comment.body == '${command}'`,
  'needs.contract.result == \'success\'',
  'persist-credentials: false',
  'fetch-depth: 0',
  'node-version: \'24\'',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
  `bash ${runnerPath}`,
  'PC_REVIEWER_RESET_ATTEMPT_COMMAND: ${{ github.event.comment.body }}',
  'PC_PROD_SSH_HOST_FINGERPRINT: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'issues: write',
]) requireToken('workflow', workflow, token);

const commandOccurrences = workflow.split(command).length - 1;
if (commandOccurrences !== 2) failures.push(`workflow: expected fixed command twice, found ${commandOccurrences}`);
const secretNames = [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);
const expectedSecrets = [
  'PC_PROD_HOST',
  'PC_PROD_SSH_USER',
  'PC_PROD_SSH_PORT',
  'PC_PROD_SSH_KEY',
  'PC_PROD_SSH_PRIVATE_KEY',
  'VPS_SSH_KEY',
  'PC_PROD_SSH_HOST_FINGERPRINT',
].sort();
const actualSecrets = [...new Set(secretNames)].sort();
if (JSON.stringify(actualSecrets) !== JSON.stringify(expectedSecrets)) failures.push('workflow: protected secret allowlist mismatch');
for (const pattern of [
  /workflow_dispatch:/,
  /schedule:/,
  /\bpush:/,
  /actions\/upload-artifact/,
  /PC_P0_REVIEWER_(?:EMAIL|PASSWORD|TOTP)/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
]) forbid('workflow', workflow, pattern);

for (const token of [
  `COMMAND='${command}'`,
  `SOURCE='${canonicalPath}'`,
  `SOURCE_BLOB='${canonicalBlob}'`,
  '[[ "$(git hash-object "$SOURCE")" == "$SOURCE_BLOB" ]]',
  "ATTEMPT_COMMAND='/production p0-reviewer-reset-attempt-classify 31706325376 current-main'",
  "ATTEMPT_COMMAND='/production p0-reviewer-reset-attempt-classify 31781887205 current-main'",
  "SOURCE_RUN_ID='31706325376'",
  "SOURCE_RUN_ID='31781887205'",
  "ATTEMPT_SINCE='2026-08-13T13:43:10Z'",
  `ATTEMPT_SINCE='${attemptSince}'`,
  "ATTEMPT_UNTIL='2026-08-13T13:43:26Z'",
  `ATTEMPT_UNTIL='${attemptUntil}'`,
  "SOURCE_REVISION='7c768ad7c54523837b06999a8f69bdffe2a840db'",
  `SOURCE_REVISION='${sourceRevision}'`,
  'remote_replacements = [',
  'REMOTE_BINDING_MISMATCH',
  "[[ \\\"$source_revision\\\" == '7c768ad7c54523837b06999a8f69bdffe2a840db' ]]",
  `[[ \\\"$source_revision\\\" == '${sourceRevision}' ]]`,
  "[[ \\\"$attempt_since\\\" == '2026-08-13T13:43:10Z' ]]",
  `[[ \\\"$attempt_since\\\" == '${attemptSince}' ]]`,
  "[[ \\\"$attempt_until\\\" == '2026-08-13T13:43:26Z' ]]",
  `[[ \\\"$attempt_until\\\" == '${attemptUntil}' ]]`,
  'SAFE_SUBSTAGE_BINDING_MISMATCH',
  "if [[ \\\"$remote_failure\\\" =~ ^ATTEMPT_REMOTE_FAILURE",
  "failure_detail=\\\"${BASH_REMATCH[1]}_${BASH_REMATCH[2]}_${BASH_REMATCH[3]}_${BASH_REMATCH[4]}\\\"",
  "if count != 1:",
  "raise SystemExit(f'FIXED_BINDING_MISMATCH:",
  'bash -n "$TMP"',
  'bash "$TMP"',
]) requireToken('runner', runner, token);
for (const pattern of [
  /\bssh\s/,
  /\bcurl\s/,
  /\bdocker\s/,
  /gh issue comment/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
  /forgot-password/,
]) forbid('runner', runner, pattern);

const hash = run(['git', 'hash-object', canonicalPath]);
if (hash.status !== 0 || hash.stdout.trim() !== canonicalBlob) {
  failures.push(`canonical classifier blob mismatch: ${hash.stdout.trim() || hash.stderr.trim()}`);
}

let scope;
try {
  scope = JSON.parse(scopeText);
} catch (error) {
  failures.push(`scope: invalid JSON: ${error.message}`);
}
if (scope) {
  const expectedAllowed = [...allowedPaths].sort();
  const actualAllowed = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope: schemaVersion mismatch');
  if (scope.branch !== branch) failures.push('scope: branch mismatch');
  if (scope.status !== 'active') failures.push('scope: status must be active');
  if (scope.issue !== 3785 || scope.releaseIssue !== 3072) failures.push('scope: authority mismatch');
  if (scope.sourceRun !== sourceRun) failures.push('scope: sourceRun mismatch');
  if (scope.sourceRevision !== sourceRevision) failures.push('scope: sourceRevision mismatch');
  if (scope.attemptSinceUtc !== attemptSince || scope.attemptUntilUtc !== attemptUntil) failures.push('scope: attempt window mismatch');
  if (scope.safePreParitySubstagePromotion !== true) failures.push('scope: safe pre-parity substage promotion must be explicit');
  if (JSON.stringify(actualAllowed) !== JSON.stringify(expectedAllowed)) failures.push('scope: allowedPaths mismatch');
  const b = scope.boundaries || {};
  for (const key of ['databaseMutation', 'identityMutation', 'passwordMutation', 'credentialMutation', 'mfaMutation', 'sessionMutation', 'resetReplay', 'mailSend', 'runtimeBusinessBehaviorChange', 'securityGateDisabled', 'piiOutput', 'credentialOutput', 'rawLogOutput']) {
    if (b[key] !== false) failures.push(`scope: boundary ${key} must be false`);
  }
  if (b.productionMutation !== 'NONE' || b.databaseReadOnly !== true || b.logReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true || b.newRecurringCostRub !== 0) {
    failures.push('scope: read-only/owner/exact-main/cost boundary mismatch');
  }
}

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = run(['git', 'diff', '--name-only', 'origin/main...HEAD']);
  if (diff.status !== 0) failures.push(`git diff failed: ${diff.stderr.trim()}`);
  else {
    const changed = diff.stdout.trim().split('\n').filter(Boolean).sort();
    const expectedChanged = [runnerPath, checkerPath, scopePath].sort();
    if (JSON.stringify(changed) !== JSON.stringify(expectedChanged)) {
      failures.push(`PR scope mismatch: ${JSON.stringify(changed)}`);
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: fixed run 31781887205 reuses the pinned canonical read-only classifier, rebinds both declaration and remote fail-closed historical guards, and preserves only its bounded pre-parity remote substage marker; reset replay and production mutation remain impossible.');
