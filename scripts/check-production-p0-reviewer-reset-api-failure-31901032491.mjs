#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-api-failure-31901032491.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-api-failure-31901032491.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-api-failure-31901032491.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-api-failure-31901032491-3785.json';
const command = '/production p0-reviewer-reset-api-failure-classify 31901032491 current-main';
const resetRevision = '056ed4461dafb5e7dab2efc9ea5a0d5877523169';
const attemptSince = '2026-08-15T18:24:20Z';
const attemptUntil = '2026-08-15T18:25:05Z';
const allowed = [workflowPath, runnerPath, checkerPath, scopePath];

const read = (p) => fs.readFileSync(p, 'utf8');
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
  `github.event.comment.body == '${command}'`, `node ${checkerPath}`, `bash -n ${runnerPath}`, `bash ${runnerPath}`,
]) need('workflow', workflow, token);
for (const filePath of allowed) need('workflow', workflow, `      - '${filePath}'`);
for (const re of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, re);

for (const token of [
  `COMMAND='${command}'`, `RESET_RUN_ID='31901032491'`, `RESET_REVISION='${resetRevision}'`,
  `ATTEMPT_SINCE='${attemptSince}'`, `ATTEMPT_UNTIL='${attemptUntil}'`,
  'git merge-base --is-ancestor "$RESET_REVISION" "$CURRENT_MAIN"',
  "docker ps -aq --filter 'label=com.docker.compose.service=api'",
  'docker logs --timestamps --since "$attempt_since" --until "$attempt_until"',
  'Password reset challenge/outbox transaction failed',
  'AUTH_MAIL_OUTBOX_RELATION_MISSING', 'AUTH_MAIL_OUTBOX_PERMISSION_DENIED',
  'AUTH_MAIL_OUTBOX_RLS_DENIED', 'DATABASE_PERMISSION_DENIED',
  'UNKNOWN_TRANSACTION_FAILURE', 'raw API logs', 'PRODUCTION_MUTATION=NONE',
]) need('runner', runner, token);
for (const re of [
  /docker\s+(?:rm|rmi|kill|stop|restart|start|exec)\b/,
  /docker\s+compose[^\n]*(?:up|down|restart|rm|pull|build)\b/,
  /\b(?:psql|prisma\s+migrate|kubectl|systemctl|apt-get|dnf|yum)\b/,
  /forgot-password[^\n]*(?:--data|--request\s+POST)/,
  /password-reset\/request[^\n]*(?:--data|--request\s+POST)/,
]) deny('runner', runner, re);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== 'diag/p0-reviewer-reset-api-failure-31901032491-3785' || scope.status !== 'active') failures.push('scope branch/status mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) failures.push('scope authority mismatch');
if (scope.sourceRun !== 31901032491 || scope.sourceRevision !== resetRevision) failures.push('scope source mismatch');
if (scope.attemptSinceUtc !== attemptSince || scope.attemptUntilUtc !== attemptUntil) failures.push('scope window mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope allowedPaths mismatch');
const b = scope.boundaries || {};
if (b.productionMutation !== 'NONE' || b.logReadOnly !== true || b.ownerOnly !== true || b.newRecurringCostRub !== 0) failures.push('scope read-only boundary mismatch');
for (const key of ['databaseMutation','identityMutation','passwordMutation','mfaMutation','sessionMutation','resetReplay','mailSend','deploymentMutation','containerLifecycleMutation','piiOutput','credentialOutput','rawLogOutput']) {
  if (b[key] !== false) failures.push(`scope boundary ${key} must be false`);
}

const syntax = spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`runner bash -n failed: ${syntax.stderr.trim().slice(0, 240)}`);

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = diff.stdout.trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify([...allowed].sort())) failures.push(`PR scope mismatch: ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: reviewer reset API failure classifier is exact-window, owner-only, log-read-only, and publishes whitelist classifications only.');
