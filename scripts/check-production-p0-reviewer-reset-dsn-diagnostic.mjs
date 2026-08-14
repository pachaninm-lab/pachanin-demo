#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-dsn-diagnostic.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-dsn-diagnostic.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-dsn-diagnostic-3785.json';
const command = '/production p0-reviewer-reset-dsn-diagnose 31757284161';
const sourceRun = '31757284161';
const sourceSha = 'df395bf02604d2445be625b59dd01099590d58d7';

const fail = (message) => {
  console.error(`reviewer reset DSN diagnostic contract: ${message}`);
  process.exit(1);
};
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) fail(`${label}: missing ${JSON.stringify(needle)}`);
};

for (const path of [workflowPath, scriptPath, scopePath]) {
  if (!fs.existsSync(path)) fail(`missing ${path}`);
}

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

for (const needle of [
  command,
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  "node-version: '24'",
  'persist-credentials: false',
  'bash scripts/production-p0-reviewer-reset-dsn-diagnostic.sh',
]) requireText(workflow, needle, 'workflow');

for (const needle of [
  `COMMAND='${command}'`,
  `SOURCE_RUN_ID='${sourceRun}'`,
  `SOURCE_DEPLOYED_SHA='${sourceSha}'`,
  'git merge-base --is-ancestor "$SOURCE_DEPLOYED_SHA" "$TARGET_SHA"',
  'StrictHostKeyChecking=yes',
  '.pc-transactional-mail.env',
  'imaplib.IMAP4_SSL',
  'mailbox.select("INBOX", readonly=True)',
  'BODY.PEEK',
  'RESET_SUBJECT = "Прозрачная Цена — восстановление доступа"',
  'RESET_DSN_MATCH_CARDINALITY=',
  'RESET_DSN_ACTION=',
  'RESET_DSN_STATUS=',
  'RESET_DSN_REMOTE_MTA=',
  'SMTP_AUTH_USER_EQUALS_MAIL_FROM=',
  'IMAP_READ_ONLY=1',
  'MAIL_SENT_BY_DIAGNOSTIC=NO',
  'MAILBOX_MUTATION=NONE',
  'PRODUCTION_MUTATION=NONE',
]) requireText(script, needle, 'script');

const forbidden = [
  /\bcurl\b/,
  /\bdocker\s+exec\b/,
  /\bdocker\s+(?:run|rm|start|stop|restart|kill|update|rename)\b/,
  /\bpsql\b/,
  /PrismaClient/,
  /mailbox\.(?:store|expunge|delete|append|create|rename|subscribe|unsubscribe)\s*\(/i,
];
for (const pattern of forbidden) {
  if (pattern.test(script)) fail(`script contains forbidden mutation surface: ${pattern}`);
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schemaVersion');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope issue binding');
if (scope.sourceRun !== Number(sourceRun)) fail('scope source run');
if (scope.deployedRevision !== sourceSha) fail('scope deployed revision');
if (scope.branch !== 'diag/p0-reviewer-reset-dsn-31757284161-3785') fail('scope branch');
const expectedPaths = [workflowPath, scriptPath, 'scripts/check-production-p0-reviewer-reset-dsn-diagnostic.mjs', scopePath].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) fail('scope allowedPaths');

const b = scope.boundaries || {};
const requiredFalse = [
  'databaseMutation', 'identityMutation', 'passwordMutation', 'credentialMutation',
  'mfaMutation', 'sessionMutation', 'mailSend', 'mailboxMutation',
  'runtimeBusinessBehaviorChange', 'securityGateDisabled', 'piiOutput', 'credentialOutput',
];
if (b.productionMutation !== 'NONE') fail('scope productionMutation');
for (const key of requiredFalse) if (b[key] !== false) fail(`scope ${key}`);
if (b.mailboxReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true) fail('scope read-only/owner/exact-main boundary');
if (b.newRecurringCostRub !== 0) fail('scope recurring cost');

console.log('reviewer reset DSN diagnostic contract: PASS');
