#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-attempt-classifier.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-attempt-classifier.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-attempt-classifier.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-attempt-classifier-3785.json';
const autopilotPath = 'docs/platform-v7/autopilot/autopilot-state.json';
const branch = 'diag/p0-reviewer-reset-attempt-classifier-3785';
const command = '/production p0-reviewer-reset-attempt-classify 31706325376 current-main';
const sourceRun = 31706325376;
const sourceRevision = '7c768ad7c54523837b06999a8f69bdffe2a840db';
const attemptSince = '2026-08-13T13:43:10Z';
const attemptUntil = '2026-08-13T13:43:26Z';
const allowedPaths = [workflowPath, runnerPath, checkerPath, scopePath];

const read = (path) => fs.readFileSync(path, 'utf8');
const files = {
  workflow: read(workflowPath),
  runner: read(runnerPath),
  checker: read(checkerPath),
  scope: read(scopePath),
  autopilot: read(autopilotPath),
};
const failures = [];

const requireToken = (name, token) => {
  if (!files[name].includes(token)) failures.push(`${name}: missing ${JSON.stringify(token)}`);
};
const forbid = (name, pattern) => {
  if (pattern.test(files[name])) failures.push(`${name}: forbidden ${pattern}`);
};
const sameStringSet = (actual, expected) => (
  Array.isArray(actual)
  && actual.every((value) => typeof value === 'string')
  && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
);

for (const path of allowedPaths) requireToken('workflow', `      - '${path}'`);
for (const token of [
  'name: Production P0 Reviewer Reset Attempt Classifier',
  'pull_request:',
  'issue_comment:',
  'permissions:\n  contents: read',
  "github.event.issue.number == 3072",
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  `github.event.comment.body == '${command}'`,
  "github.event_name == 'pull_request'",
  'needs.contract.result == \'success\'',
  'persist-credentials: false',
  'fetch-depth: 0',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
  `bash ${runnerPath}`,
  'PC_REVIEWER_RESET_ATTEMPT_COMMAND: ${{ github.event.comment.body }}',
  'PC_PROD_SSH_HOST_FINGERPRINT: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'issues: write',
]) requireToken('workflow', token);

const commandOccurrences = files.workflow.split(command).length - 1;
if (commandOccurrences !== 2) failures.push(`workflow: expected command twice, found ${commandOccurrences}`);
const secretNames = [...files.workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);
const allowedSecrets = [
  'PC_PROD_HOST',
  'PC_PROD_SSH_USER',
  'PC_PROD_SSH_PORT',
  'PC_PROD_SSH_KEY',
  'PC_PROD_SSH_PRIVATE_KEY',
  'VPS_SSH_KEY',
  'PC_PROD_SSH_HOST_FINGERPRINT',
];
if (!sameStringSet([...new Set(secretNames)], allowedSecrets)) failures.push('workflow: protected secret allowlist mismatch');
for (const pattern of [
  /workflow_dispatch:/,
  /schedule:/,
  /\bpush:/,
  /actions\/upload-artifact/,
  /PC_P0_REVIEWER_(?:EMAIL|PASSWORD|TOTP)/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
]) forbid('workflow', pattern);

