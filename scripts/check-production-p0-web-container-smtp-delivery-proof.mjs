import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-web-container-smtp-delivery-proof.yml';
const scriptPath = 'scripts/production-p0-web-container-smtp-delivery-proof.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-web-container-smtp-delivery-proof-3785.json';
const mailPath = 'apps/web/lib/server/transactional-mail.ts';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const mail = fs.readFileSync(mailPath, 'utf8');

function fail(message) {
  console.error(`production-p0-web-container-smtp-delivery-proof contract failed: ${message}`);
  process.exit(1);
}
function requireText(text, needle, label) {
  if (!text.includes(needle)) fail(`${label} missing ${JSON.stringify(needle)}`);
}

for (const needle of [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.event.comment.author_association == 'OWNER'",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-web-container-smtp-delivery-proof current-main'",
  "MAILBOX_USER: ${{ secrets.PC_PROD_P0_MAILBOX_IMAP_USER || secrets.PC_PROD_P0_IMAP_USER }}",
  "MAILBOX_PASSWORD: ${{ secrets.PC_PROD_P0_MAILBOX_IMAP_PASSWORD || secrets.PC_PROD_P0_IMAP_PASSWORD }}",
  "EMAIL_TEMPLATE: ${{ secrets.PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE || secrets.PC_PROD_P0_EMAIL_TEMPLATE }}",
  'bash scripts/production-p0-web-container-smtp-delivery-proof.sh',
  'bash -n scripts/production-p0-web-container-smtp-delivery-proof.sh',
]) requireText(workflow, needle, 'workflow');

for (const needle of [
  "ACCEPTANCE_MAIL_DOMAIN='acceptance.xn----8sbjf4befbjgs9b.xn--p1ai'",
  "SMTP_HOST='mail.hosting.reg.ru'",
  "SMTP_PORT='465'",
  "IMAP_PORT='993'",
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  'docker exec -i "$web_id" /nodejs/bin/node --input-type=commonjs -',
  "EHLO transparent-price.local",
  "AUTH PLAIN ${auth}",
  "MAIL FROM:<${from}>",
  "RCPT TO:<${recipient}>",
  "await command('DATA', [354], 'DATA')",
  "socket.write(`${mime}\\r\\n.\\r\\n`)",
  "WEB_SMTP_RESPONSE_5000_BUDGET",
  "WEB_SMTP_APP_7500_BUDGET",
  "IMAP_RECEIPT_RESULT",
  "marker = f'PC-CROP-WEB-DELIVERY-{target_sha[:12]}-{run_id}-{secrets.token_hex(8)}'.upper()",
  "readonly=True",
  "PRODUCTION_MUTATION='NONE'",
  "console.log(`PRODUCTION_MUTATION=${sent ? 'ACCEPTANCE_MAIL_ONLY' : 'NONE'}`);",
  "StrictHostKeyChecking=yes",
  "reviewer identity / reset / password / TOTP / session access: \\`NONE\\`",
]) requireText(script, needle, 'script');

const representativeMarker = 'PC-CROP-WEB-DELIVERY-abcdef012345-31703173693-abcdef0123456789'.toUpperCase();
if (!/^[A-Z0-9-]{20,128}$/.test(representativeMarker)) {
  fail('normalized acceptance marker does not satisfy its fail-closed transport contract');
}

const combined = `${workflow}\n${script}`;
for (const forbidden of [
  /password-reset\/request/i,
  /api\/auth\/forgot-password/i,
  /p0-reviewer-reset/i,
  /reviewer_email/i,
  /staff_reviewer_password_reset_subject/i,
  /\b(?:psql|prisma|DATABASE_URL|STAFF_DATABASE_URL)\b/,
  /docker\s+(?:run|rm|start|stop|restart|kill|update)\b/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
]) {
  if (forbidden.test(combined)) fail(`proof contains forbidden operation ${forbidden}`);
}

for (const needle of [
  'const MAIL_TIMEOUT_MS = 5_000;',
  "'EHLO transparent-price.local'",
  '`AUTH PLAIN ${Buffer.from(',
  'to = smtpMailbox(mail.to);',
  'mime = buildSmtpMimeMessage({ ...mail, to }, from);',
  '`MAIL FROM:<${from}>`',
  '`RCPT TO:<${to}>`',
  "'DATA', [354]",
  'socket.write(`${mime}\\r\\n.\\r\\n`);',
  'MAIL_TIMEOUT_MS + 2_500',
]) requireText(mail, needle, 'transactional-mail');

const expectedPaths = [workflowPath, scriptPath, 'scripts/check-production-p0-web-container-smtp-delivery-proof.mjs', scopePath].sort();
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('unexpected scope schemaVersion');
if (scope.branch !== 'fix/p0-web-smtp-proof-canonical-recipient-3785') fail('unexpected scope branch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope authority mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expectedPaths)) fail('scope allowedPaths mismatch');
for (const [key, expected] of Object.entries({
  productionMutation: 'ACCEPTANCE_MAIL_ONLY',
  databaseMutation: false,
  identityMutation: false,
  passwordMutation: false,
  passwordResetRequest: false,
  credentialMutation: false,
  mfaMutation: false,
  sessionMutation: false,
  runtimeFileMutation: false,
  deploymentMutation: false,
  mailSend: true,
  mailRecipient: 'ISOLATED_ACCEPTANCE_MAILBOX_ONLY',
  smtpAuthAttempt: true,
  smtpRecipientProbe: true,
  smtpDataCommand: true,
  imapReceiptReadOnly: true,
  reviewerIdentityAccess: false,
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

console.log('production-p0-web-container-smtp-delivery-proof contract: PASS');