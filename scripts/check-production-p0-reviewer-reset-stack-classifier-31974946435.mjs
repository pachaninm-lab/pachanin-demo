#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-stack-classifier-31974946435.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-stack-classifier-31974946435.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-stack-classifier-31974946435.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-stack-classifier-31974946435-3785.json';
const command = '/production p0-reviewer-reset-stack-classify 31974946435 current-main';
const allowed = [workflowPath, scriptPath, checkerPath, scopePath];
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const failures = [];
const need = (where, text, token) => { if (!text.includes(token)) failures.push(`${where}: missing ${token}`); };
const deny = (where, text, regex) => { if (regex.test(text)) failures.push(`${where}: forbidden ${regex}`); };

for (const token of [
  'pull_request:', 'issue_comment:', 'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  `github.event.comment.body == '${command}'`,
  "needs.contract.result == 'success'",
  `node ${checkerPath}`,
  `bash -n ${scriptPath}`,
  `bash ${scriptPath}`,
]) need('workflow', workflow, token);
for (const path of allowed) need('workflow', workflow, `      - '${path}'`);
for (const regex of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, regex);

for (const token of [
  `COMMAND='${command}'`,
  "RESET_RUN_ID='31974946435'",
  "RESET_REVISION='440e40753e2cac13c93f8e007d9fe17c2b66caba'",
  "ATTEMPT_SINCE='2026-08-16T21:57:20Z'",
  "ATTEMPT_UNTIL='2026-08-16T21:59:06Z'",
  'Password reset challenge/outbox transaction failed',
  'marker_count="$(grep -Fc',
  '[[ "$marker_count" == \'1\' ]]',
  'docker logs --since "$since" --until "$until"',
  "source_stage='AUTH_MAIL_ENQUEUE'",
  "source_stage='AUTH_AUDIT'",
  "source_stage='PASSWORD_RESET_REPOSITORY'",
  "resource_class='AUTH_AUDIT_EVENTS'",
  "resource_class='PASSWORD_RESET_CHALLENGES'",
  'SQLSTATE_42501',
  'PRODUCTION_MUTATION=NONE',
  'raw logs / PII / credentials / reset material',
]) need('script', script, token);
for (const regex of [
  /password-reset\/request/, /forgot-password/, /password-reset\/confirm/, /\bcurl\s/,
  /docker\s+exec/, /docker\s+(restart|stop|rm|kill)/, /docker\s+compose\s+(up|down|restart)/,
  /\bpsql\b/, /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bALTER\b/i, /\bGRANT\b/i, /\bREVOKE\b/i,
]) deny('script', script, regex);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== 'diag/p0-reviewer-reset-stack-31974946435-3785' || scope.status !== 'active') failures.push('scope identity mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072 || scope.sourceRun !== 31974946435) failures.push('scope authority mismatch');
if (scope.sourceRevision !== '440e40753e2cac13c93f8e007d9fe17c2b66caba') failures.push('scope revision mismatch');
if (scope.attemptSinceUtc !== '2026-08-16T21:57:20Z' || scope.attemptUntilUtc !== '2026-08-16T21:59:06Z') failures.push('scope window mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope paths mismatch');
const b = scope.boundaries || {};
for (const key of ['databaseMutation','identityMutation','passwordMutation','mfaMutation','sessionMutation','resetReplay','mailSend','deploymentMutation','containerLifecycleMutation','databaseRead','piiOutput','credentialOutput','rawLogOutput']) {
  if (b[key] !== false) failures.push(`scope boundary ${key}`);
}
if (b.productionMutation !== 'NONE' || b.logReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true || b.exactHistoricalRevision !== true || b.boundedUtcWindow !== true || b.newRecurringCostRub !== 0) {
  failures.push('scope core boundary mismatch');
}

const syntax = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`bash syntax failed: ${String(syntax.stderr).slice(0, 200)}`);
if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = String(diff.stdout).trim().split('\n').filter(Boolean).sort();
  const outOfScope = changed.filter((file) => !allowed.includes(file));
  if (diff.status !== 0 || changed.length === 0 || outOfScope.length) failures.push(`PR scope mismatch ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: reset 31974946435 classifier is owner-bound, exact-revision, exact-window, log-read-only, secret-safe and mutation-free.');