for (const token of [
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "RELEASE_ISSUE_NUMBER='3072'",
  `COMMAND='${command}'`,
  `SOURCE_RUN_ID='${sourceRun}'`,
  `ATTEMPT_SINCE='${attemptSince}'`,
  `ATTEMPT_UNTIL='${attemptUntil}'`,
  `EXPECTED_DEPLOYED_SHA='${sourceRevision}'`,
  '[[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]',
  'git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"',
  '[[ -z "$(git status --porcelain=v1)" ]]',
  'for attempt in 1 2 3; do',
  '/usr/bin/ssh-keyscan -T 10 -p "$port" "$host"',
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile="$known_hosts"',
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  "--filter 'label=com.docker.compose.service=api'",
  'org.opencontainers.image.revision',
  '[[ "$api_revision" == "$expected_revision" && "$web_revision" == "$expected_revision" ]]',
  'docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$attempt_since" "$attempt_until" <<\'NODE\'',
  'process.env.STAFF_DATABASE_URL',
  'process.env.AUTH_DATABASE_URL',
  'process.env.DATABASE_URL',
  "current_user = 'pc_staff_runtime'",
  "NOT has_table_privilege(current_user, 'public.users', 'SELECT')",
  "NOT has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT')",
  'auth.staff_reviewer_preflight()',
  'auth.staff_reviewer_login_readiness()',
  'auth.staff_reviewer_password_reset_subject()',
  "readiness.join('|') !== '1|1|1|1|1|0|0|0'",
  "has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT')",
  "has_table_privilege(current_user, 'auth.audit_events', 'SELECT')",
  'auth.resolve_password_reset_subject($1)',
  'process.env.AUTH_TOKEN_PEPPER',
  "metadata->>'accountHash' = $4",
  'RESET_ATTEMPT_BINDING',
  'db_output="$(',
  'FROM auth.password_reset_challenges',
  'FROM auth.audit_events',
  "user_id = $1 AND reason = 'CHALLENGE_ISSUED'",
  "user_id = $1 AND reason = 'COOLDOWN_ACTIVE'",
  "reason = 'DELIVERY_BOUNDARY_REJECTED'",
  "reason = 'UNIVERSAL_NON_ELIGIBLE'",
  "'ATTEMPT_EVIDENCE_AMBIGUOUS'",
  'issued + cooldown + boundary + noneligible + other > 1',
  "action = 'auth.password_reset.request'",
  'created_at >= $2::timestamptz',
  'created_at <= $3::timestamptz',
  "status = 'PENDING' AND expires_at > now()",
  'RESET_ATTEMPT_DB',
  "grep -F 'password_reset_delivery_result'",
  "grep -F 'password_reset_request_accepted_without_delivery'",
  "grep -F 'password_reset_request_api_failure'",
  "grep -F 'password_reset_request_transport_failure'",
  "grep -F 'password_reset_request_configuration_error'",
  'docker logs --since "$attempt_since" --until "$attempt_until" "$web_id"',
  'web_logs="$(docker logs --since "$attempt_since" --until "$attempt_until" "$web_id" 2>&1)"',
  "remote_substage='TERMINAL_LOG_READ'",
  "remote_substage='TERMINAL_LOG_BINDING'",
  "remote_substage='UNBOUND_CONFIGURATION_EVENT'",
  '\\"accountHash\\":\\"$reviewer_web_hash\\"',
  'reviewer_correlation',
  'unset bound_line reviewer_correlation',
  "reason_class='SMTP_AUTH_REJECTED'",
  "reason_class='SMTP_RECIPIENT_OR_POLICY'",
  "reason_class='SMTP_TEMPORARY'",
  "reason_class='SMTP_TIMEOUT'",
  "reason_class='SMTP_DNS_FAILURE'",
  "reason_class='SMTP_CONNECTION_REFUSED'",
  "reason_class='SMTP_TLS_FAILURE'",
  "reason_class='RESEND_AUTH_REJECTED'",
  "reason_class='RESEND_RATE_LIMIT'",
  "reason_class='RESEND_UPSTREAM'",
  "reason_class='MAIL_CHANNEL_NOT_CONFIGURED'",
  "configuration_class='API_MISSING'",
  "configuration_class='DELIVERY_BOUNDARY_MISSING'",
  "configuration_class='MAIL_MISSING'",
  "configuration_class='MULTIPLE_MISSING'",
  "attempt_class='WEB_CONFIGURATION_REJECTED'",
  "attempt_class='DELIVERY_EVENT_WITHOUT_DURABLE_MATCH'",
  "attempt_class='DELIVERY_BOUNDARY_REJECTED'",
  "attempt_class='COOLDOWN_ACTIVE_NO_NEW_DELIVERY'",
  "attempt_class='BEFORE_POST_OR_NO_DURABLE_EFFECT'",
  'RESET_ATTEMPT_LOG|PASS',
  'RESET_REPLAY|NONE',
  'MAIL_SENT_BY_CLASSIFIER|NO',
  'PRODUCTION_MUTATION|NONE',
  'fresh reset safe now:',
  'configuration-error event cardinality:',
  'configuration class:',
  'reviewer identity / account hash / correlation id exposure: \\\`NONE\\\`',
  'reset token / hash / user-id output: \\\`NONE\\\`',
  'raw database/runtime output: \\\`NOT_PUBLISHED\\\`',
  'new recurring cost: \\\`0 RUB\\\`',
]) requireToken('runner', token);

