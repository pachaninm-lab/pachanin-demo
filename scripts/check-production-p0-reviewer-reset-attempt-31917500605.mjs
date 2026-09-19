#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-attempt-31917500605.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-attempt-31917500605.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-attempt-31917500605.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-attempt-31917500605-3785.json';
const canonicalPath = 'scripts/production-p0-reviewer-reset-attempt-classifier.sh';
const canonicalBlob = '7dcfb19d247aab2f0dc8c8075416673499c9dc84';
const branch = 'diag/p0-reviewer-reset-attempt-31917500605-3785';
const command = '/production p0-reviewer-reset-attempt-classify 31917500605 current-main';
const sourceRevision = '50990d616463c3aa7a4888fc182bc6064931b080';
const sourceRun = 31917500605;
const attemptSince = '2026-08-16T00:33:48Z';
const attemptUntil = '2026-08-16T00:35:28Z';
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
  `COMMAND='${command}'`, `SOURCE_BLOB='${canonicalBlob}'`, `SOURCE_REVISION='${sourceRevision}'`,
  `SOURCE_RUN_ID='${sourceRun}'`, `ATTEMPT_SINCE='${attemptSince}'`, `ATTEMPT_UNTIL='${attemptUntil}'`,
  'REMOTE_BINDING_MISMATCH', 'SAFE_SUBSTAGE_BINDING_MISMATCH',
  'POST_TRANSFORM_LINE_MISMATCH', 'POST_TRANSFORM_SUBSTAGE_MISMATCH',
  'PC_REVIEWER_RESET_ATTEMPT_VALIDATE_ONLY',
  'PASS: transformed reset 31917500605 classifier preflight',
]) need('runner', runner, token);
for (const re of [/\bssh\s/, /\bcurl\s/, /\bdocker\s/, /forgot-password/]) deny('wrapper', runner, re);

const hash = spawnSync('git', ['hash-object', canonicalPath], { encoding: 'utf8' });
if (hash.status !== 0 || hash.stdout.trim() !== canonicalBlob) failures.push('canonical blob mismatch');
for (const token of ['COOLDOWN_ACTIVE', 'UNIVERSAL_NON_ELIGIBLE', 'auth.password_reset.request']) need('canonical', canonical, token);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') failures.push('scope branch/status mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) failures.push('scope authority mismatch');
if (scope.sourceRun !== sourceRun || scope.sourceRevision !== sourceRevision) failures.push('scope source mismatch');
if (scope.attemptSinceUtc !== attemptSince || scope.attemptUntilUtc !== attemptUntil) failures.push('scope attempt window mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope allowedPaths mismatch');
const b = scope.boundaries || {};
if (b.productionMutation !== 'NONE' || b.databaseReadOnly !== true || b.logReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true || b.newRecurringCostRub !== 0) failures.push('scope read-only boundary mismatch');
for (const key of ['databaseMutation','identityMutation','passwordMutation','credentialMutation','mfaMutation','sessionMutation','resetReplay','mailSend','runtimeBusinessBehaviorChange','securityGateDisabled','piiOutput','credentialOutput','rawLogOutput']) {
  if (b[key] !== false) failures.push(`scope boundary ${key} must remain false`);
}

const validateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-p0-reset-31917500605-'));
try {
  const preflight = spawnSync('bash', [runnerPath], {
    encoding: 'utf8',
    env: { ...process.env, RUNNER_TEMP: validateDir, PC_REVIEWER_RESET_ATTEMPT_COMMAND: command, PC_REVIEWER_RESET_ATTEMPT_VALIDATE_ONLY: '1' },
  });
  if (preflight.status !== 0) failures.push(`wrapper preflight failed: ${preflight.stderr.trim().slice(0, 200)}`);
  else if (!preflight.stdout.includes('PASS: transformed reset 31917500605 classifier preflight')) failures.push('wrapper PASS sentinel missing');
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
console.log('PASS: reset run 31917500605 classifier is read-only, exact-window bound, canonical-blob pinned, and can distinguish COOLDOWN_ACTIVE from UNIVERSAL_NON_ELIGIBLE without replay.');
