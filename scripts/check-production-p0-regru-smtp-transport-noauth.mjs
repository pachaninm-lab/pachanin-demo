#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-regru-smtp-transport-noauth.yml';
const probePath = 'scripts/production-p0-regru-smtp-transport-noauth.py';
const checkerPath = 'scripts/check-production-p0-regru-smtp-transport-noauth.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-regru-smtp-transport-noauth-3785.json';
const command = '/production p0-regru-smtp-transport-diagnose current-main';

const fail = (m) => { console.error(`REG.RU SMTP transport no-auth contract: ${m}`); process.exit(1); };
const need = (text, needle, where) => { if (!text.includes(needle)) fail(`${where}: missing ${JSON.stringify(needle)}`); };

for (const path of [workflowPath, probePath, checkerPath, scopePath]) {
  if (!fs.existsSync(path)) fail(`missing ${path}`);
}

const workflow = fs.readFileSync(workflowPath, 'utf8');
const probe = fs.readFileSync(probePath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

for (const needle of [
  command,
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  'persist-credentials: false',
  'python3 scripts/production-p0-regru-smtp-transport-noauth.py',
  'AUTH_ATTEMPT',
  'MAIL_SENT',
  'PRODUCTION_MUTATION',
]) need(workflow, needle, 'workflow');

for (const needle of [
  'HOST = "mail.hosting.reg.ru"',
  'smtplib.SMTP_SSL(HOST, 465',
  'smtplib.SMTP(HOST, 587',
  'client.starttls(context=context)',
  'AUTH_ATTEMPT',
  'MAIL_SENT',
  'PRODUCTION_MUTATION',
]) need(probe, needle, 'probe');

for (const pattern of [
  /\.login\s*\(/,
  /\.auth\s*\(/,
  /send_message\s*\(/,
  /sendmail\s*\(/,
  /MAIL\s+FROM/i,
  /RCPT\s+TO/i,
  /password/i,
  /token/i,
  /secret/i,
  /forgot-password/i,
  /docker\s+exec/i,
  /\bpsql\b/i,
]) {
  if (pattern.test(probe)) fail(`probe contains forbidden auth/send/mutation surface: ${pattern}`);
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schemaVersion');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope issue binding');
const expectedPaths = [workflowPath, probePath, checkerPath, scopePath].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) fail('scope allowedPaths');
const b = scope.boundaries || {};
if (b.productionMutation !== 'NONE') fail('scope productionMutation');
for (const key of ['databaseMutation','identityMutation','passwordMutation','credentialMutation','mfaMutation','sessionMutation','mailSend','authAttempt','runtimeBusinessBehaviorChange','securityGateDisabled','piiOutput','credentialOutput']) {
  if (b[key] !== false) fail(`scope ${key}`);
}
if (b.networkReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true) fail('scope read-only/owner/exact-main boundary');
if (b.newRecurringCostRub !== 0) fail('scope recurring cost');

console.log('REG.RU SMTP transport no-auth contract: PASS');
