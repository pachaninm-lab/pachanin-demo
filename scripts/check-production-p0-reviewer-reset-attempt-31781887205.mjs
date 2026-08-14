#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-attempt-31781887205.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-attempt-31781887205.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-attempt-31781887205.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-attempt-31781887205-3785.json';
const canonicalPath = 'scripts/production-p0-reviewer-reset-attempt-classifier.sh';
const canonicalBlob = '7dcfb19d247aab2f0dc8c8075416673499c9dc84';
const branch = 'diag/p0-reviewer-reset-attempt-31781887205-stale-revision-3785';
const command = '/production p0-reviewer-reset-attempt-classify 31781887205 current-main';
const oldRevision = '7c768ad7c54523837b06999a8f69bdffe2a840db';
const sourceRevision = 'dc5bec67faeaec26ce905c0643dc15d35f99bf50';
const allowed = [workflowPath, runnerPath, checkerPath, scopePath];

const read = (path) => fs.readFileSync(path, 'utf8');
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
  `github.event.comment.body == '${command}'`, 'needs.contract.result == \'success\'',
  `node ${checkerPath}`, `bash -n ${runnerPath}`, `bash ${runnerPath}`,
]) need('workflow', workflow, token);
for (const path of allowed) need('workflow', workflow, `      - '${path}'`);
for (const re of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, re);

for (const token of [
  `COMMAND='${command}'`, `SOURCE_BLOB='${canonicalBlob}'`, `OLD_SOURCE_REVISION='${oldRevision}'`,
  `SOURCE_REVISION='${sourceRevision}'`, String.raw`[[ \"$source_revision\" == '${sourceRevision}' ]]`,
  'REMOTE_BINDING_MISMATCH', 'SAFE_SUBSTAGE_BINDING_MISMATCH',
  String.raw`if [[ \"$remote_failure\" =~ ^ATTEMPT_REMOTE_FAILURE`,
  `grep -Fq \"if SOURCE_REVISION != '$OLD_SOURCE_REVISION':\" \"$TMP\"`,
  `[[ \"$(grep -Fc \"$OLD_SOURCE_REVISION\" \"$TMP\")\" == '1' ]]`,
  `! grep -Fq \"SOURCE_REVISION='$OLD_SOURCE_REVISION'\" \"$TMP\"`,
  'bash -n "$TMP"', 'bash "$TMP"',
]) need('runner', runner, token);
for (const re of [/\bssh\s/, /\bcurl\s/, /\bdocker\s/, /forgot-password/]) deny('wrapper', runner, re);

const hash = spawnSync('git', ['hash-object', canonicalPath], { encoding: 'utf8' });
if (hash.status !== 0 || hash.stdout.trim() !== canonicalBlob) failures.push('canonical blob mismatch');
const oldCount = canonical.split(oldRevision).length - 1;
if (oldCount !== 3) failures.push(`canonical historical revision count changed: ${oldCount}`);
need('canonical', canonical, `if SOURCE_REVISION != '${oldRevision}':`);
need('canonical', canonical, `[[ "$source_revision" == '${oldRevision}' ]]`);

if (scope.branch !== branch) failures.push('scope branch mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) failures.push('scope authority mismatch');
if (scope.sourceRun !== 31781887205 || scope.sourceRevision !== sourceRevision) failures.push('scope source mismatch');
if (scope.unrelatedAuthHashHistoricalRevisionCount !== 1) failures.push('scope unrelated historical revision count mismatch');
const b = scope.boundaries || {};
if (b.productionMutation !== 'NONE' || b.databaseReadOnly !== true || b.logReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true || b.newRecurringCostRub !== 0) failures.push('scope read-only boundary mismatch');
for (const key of ['databaseMutation','identityMutation','passwordMutation','credentialMutation','mfaMutation','sessionMutation','resetReplay','mailSend','runtimeBusinessBehaviorChange','securityGateDisabled','piiOutput','credentialOutput','rawLogOutput']) {
  if (b[key] !== false) failures.push(`scope boundary ${key} must remain false`);
}

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = diff.stdout.trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify([...allowed.slice(1)].sort())) failures.push(`PR scope mismatch: ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: the one-off classifier remains read-only, pins the canonical blob, rebinds only RESET_ATTEMPT historical bindings, and permits exactly one unrelated auth-hash historical revision sentinel.');
