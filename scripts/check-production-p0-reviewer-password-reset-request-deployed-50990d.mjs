#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-password-reset-request-deployed-50990d.yml';
const runnerPath = 'scripts/production-p0-reviewer-password-reset-request-deployed-50990d.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-password-reset-request-deployed-50990d.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-password-reset-request-deployed-50990d-3785.json';
const sourcePath = 'scripts/production-p0-reviewer-password-reset-request.sh';
const branch = 'fix/p0-reviewer-reset-fixed-deployed-50990d-3785';
const command = '/production p0-reviewer-reset-request deployed-50990d';
const deployed = '50990d616463c3aa7a4888fc182bc6064931b080';
const mailProofRun = 31918077465;
const mailProofHead = 'ea62c3ffdc2fa323c56e1ad92bbc6b9baeab69d8';
const sourceBlob = '7a586ded1b40ab3812335b351d0e8cc519020aa4';
const allowed = [workflowPath, runnerPath, checkerPath, scopePath];
const hotfixAllowed = [runnerPath, checkerPath];

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const workflow = read(workflowPath);
const runner = read(runnerPath);
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
  `COMMAND='${command}'`, `EXPECTED_DEPLOYED_SHA='${deployed}'`,
  `MAIL_PROOF_RUN_ID='${mailProofRun}'`, `MAIL_PROOF_HEAD_SHA='${mailProofHead}'`,
  `SOURCE_BLOB_SHA='${sourceBlob}'`, "MAIL_PROOF_JOB='Prove sender delivery and materialize auth-mail runtime'",
  'PC_REVIEWER_RESET_DEPLOYED_VALIDATE_ONLY', 'PATCH_CARDINALITY_FAILED',
  'STALE_REVISION_GUARD_REMAINS', 'EXPECTED_REVISION_BINDING_COUNT',
  'git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"',
  'git merge-base --is-ancestor "$MAIL_PROOF_HEAD_SHA" "$TARGET_SHA"',
  'proof_job_count=', 'bash "$temp_script"',
  'PASS: deployed-50990d reviewer reset wrapper transformed safely',
]) need('runner', runner, token);
for (const re of [/StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/, /PASSWORD_RESET_DELIVERY_KEY=/, /SMTP_PASSWORD=/, /reviewer_email=/, /--jq\s+--arg/]) deny('wrapper', runner, re);

const sourceHash = spawnSync('git', ['hash-object', sourcePath], { encoding: 'utf8' });
if (sourceHash.status !== 0 || sourceHash.stdout.trim() !== sourceBlob) failures.push('canonical reset source blob mismatch');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') failures.push('scope branch/status mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) failures.push('scope authority mismatch');
if (scope.expectedDeployedRevision !== deployed || scope.mailProofRun !== mailProofRun || scope.mailProofHeadRevision !== mailProofHead) failures.push('scope revision/proof binding mismatch');
if (scope.sourceResetScriptBlob !== sourceBlob || scope.command !== command) failures.push('scope source/command mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope allowedPaths mismatch');
const b = scope.boundaries || {};
if (b.productionMutation !== 'ONE_NORMAL_PASSWORD_RESET_REQUEST_ONLY' || b.databaseMutation !== true || b.mailSendExpected !== true) failures.push('scope mutation truth mismatch');
for (const key of ['identityMutation','passwordMutation','mfaMutation','sessionMutation','deploymentMutation','runtimeFileMutation','resetReplay','credentialOutput','piiOutput','resetTokenOutput','rawLogOutput']) {
  if (b[key] !== false) failures.push(`scope boundary ${key} must be false`);
}
for (const key of ['ownerOnly','exactMainGuard','fixedProductionRevisionGuard','apiWebWorkerParityRequired','workerHealthRequired','freshMailProofRequired']) {
  if (b[key] !== true) failures.push(`scope boundary ${key} must be true`);
}
if (b.newRecurringCostRub !== 0) failures.push('scope recurring cost must be 0');

const validateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-reset-deployed-50990d-'));
try {
  const preflight = spawnSync('bash', [runnerPath], {
    encoding: 'utf8',
    env: { ...process.env, RUNNER_TEMP: validateDir, PC_REVIEWER_RESET_DEPLOYED_VALIDATE_ONLY: '1' },
  });
  if (preflight.status !== 0) failures.push(`wrapper transform preflight failed: ${preflight.stderr.trim().slice(0, 300)}`);
  else if (!preflight.stdout.includes('PASS: deployed-50990d reviewer reset wrapper transformed safely')) failures.push('wrapper PASS sentinel missing');
} finally {
  fs.rmSync(validateDir, { recursive: true, force: true });
}

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = diff.stdout.trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify([...hotfixAllowed].sort())) failures.push(`PR hotfix scope mismatch: ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: fixed-deployed reviewer reset is pinned to deployed 50990d, current durable reset source, successful mail proof, worker parity/health, one ordinary reset request, and zero credential/PII/token output.');
