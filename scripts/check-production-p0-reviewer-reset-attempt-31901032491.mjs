#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-attempt-31901032491.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-attempt-31901032491.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-attempt-31901032491.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-attempt-31901032491-3785.json';
const canonicalPath = 'scripts/production-p0-reviewer-reset-attempt-classifier.sh';
const canonicalBlob = '7dcfb19d247aab2f0dc8c8075416673499c9dc84';
const branch = 'diag/p0-reviewer-reset-attempt-31901032491-3785';
const command = '/production p0-reviewer-reset-attempt-classify 31901032491 current-main';
const oldRevision = '7c768ad7c54523837b06999a8f69bdffe2a840db';
const sourceRevision = '056ed4461dafb5e7dab2efc9ea5a0d5877523169';
const sourceRun = 31901032491;
const attemptSince = '2026-08-15T18:24:20Z';
const attemptUntil = '2026-08-15T18:25:05Z';
const allowed = [workflowPath, runnerPath, checkerPath, scopePath];

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const workflow = read(workflowPath);
const runner = read(runnerPath);
const canonical = read(canonicalPath);
const scope = JSON.parse(read(scopePath));
const failures = [];
const need = (where, text, token) => { if (!text.includes(token)) failures.push(`${where}: missing ${token}`); };
const deny = (where, text, re) => { if (re.test(text)) failures.push(`${where}: forbidden ${re}`); };

for (const token of [
  'pull_request:', 'issue_comment:', 'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner', 'github.triggering_actor == github.repository_owner',
  `github.event.comment.body == '${command}'`, "needs.contract.result == 'success'",
  `node ${checkerPath}`, `bash -n ${runnerPath}`, `bash ${runnerPath}`,
]) need('workflow', workflow, token);
for (const filePath of allowed) need('workflow', workflow, `      - '${filePath}'`);
for (const re of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, re);

for (const token of [
  `COMMAND='${command}'`, `SOURCE_BLOB='${canonicalBlob}'`, `OLD_SOURCE_REVISION='${oldRevision}'`,
  `SOURCE_REVISION='${sourceRevision}'`, String.raw`[[ \"$source_revision\" == '${sourceRevision}' ]]`,
  `SOURCE_RUN_ID='${sourceRun}'`, `ATTEMPT_SINCE='${attemptSince}'`, `ATTEMPT_UNTIL='${attemptUntil}'`,
  'REMOTE_BINDING_MISMATCH', 'SAFE_SUBSTAGE_BINDING_MISMATCH',
  'POST_TRANSFORM_LINE_MISMATCH', 'POST_TRANSFORM_SUBSTAGE_MISMATCH',
  'POST_TRANSFORM_FRAGMENT_MISMATCH', 'POST_TRANSFORM_OLD_REVISION_COUNT',
  'PC_REVIEWER_RESET_ATTEMPT_VALIDATE_ONLY',
  'if [[ "$remote_failure" =~ ^ATTEMPT_REMOTE_FAILURE\\|',
  'failure_detail="${BASH_REMATCH[1]}_${BASH_REMATCH[2]}_${BASH_REMATCH[3]}_${BASH_REMATCH[4]}"',
  'bash -n "$TMP"', 'PASS: transformed reset 31901032491 classifier preflight', 'bash "$TMP"',
]) need('runner', runner, token);
for (const re of [/\bssh\s/, /\bcurl\s/, /\bdocker\s/, /forgot-password/]) deny('wrapper', runner, re);

const hash = spawnSync('git', ['hash-object', canonicalPath], { encoding: 'utf8' });
if (hash.status !== 0 || hash.stdout.trim() !== canonicalBlob) failures.push('canonical blob mismatch');
const oldCount = canonical.split(oldRevision).length - 1;
if (oldCount !== 3) failures.push(`canonical historical revision count changed: ${oldCount}`);
need('canonical', canonical, `if SOURCE_REVISION != '${oldRevision}':`);
need('canonical', canonical, `[[ "$source_revision" == '${oldRevision}' ]]`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') failures.push('scope branch/status mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) failures.push('scope authority mismatch');
if (scope.sourceRun !== sourceRun || scope.sourceRevision !== sourceRevision) failures.push('scope source mismatch');
if (scope.attemptSinceUtc !== attemptSince || scope.attemptUntilUtc !== attemptUntil) failures.push('scope attempt window mismatch');
if (scope.unrelatedAuthHashHistoricalRevisionCount !== 1) failures.push('scope unrelated historical revision count mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push(`scope allowedPaths mismatch`);
const b = scope.boundaries || {};
if (b.productionMutation !== 'NONE' || b.databaseReadOnly !== true || b.logReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true || b.newRecurringCostRub !== 0) failures.push('scope read-only boundary mismatch');
for (const key of ['databaseMutation','identityMutation','passwordMutation','credentialMutation','mfaMutation','sessionMutation','resetReplay','mailSend','runtimeBusinessBehaviorChange','securityGateDisabled','piiOutput','credentialOutput','rawLogOutput']) {
  if (b[key] !== false) failures.push(`scope boundary ${key} must remain false`);
}

const validateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-p0-reset-31901032491-'));
try {
  const preflight = spawnSync('bash', [runnerPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      RUNNER_TEMP: validateDir,
      PC_REVIEWER_RESET_ATTEMPT_COMMAND: command,
      PC_REVIEWER_RESET_ATTEMPT_VALIDATE_ONLY: '1',
    },
  });
  if (preflight.status !== 0) {
    failures.push(`wrapper transformed preflight failed: status=${preflight.status}; stderr=${preflight.stderr.trim().slice(0, 200)}`);
  } else if (!preflight.stdout.includes('PASS: transformed reset 31901032491 classifier preflight')) {
    failures.push('wrapper transformed preflight did not emit PASS sentinel');
  }
} finally {
  fs.rmSync(validateDir, { recursive: true, force: true });
}

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = diff.stdout.trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify([...allowed].sort())) failures.push(`PR scope mismatch: ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: reset run 31901032491 classifier is read-only, exact-window bound, canonical-blob pinned, and locally validates the complete transformed wrapper before any REG.RU access.');
