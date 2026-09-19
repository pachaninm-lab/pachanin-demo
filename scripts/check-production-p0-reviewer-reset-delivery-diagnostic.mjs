#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-delivery-diagnostic.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-delivery-diagnostic.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-delivery-diagnostic-3785.json';
const command = '/production p0-reviewer-reset-delivery-diagnose 31667978433';
const deployed = 'd2dd7972105cc59002263455b5ae0eb8d8f2d386';
const since = '2026-08-13T04:45:10Z';
const until = '2026-08-13T04:45:24Z';

const fail = (message) => {
  console.error(`reviewer reset delivery diagnostic contract: ${message}`);
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
  'bash scripts/production-p0-reviewer-reset-delivery-diagnostic.sh',
]) requireText(workflow, needle, 'workflow');

for (const needle of [
  `COMMAND='${command}'`,
  `SOURCE_RUN_ID='31667978433'`,
  `EXPECTED_DEPLOYED_SHA='${deployed}'`,
  `LOG_SINCE='${since}'`,
  `LOG_UNTIL='${until}'`,
  'docker ps -aq',
  'label=com.docker.compose.project=$project',
  'label=com.docker.compose.service=web',
  '"org.opencontainers.image.revision"',
  "remote_substage='RETAINED_CONTAINER_DISCOVERY'",
  "remote_substage='RETAINED_CONTAINER_ZERO'",
  "remote_substage='RETAINED_CONTAINER_MULTIPLE'",
  "printf 'RETAINED_CONTAINER_CARDINALITY=%s\\n' \"$remote_retained_cardinality\"",
  "docker logs --since \"$log_since\" --until \"$log_until\"",
  "grep -F 'password_reset_delivery_result'",
  "printf 'DIAGNOSTIC_FAILURE_SUBSTAGE=%s\\n' \"$remote_substage\"",
  "printf 'DELIVERY_LOG_CARDINALITY=%s\\n' \"$remote_cardinality\"",
  "remote_cardinality='ZERO'",
  "remote_cardinality='ONE'",
  "remote_cardinality='MULTIPLE'",
  "failure_substage='REMOTE_EXECUTION'",
  'RETAINED_CONTAINER_CARDINALITY=ONE',
  'DELIVERY_LOG_COUNT=1',
  'SOURCE_REVISION_RECOVERY=PASS',
  'MAIL_SENT_BY_DIAGNOSTIC=NO',
  'PRODUCTION_MUTATION=NONE',
  'StrictHostKeyChecking=yes',
  'git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$MAIN_SHA"',
]) requireText(script, needle, 'script');

for (const stale of [
  "remote_substage='REVISION_PARITY_BEFORE'",
  "remote_substage='REVISION_PARITY_AFTER'",
  'PROD_REVISION_PARITY=PASS',
]) {
  if (script.includes(stale)) fail(`stale current-revision parity dependency remains: ${stale}`);
}

const forbidden = [
  /\bcurl\b/,
  /\bdocker\s+exec\b/,
  /\bdocker\s+(?:run|rm|start|stop|restart|kill|update|rename)\b/,
  /\bdocker\s+container\s+(?:rm|start|stop|restart|kill|update|rename)\b/,
  /\bdocker\s+compose\s+(?:up|down|start|stop|restart|rm|kill)\b/,
  /\bpsql\b/,
  /PrismaClient/,
  /\/api\/auth\/forgot-password/,
  /auth\/password-reset\/request/,
  /\bPOST\b/,
  /MAIL FROM:/,
  /RCPT TO:/,
  /AUTH PLAIN/,
  /sendTransactionalMail/,
  /password_reset_challenges\s+(?:SET|UPDATE|INSERT|DELETE)/i,
];
for (const pattern of forbidden) {
  if (pattern.test(script)) fail(`script contains forbidden mutation/send surface: ${pattern}`);
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schemaVersion');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope issue binding');
if (scope.deployedRevision !== deployed) fail('scope deployed revision');
const expectedPaths = [workflowPath, scriptPath, 'scripts/check-production-p0-reviewer-reset-delivery-diagnostic.mjs', scopePath].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) fail('scope allowedPaths');

const acceptance = Array.isArray(scope.acceptance) ? scope.acceptance.join('\n') : '';
for (const needle of [
  'retained historical web container',
  'current running production revision may have advanced',
  'exactly one retained web container with OCI revision d2dd7972105cc59002263455b5ae0eb8d8f2d386',
]) requireText(acceptance, needle, 'scope acceptance');

const b = scope.boundaries || {};
const requiredFalse = [
  'databaseMutation', 'identityMutation', 'passwordMutation', 'credentialMutation',
  'mfaMutation', 'sessionMutation', 'mailSend', 'runtimeBusinessBehaviorChange',
  'securityGateDisabled', 'piiOutput', 'credentialOutput',
];
if (b.productionMutation !== 'NONE') fail('scope productionMutation');
for (const key of requiredFalse) if (b[key] !== false) fail(`scope ${key}`);
if (b.logReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true) fail('scope read-only/owner/exact-main boundary');
if (b.newRecurringCostRub !== 0) fail('scope recurring cost');

console.log('reviewer reset delivery diagnostic contract: PASS');
