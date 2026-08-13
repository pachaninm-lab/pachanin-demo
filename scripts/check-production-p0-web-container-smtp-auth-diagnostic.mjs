import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-web-container-smtp-auth-diagnostic.yml';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-web-container-smtp-auth-diagnostic-3785.json';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

function fail(message) {
  console.error(`production-p0-web-container-smtp-auth-diagnostic contract failed: ${message}`);
  process.exit(1);
}

function requireText(text, needle, label) {
  if (!text.includes(needle)) fail(`${label} missing ${JSON.stringify(needle)}`);
}

for (const needle of [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-web-container-smtp-auth-diagnose current-main'",
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  'if (( ${#web_ids[@]} != 1 ));',
  'docker exec -i "$web_id" /nodejs/bin/node --input-type=commonjs -',
  "process.env.PC_SMTP_HOST",
  "process.env.PC_SMTP_USER",
  "process.env.PC_SMTP_PASS",
  "process.env.PC_SMTP_PORT",
  "process.env.PC_MAIL_FROM",
  "host !== 'mail.hosting.reg.ru'",
  "port !== 465",
  "EHLO transparent-price.local",
  "AUTH PLAIN ${auth}",
  "MAIL FROM:<${from}>",
  "await command('RSET', [250], 'RSET')",
  "socket.write('QUIT\\r\\n')",
  'WEB_SMTP_MAIL_SENT=NO',
  'WEB_SMTP_RECIPIENT_COMMAND=NO',
  'WEB_SMTP_DATA_COMMAND=NO',
  'PRODUCTION_MUTATION=NONE',
  'StrictHostKeyChecking=yes',
  'WEB_SMTP_TOTAL_BUCKET',
  'WEB_SMTP_RESPONSE_5000_BUDGET',
  'WEB_SMTP_APP_7500_BUDGET',
]) requireText(workflow, needle, 'workflow');

for (const forbidden of [
  /RCPT\s+TO\s*:/i,
  /await\s+command\(['"]DATA/i,
  /socket\.write\([^\n]*DATA/i,
  /sendTransactionalMail/,
  /password-reset\/request/,
  /docker\s+(?:run|rm|start|stop|restart|kill|update)\b/,
  /\b(?:psql|prisma|DATABASE_URL)\b/,
]) {
  if (forbidden.test(workflow)) fail(`workflow contains forbidden operation ${forbidden}`);
}

const expectedPaths = [
  workflowPath,
  'scripts/check-production-p0-web-container-smtp-auth-diagnostic.mjs',
  scopePath,
].sort();
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('unexpected scope schemaVersion');
if (scope.branch !== 'diag/p0-web-container-smtp-auth-3785') fail('unexpected scope branch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope issue authority mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expectedPaths)) fail('scope allowedPaths mismatch');
for (const [key, expected] of Object.entries({
  productionMutation: 'NONE',
  databaseMutation: false,
  identityMutation: false,
  passwordMutation: false,
  credentialMutation: false,
  mfaMutation: false,
  sessionMutation: false,
  mailSend: false,
  smtpAuthAttempt: true,
  smtpMailFromProbe: true,
  smtpRecipientProbe: false,
  smtpDataCommand: false,
  runtimeBusinessBehaviorChange: false,
  securityGateDisabled: false,
  piiOutput: false,
  credentialOutput: false,
  rawEnvironmentOutput: false,
  rawProtocolOutput: false,
  ownerOnly: true,
  exactMainGuard: true,
  newRecurringCostRub: 0,
})) {
  if (scope.boundaries?.[key] !== expected) fail(`scope boundary ${key} mismatch`);
}
if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') fail('production hosting boundary mismatch');

console.log('production-p0-web-container-smtp-auth-diagnostic contract: PASS');