for (const pattern of [
  /set\s+-[^\n]*x/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
  /sshpass/i,
  /docker\s+(?:compose|restart|stop|kill|rm|rmi|update|run|start|create)\b/,
  /\bpsql\b/,
  /\b(?:curl|wget)\b/,
  /\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_".]+\s+SET|DELETE\s+FROM|ALTER\s+(?:TABLE|SCHEMA|ROLE|DATABASE|FUNCTION)|CREATE\s+(?:TABLE|SCHEMA|ROLE|DATABASE|FUNCTION)|DROP\s+(?:TABLE|SCHEMA|ROLE|DATABASE|FUNCTION)|TRUNCATE\s+|GRANT\s+|REVOKE\s+|SET\s+ROLE\b)/i,
  /\$executeRaw(?:Unsafe)?\b/,
  /source\s+[^\n]*\.env/,
  /\bprintenv\b/,
  /\/proc\/(?:[0-9]+|\$[^/]+)\/environ/,
  /PC_P0_REVIEWER_(?:EMAIL|PASSWORD|TOTP)/,
  /process\.stdout\.write\([^\n]*(?:reviewer_email|email|token_hash|userId|user_id|accountHash|correlationId)/i,
  /printf[^\n]*(?:binding_marker|reviewer_web_hash|reviewer_api_hash|reviewer_correlation|bound_line|web_logs|db_output)/,
  /gh issue comment[\s\S]{0,1600}(?:\$email|\$userId|\$reviewer_email|\$output|\$reason\b|\$delivery_line)/,
  /gh issue comment[\s\S]{0,1600}(?:\$reviewer_web_hash|\$reviewer_api_hash|\$reviewer_correlation|\$binding_marker|\$db_output|\$web_logs)/,
  /docker logs[^\n]*(?:--tail\s+all|--follow|-f\b)/,
  /docker logs[\s\S]{0,160}\|\| true/,
]) forbid('runner', pattern);

const dockerExecCount = (files.runner.match(/docker exec\b/g) ?? []).length;
if (dockerExecCount !== 1) failures.push(`runner: expected exactly one read-only docker exec, found ${dockerExecCount}`);
const dockerLogsCount = (files.runner.match(/docker logs\b/g) ?? []).length;
if (dockerLogsCount !== 1) failures.push(`runner: production logs must be captured exactly once, found ${dockerLogsCount} reads`);

const shellSyntax = spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' });
if (shellSyntax.status !== 0) failures.push(`runner: bash syntax invalid: ${shellSyntax.stderr.trim()}`);
const nodeBlocks = [...files.runner.matchAll(/<<'NODE'\n([\s\S]*?)\nNODE/g)];
if (nodeBlocks.length !== 1) failures.push(`runner: expected one embedded Node block, found ${nodeBlocks.length}`);
else {
  const nodeSyntax = spawnSync('node', ['--check', '-'], { input: nodeBlocks[0][1], encoding: 'utf8' });
  if (nodeSyntax.status !== 0) failures.push(`runner: embedded Node syntax invalid: ${nodeSyntax.stderr.trim()}`);
}
const argvProbe = spawnSync('node', ['--input-type=commonjs', '-', attemptSince, attemptUntil], {
  input: `const expected=${JSON.stringify([attemptSince, attemptUntil])}; if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(expected)) process.exit(1);`,
  encoding: 'utf8',
});
if (argvProbe.status !== 0) failures.push('runner: stdin argv binding probe failed');

try {
  const scope = JSON.parse(files.scope);
  if (!sameStringSet(scope.allowedPaths, allowedPaths)) failures.push('scope: allowedPaths mismatch');
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
      || scope.branch !== branch
      || scope.status !== 'active'
      || scope.operationalStatus !== 'P0_REVIEWER_RESET_ATTEMPT_READ_ONLY_CLASSIFIER'
      || scope.issue !== 3785
      || scope.releaseIssue !== 3072
      || scope.sourceRun !== sourceRun
      || scope.sourceRevision !== sourceRevision
      || scope.attemptSinceUtc !== attemptSince
      || scope.attemptUntilUtc !== attemptUntil
      || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') failures.push('scope: metadata mismatch');
  const expectedBoundaries = {
    productionMutation: 'NONE',
    databaseMutation: false,
    identityMutation: false,
    passwordMutation: false,
    credentialMutation: false,
    mfaMutation: false,
    sessionMutation: false,
    resetReplay: false,
    mailSend: false,
    databaseReadOnly: true,
    logReadOnly: true,
    runtimeBusinessBehaviorChange: false,
    securityGateDisabled: false,
    piiOutput: false,
    credentialOutput: false,
    rawLogOutput: false,
    ownerOnly: true,
    exactMainGuard: true,
    newRecurringCostRub: 0,
  };
  for (const [key, value] of Object.entries(expectedBoundaries)) {
    if (scope.boundaries?.[key] !== value) failures.push(`scope: boundary mismatch for ${key}`);
  }
  if (!Array.isArray(scope.acceptance) || scope.acceptance.length < 8) failures.push('scope: acceptance contract incomplete');
} catch (error) {
  failures.push(`scope: invalid JSON: ${error.message}`);
}

try {
  const autopilot = JSON.parse(files.autopilot);
  const authorized = autopilot.approvedConcurrentScopes?.[branch];
  if (!sameStringSet(authorized, allowedPaths)) failures.push('autopilot: exact concurrent scope authorization missing or mismatched');
} catch (error) {
  failures.push(`autopilot: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production P0 reviewer reset attempt classifier contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS: reviewer reset attempt classifier is owner-only, exact-main/source-revision guarded, fixed-window, aggregate-only and read-only; it cannot replay reset, send mail, disclose identity/token material or mutate production.');
