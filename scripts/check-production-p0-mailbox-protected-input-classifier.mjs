import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-mailbox-protected-input-classifier.yml';
const scriptPath = 'scripts/production-p0-mailbox-protected-input-classifier.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-mailbox-protected-input-classifier-3785.json';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

function fail(message) {
  console.error(`production-p0-mailbox-protected-input-classifier contract failed: ${message}`);
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
  "github.event.comment.body == '/production p0-mailbox-protected-input-classify current-main'",
  "MAILBOX_USER: ${{ secrets.PC_PROD_P0_MAILBOX_IMAP_USER || secrets.PC_PROD_P0_IMAP_USER }}",
  "MAILBOX_PASSWORD: ${{ secrets.PC_PROD_P0_MAILBOX_IMAP_PASSWORD || secrets.PC_PROD_P0_IMAP_PASSWORD }}",
  "EMAIL_TEMPLATE: ${{ secrets.PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE || secrets.PC_PROD_P0_EMAIL_TEMPLATE }}",
  'node scripts/check-production-p0-mailbox-protected-input-classifier.mjs',
  'bash -n scripts/production-p0-mailbox-protected-input-classifier.sh',
  'bash scripts/production-p0-mailbox-protected-input-classifier.sh',
]) requireText(workflow, needle, 'workflow');

for (const needle of [
  "ACCEPTANCE_MAIL_DOMAIN='acceptance.xn----8sbjf4befbjgs9b.xn--p1ai'",
  "MAILBOX_USER_MISSING",
  "MAILBOX_USER_UNSAFE_SCALAR",
  "MAILBOX_USER_SYNTAX",
  "MAILBOX_USER_DOMAIN",
  "MAILBOX_PASSWORD_MISSING",
  "MAILBOX_PASSWORD_UNSAFE_SCALAR",
  "EMAIL_TEMPLATE_MISSING",
  "EMAIL_TEMPLATE_UNSAFE_SCALAR",
  "EMAIL_TEMPLATE_SHAPE",
  "RENDERED_RECIPIENT_SYNTAX",
  "RENDERED_RECIPIENT_DOMAIN",
  "SMTP / IMAP / SSH / Web container access: \\`NONE\\`",
  "production / database / runtime / deployment mutation: \\`NONE\\`",
  "secret values / lengths / hashes / mailbox identity / template / credentials: \\`NOT_PUBLISHED\\`",
]) requireText(script, needle, 'script');

const finalGuardSnippet = `guard_main || {
  trap - ERR
  exit 91
}`;
requireText(script, finalGuardSnippet, 'script final drift suppression');
const finalGuardIndex = script.lastIndexOf('guard_main || {');
const passIndex = script.lastIndexOf("RESULT='PASS'");
const publishIndex = script.lastIndexOf('\npublish\n');
if (!(finalGuardIndex >= 0 && finalGuardIndex < passIndex && passIndex < publishIndex)) {
  fail('script can publish stale PASS before the final exact-main guard');
}

const combined = `${workflow}\n${script}`;
for (const forbidden of [
  /password-reset\/request/i,
  /api\/auth\/forgot-password/i,
  /p0-reviewer-reset/i,
  /reviewer_email/i,
  /staff_reviewer_password_reset_subject/i,
  /\bsmtplib\b/i,
  /\bimaplib\b/i,
  /tls\.connect\s*\(/i,
  /require\(['"]node:tls['"]\)/i,
  /\bssh\s+["'$A-Za-z0-9-]/i,
  /\bscp\s+["'$A-Za-z0-9-]/i,
  /\bdocker\s+(?:ps|exec|run|rm|start|stop|restart|kill|update)\b/i,
  /\bcurl\s+-/i,
  /\bwget\s+/i,
  /\bpsql\b/i,
  /\bprisma\b/i,
  /\b(?:DATABASE_URL|STAFF_DATABASE_URL)\b/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
]) {
  if (forbidden.test(combined)) fail(`classifier contains forbidden operation ${forbidden}`);
}

const expectedPaths = [workflowPath, scriptPath, 'scripts/check-production-p0-mailbox-protected-input-classifier.mjs', scopePath].sort();
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('unexpected scope schemaVersion');
if (scope.branch !== 'diag/p0-web-container-smtp-protected-input-classifier-3785') fail('unexpected scope branch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope authority mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expectedPaths)) fail('scope allowedPaths mismatch');
for (const [key, expected] of Object.entries({
  productionMutation: false,
  databaseMutation: false,
  identityMutation: false,
  passwordMutation: false,
  passwordResetRequest: false,
  credentialMutation: false,
  mfaMutation: false,
  sessionMutation: false,
  runtimeFileMutation: false,
  deploymentMutation: false,
  mailSend: false,
  smtpAccess: false,
  imapAccess: false,
  sshAccess: false,
  webContainerAccess: false,
  reviewerIdentityAccess: false,
  piiOutput: false,
  credentialOutput: false,
  rawEnvironmentOutput: false,
  secretMetadataOutput: false,
  ownerOnly: true,
  exactMainGuard: true,
  newRecurringCostRub: 0,
})) {
  if (scope.boundaries?.[key] !== expected) fail(`scope boundary ${key} mismatch`);
}
if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') fail('production hosting boundary mismatch');

console.log('production-p0-mailbox-protected-input-classifier contract: PASS');
