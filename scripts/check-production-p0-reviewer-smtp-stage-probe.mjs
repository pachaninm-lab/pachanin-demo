#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-smtp-stage-probe.yml';
const scriptPath = 'scripts/production-p0-reviewer-smtp-stage-probe.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-smtp-stage-probe.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-smtp-stage-probe-4136.json';
const mailPath = 'apps/web/lib/server/transactional-mail.ts';
const branch = 'diag/p0-reviewer-smtp-stage-4136';
const command = '/production p0-reviewer-smtp-stage-probe current-main';
const deployed = '7b66f65f8fc7fc4bbedb56c94088ad1473462c92';
const allowed = [workflowPath, scriptPath, checkerPath, scopePath];

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const mail = fs.readFileSync(mailPath, 'utf8');
const failures = [];
const need = (where, text, token) => { if (!text.includes(token)) failures.push(`${where}: missing ${token}`); };
const deny = (where, text, re) => { if (re.test(text)) failures.push(`${where}: forbidden ${re}`); };

for (const token of [
  'pull_request:', 'issue_comment:', 'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.actor == github.repository_owner', 'github.triggering_actor == github.repository_owner',
  `github.event.comment.body == '${command}'`,
  `node ${checkerPath}`, `bash -n ${scriptPath}`, `bash ${scriptPath}`,
  'needs.contract.outputs.target_sha',
]) need('workflow', workflow, token);
for (const path of allowed) need('workflow', workflow, `      - '${path}'`);
for (const re of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, re);

for (const token of [
  `COMMAND='${command}'`, `EXPECTED_DEPLOYED_SHA='${deployed}'`,
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "auth.staff_reviewer_password_reset_subject() AS reviewer_email",
  "counts.join('|') !== '1|1|1|1|1|0|0|0'",
  "host != 'mail.hosting.reg.ru'", 'port != 465',
  "b'EHLO transparent-price.local'", "b'AUTH PLAIN ' + auth",
  "f'MAIL FROM:<{sender}>'", "f'RCPT TO:<{recipient}>'",
  "sock.sendall(b'RSET\\r\\n')", "sock.sendall(b'QUIT\\r\\n')",
  "print('MAIL_SENT=NO')", "print('PRODUCTION_MUTATION=NONE')",
  'StrictHostKeyChecking=yes', 'UserKnownHostsFile="$known_hosts"',
  'reviewer identity / sender / SMTP credentials / raw protocol output',
]) need('script', script, token);

for (const re of [
  /api\/auth\/forgot-password/i,
  /forgot-password\?lang=/i,
  /socket\.sendall\(b['"]DATA/i,
  /\bawait\s+command\([^\n]*['"]DATA['"]/i,
  /docker\s+(?:run|rm|start|stop|restart|kill|update)\b/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
  /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b[\s\S]{0,30}\b(?:users|password|challenge|session|mfa)\b/i,
]) deny('script', script, re);

for (const token of [
  'const MAIL_TIMEOUT_MS = 5_000;',
  "'EHLO transparent-price.local'",
  '`AUTH PLAIN ${Buffer.from(',
  '`MAIL FROM:<${from}>`', '`RCPT TO:<${to}>`',
]) need('transactional-mail', mail, token);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') failures.push('scope branch/status mismatch');
if (scope.issue !== 4136 || scope.registrationMatrixIssue !== 3785 || scope.releaseIssue !== 3072) failures.push('scope authority mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope allowedPaths mismatch');
const b = scope.boundaries || {};
for (const [key, expected] of Object.entries({
  productionMutation: 'NONE',
  databaseMutation: false,
  passwordResetRequest: false,
  mailSend: false,
  smtpAuthAttempt: true,
  smtpMailFromProbe: true,
  smtpRecipientProbe: true,
  smtpDataCommand: false,
  reviewerIdentityAccess: true,
  reviewerIdentityOutput: false,
  credentialOutput: false,
  rawProtocolOutput: false,
  deploymentMutation: false,
  containerLifecycleMutation: false,
  ownerOnly: true,
  exactMainGuard: true,
  fixedDeployedRevision: deployed,
  newRecurringCostRub: 0,
})) {
  if (b[key] !== expected) failures.push(`scope boundary ${key} mismatch`);
}
if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') failures.push('scope hosting mismatch');

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = diff.stdout.trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify([...allowed].sort())) {
    failures.push(`PR scope mismatch: ${JSON.stringify(changed)}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: reviewer SMTP stage probe is owner-only, exact-main guarded, fixed-deployed, reviewer-private, and cannot send mail or replay reset.');
