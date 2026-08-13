import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-smtp-rcpt-diagnostic.yml';
const scriptPath = 'scripts/production-p0-reviewer-smtp-rcpt-diagnostic.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-smtp-rcpt-diagnostic-3785.json';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

function fail(message) {
  console.error(`production-p0-reviewer-smtp-rcpt-diagnostic contract failed: ${message}`);
  process.exit(1);
}
function requireText(text, needle, label) {
  if (!text.includes(needle)) fail(`${label} missing ${JSON.stringify(needle)}`);
}

for (const needle of [
  'issue_comment:',
  'pull_request:',
  "/production p0-reviewer-smtp-rcpt-diagnose current-main",
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  'scripts/check-production-p0-reviewer-smtp-rcpt-diagnostic.mjs',
  'scripts/production-p0-reviewer-smtp-rcpt-diagnostic.sh',
  'PC_PROD_SSH_HOST_FINGERPRINT',
]) requireText(workflow, needle, 'workflow');

for (const needle of [
  "COMMAND='/production p0-reviewer-smtp-rcpt-diagnose current-main'",
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile="$known_hosts"',
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  "label=com.docker.compose.service=api",
  '[[ "$api_revision" == "$web_revision" ]]',
  'auth.staff_reviewer_password_reset_subject()',
  "p.user_name !== 'pc_staff_runtime'",
  "process.stdout.write(`SUBJECT|${email}`)",
  "printf '%s\\n' \"$reviewer_email\"",
  "IFS= read -r P0_RCPT_TO || exit 70",
  'process.env.P0_RCPT_TO',
  'process.env.PC_SMTP_HOST',
  'process.env.PC_SMTP_USER',
  'process.env.PC_SMTP_PASS',
  "host !== 'mail.hosting.reg.ru'",
  'port !== 465',
  'EHLO transparent-price.local',
  'AUTH PLAIN ${auth}',
  'MAIL FROM:<${from}>',
  'RCPT TO:<${recipient}>',
  "socket.write('RSET\\r\\n')",
  "socket.write('QUIT\\r\\n')",
  'SMTP_RCPT_RESULT=${result}',
  'SMTP_RCPT_DATA_COMMAND=NO',
  'SMTP_RCPT_MAIL_SENT=NO',
  'PRODUCTION_MUTATION=NONE',
  'reviewer email / credentials / raw env / raw SMTP response',
]) requireText(script, needle, 'script');

for (const forbidden of [
  /socket\.write\([`'"]DATA/i,
  /command\([`'"]DATA/i,
  /sendTransactionalMail/,
  /password-reset\/request/,
  /api\/auth\/forgot-password/,
  /\b(?:UPDATE|INSERT|DELETE)\s+public\./i,
  /docker\s+(?:run|rm|start|stop|restart|kill|update)\b/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
  /gh issue comment[\s\S]{0,1600}\$reviewer_email/,
]) {
  if (forbidden.test(script)) fail(`script contains forbidden operation ${forbidden}`);
}

if (/docker exec[^\n]*\$reviewer_email/.test(script)) {
  fail('reviewer email must not be a docker exec process argument');
}
if (/printf[^\n]*reviewer_email/.test(script) && !script.includes("printf '%s\\n' \"$reviewer_email\"")) {
  fail('reviewer email may only be written to the private stdin pipe');
}

const expectedPaths = [workflowPath, scriptPath,
  'scripts/check-production-p0-reviewer-smtp-rcpt-diagnostic.mjs', scopePath].sort();
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schemaVersion mismatch');
if (scope.branch !== 'diag/p0-reviewer-smtp-rcpt-3785') fail('scope branch mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope issue authority mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expectedPaths)) fail('scope allowedPaths mismatch');

const boundaries = {
  productionMutation: 'NONE',
  databaseRead: 'SECURITY_DEFINER_REVIEWER_SUBJECT_ONLY',
  databaseMutation: false,
  identityMutation: false,
  passwordMutation: false,
  credentialMutation: false,
  mfaMutation: false,
  sessionMutation: false,
  passwordResetReplay: false,
  mailSend: false,
  smtpAuthAttempt: true,
  smtpMailFromProbe: true,
  smtpRecipientProbe: true,
  smtpDataCommand: false,
  runtimeBusinessBehaviorChange: false,
  securityGateDisabled: false,
  reviewerIdentityOutput: false,
  credentialOutput: false,
  rawEnvironmentOutput: false,
  rawProtocolOutput: false,
  ownerOnly: true,
  exactMainGuard: true,
  newRecurringCostRub: 0,
};
for (const [key, expected] of Object.entries(boundaries)) {
  if (scope.boundaries?.[key] !== expected) fail(`scope boundary ${key} mismatch`);
}
if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') fail('production hosting mismatch');

console.log('production-p0-reviewer-smtp-rcpt-diagnostic contract: PASS');
