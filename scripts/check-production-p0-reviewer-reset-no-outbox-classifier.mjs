#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const wrapperPath = 'scripts/production-p0-reviewer-reset-no-outbox-classifier.sh';
const sourcePath = 'scripts/production-p0-reviewer-reset-attempt-classifier.sh';
const workflowPath = '.github/workflows/production-p0-reviewer-reset-no-outbox-classifier.yml';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-no-outbox-classifier-3785.json';

const read = (path) => fs.readFileSync(path, 'utf8');
const wrapper = read(wrapperPath);
const source = read(sourcePath);
const workflow = read(workflowPath);
const scope = JSON.parse(read(scopePath));
const sourceBlob = execFileSync('git', ['hash-object', sourcePath], { encoding: 'utf8' }).trim();

const requireAll = (label, text, values) => {
  const missing = values.filter((value) => !text.includes(value));
  if (missing.length) throw new Error(`${label} missing: ${missing.join(' | ')}`);
};
const forbidAll = (label, text, values) => {
  const found = values.filter((value) => text.includes(value));
  if (found.length) throw new Error(`${label} forbidden: ${found.join(' | ')}`);
};

if (sourceBlob !== '7dcfb19d247aab2f0dc8c8075416673499c9dc84') {
  throw new Error(`reviewed source blob drifted: ${sourceBlob}`);
}
requireAll('source classifier', source, [
  "reason = 'COOLDOWN_ACTIVE'",
  "reason = 'DELIVERY_BOUNDARY_REJECTED'",
  "reason = 'UNIVERSAL_NON_ELIGIBLE'",
  "[[ \"$source_revision\" == '7c768ad7c54523837b06999a8f69bdffe2a840db' ]]",
  "[[ \"$attempt_since\" == '2026-08-13T13:43:10Z' ]]",
  "[[ \"$attempt_until\" == '2026-08-13T13:43:26Z' ]]",
  "${PC_REVIEWER_RESET_ATTEMPT_COMMAND:?PC_REVIEWER_RESET_ATTEMPT_COMMAND is required}",
  'StrictHostKeyChecking=yes',
]);

requireAll('wrapper', wrapper, [
  "COMMAND='/production p0-reviewer-reset-no-outbox-classify current-main'",
  "SOURCE_SCRIPT='scripts/production-p0-reviewer-reset-attempt-classifier.sh'",
  "SOURCE_BLOB_SHA='7dcfb19d247aab2f0dc8c8075416673499c9dc84'",
  "HISTORICAL_REVISION='440e40753e2cac13c93f8e007d9fe17c2b66caba'",
  "SOURCE_EVIDENCE_COMMENT_ID='5308999892'",
  "ATTEMPT_SINCE='2026-08-16T18:24:53Z'",
  "ATTEMPT_UNTIL='2026-08-16T18:28:00Z'",
  "[[ \\\"$source_revision\\\" == '7c768ad7c54523837b06999a8f69bdffe2a840db' ]]",
  "[[ \\\"$source_revision\\\" == '440e40753e2cac13c93f8e007d9fe17c2b66caba' ]]",
  "[[ \\\"$attempt_since\\\" == '2026-08-13T13:43:10Z' ]]",
  "[[ \\\"$attempt_since\\\" == '2026-08-16T18:24:53Z' ]]",
  "[[ \\\"$attempt_until\\\" == '2026-08-13T13:43:26Z' ]]",
  "[[ \\\"$attempt_until\\\" == '2026-08-16T18:28:00Z' ]]",
  "git merge-base --is-ancestor \"$HISTORICAL_REVISION\" \"$TARGET_SHA\"",
  'git hash-object "$SOURCE_SCRIPT"',
  'PC_REVIEWER_RESET_ATTEMPT_COMMAND="$COMMAND"',
  'bash "$TEMP_SCRIPT"',
  "reason = 'COOLDOWN_ACTIVE'",
  "reason = 'DELIVERY_BOUNDARY_REJECTED'",
  "reason = 'UNIVERSAL_NON_ELIGIBLE'",
]);
forbidAll('wrapper', wrapper, [
  'curl -X POST',
  '--request POST',
  '/forgot-password',
  'INSERT INTO',
  'UPDATE auth.',
  'DELETE FROM',
  'TRUNCATE ',
  'ALTER ROLE',
  'CREATE ROLE',
  'DROP ROLE',
  'docker restart',
  'docker compose',
  'StrictHostKeyChecking=no',
  'UserKnownHostsFile=/dev/null',
  'REVIEWER_PASSWORD=',
  'REVIEWER_TOTP=',
]);

requireAll('workflow', workflow, [
  'name: Production P0 Reviewer Reset No-Outbox Classifier',
  'issue_comment:',
  'github.event.issue.number == 3072',
  "github.event.comment.author_association == 'OWNER'",
  "github.event.comment.body == '/production p0-reviewer-reset-no-outbox-classify current-main'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  'scripts/check-production-p0-reviewer-reset-no-outbox-classifier.mjs',
  'scripts/production-p0-reviewer-reset-no-outbox-classifier.sh',
  'persist-credentials: false',
]);
forbidAll('workflow', workflow, [
  'workflow_dispatch:',
  'pull_request_target:',
  'contents: write',
  'actions: write',
  'StrictHostKeyChecking=no',
]);

const expectedPaths = [
  '.github/workflows/production-p0-reviewer-reset-no-outbox-classifier.yml',
  'scripts/production-p0-reviewer-reset-no-outbox-classifier.sh',
  'scripts/check-production-p0-reviewer-reset-no-outbox-classifier.mjs',
  'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-no-outbox-classifier-3785.json',
];
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope schemaVersion invalid');
if (scope.branch !== 'fix/p0-reviewer-reset-no-outbox-classifier-3785') throw new Error('scope branch invalid');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) throw new Error('scope authority invalid');
if (JSON.stringify(scope.allowedPaths) !== JSON.stringify(expectedPaths)) throw new Error('scope allowedPaths invalid');
const b = scope.boundaries || {};
const exact = {
  productionMutation: 'NONE', databaseMutation: false, identityMutation: false,
  passwordMutation: false, credentialMutation: false, mfaMutation: false,
  sessionMutation: false, resetReplay: false, mailSend: false,
  databaseReadOnly: true, logReadOnly: true, ownerOnly: true,
  exactMainGuard: true, piiOutput: false, credentialOutput: false,
  rawLogOutput: false, newRecurringCostRub: 0,
};
for (const [key, value] of Object.entries(exact)) {
  if (b[key] !== value) throw new Error(`scope boundary invalid: ${key}`);
}

console.log('production-p0-reviewer-reset-no-outbox-classifier contract: PASS');
