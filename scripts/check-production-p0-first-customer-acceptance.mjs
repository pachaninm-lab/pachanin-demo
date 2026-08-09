import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  workflow: '.github/workflows/production-p0-first-customer-acceptance.yml',
  executor: 'scripts/production-p0-first-customer-acceptance.sh',
  runbook: 'docs/ops/production-p0-first-customer-acceptance.md',
  scope: 'docs/platform-v7/autopilot/scopes/production-p0-first-customer-acceptance-3749.json',
  staffBff: 'apps/web/app/api/staff/[...path]/route.ts',
  staffController: 'apps/api/src/modules/staff-access/staff-access.controller.ts',
  decisionProducer: 'apps/api/src/modules/auth/registration-decision.service.ts',
  receiptAuthority: 'apps/api/prisma/migrations/20260808213000_p0_registration_lifecycle_receipt/migration.sql',
};

const failures = [];
const source = {};
for (const [name, file] of Object.entries(paths)) {
  if (!fs.existsSync(file)) failures.push(`${file}: missing`);
  else source[name] = fs.readFileSync(file, 'utf8');
}

function requireAll(name, needles) {
  for (const needle of needles) {
    if (!(source[name] ?? '').includes(needle)) failures.push(`${paths[name]}: missing ${JSON.stringify(needle)}`);
  }
}

function forbid(name, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(source[name] ?? '')) failures.push(`${paths[name]}: forbidden ${pattern}`);
  }
}

requireAll('workflow', [
  'Production P0 First-Customer Acceptance',
  'issue_comment:',
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.body == '/production accept-p0-registration current-main'",
  'github.triggering_actor',
  'git rev-parse origin/main',
  'Reconfirm exact current main before external actions',
  'Prove main did not advance during acceptance',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'StrictHostKeyChecking=yes',
  'PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE',
  'PC_PROD_P0_MAILBOX_IMAP_HOST',
  'PC_PROD_P0_MAILBOX_IMAP_PASSWORD',
  'PC_PROD_P0_STAFF_EMAIL',
  'PC_PROD_P0_STAFF_PASSWORD',
  'PC_PROD_P0_STAFF_TOTP_SECRET',
  'bash scripts/production-p0-first-customer-acceptance.sh',
  'retention-days: 90',
  'P0 registration production acceptance PASS',
  'P0 registration production acceptance BLOCKED',
]);

requireAll('executor', [
  "LIVE_BASE='https://xn----8sbjf4befbjgs9b.xn--p1ai'",
  "DEFAULT_HOST='195.19.12.120'",
  'PREREQUISITE_${required}_MISSING',
  'x-csrf-token:',
  "'/api/auth/register'",
  "'/api/auth/registration/verify'",
  'REGISTRATION_EMAIL_TOKEN_INVALID',
  'mailbox_probe registration',
  'mailbox_probe decision',
  'STAFF_OWNER_FRESH_MFA_CONTEXT_MISSING',
  'select(.role == "PLATFORM_OWNER")',
  'STAFF_OWNER_ASSIGNMENT_MISSING',
  'staff-request:approve',
  '/api/staff/session-context',
  'idempotency-key:',
  'notificationDelivered == true',
  'REGISTRATION_DECISION_REPLAY_NOTIFICATION_NOT_SUPPRESSED',
  'and .replayed == true and (has("notificationDelivered") | not)',
  'decisionReplayNotification:"PASS"',
  "'/api/proxy/auctions/lots'",
  'AUCTION_LOT_NOT_ACCESSIBLE',
  "'/api/auth/logout'",
  'relogin_customer',
  "set_config('app.current_tenant_id'",
  'actorAVisibleRows',
  'actorBVisibleRows',
  'rolbypassrls',
  'relforcerowsecurity',
  'pc_registration_receipt_authority',
  'migration_revision="$(docker image inspect',
  'MIGRATION_DATABASE_URL_DISCOVERY_FAILED',
  'PC_P0_MIGRATION_DATABASE_URL_B64',
  '--env-file "$migration_env_file"',
  '"$api_container" /nodejs/bin/node -',
  'trap \'rm -f "${rls_file:-}" "${receipt_file:-}" "${migration_env_file:-}"\' EXIT',
  'rm -f "$rls_file" "$receipt_file" "$migration_env_file"',
  'trap - EXIT',
  'auth.registration.lifecycle.receipt',
  'registration-lifecycle:',
  'MISSING_P0_CAUSAL_OUTBOX_PRODUCER',
  'P0_DECISION_REPLAY_NOTIFICATION=PASS',
  'P0_FIRST_CUSTOMER_ACCEPTANCE=PASS',
]);

requireAll('staffBff', [
  "request.headers.get('idempotency-key')",
  "'idempotency-key': idempotencyKey",
  "code: 'IDEMPOTENCY_KEY_REQUIRED'",
  "'x-staff-access-session': staffAccessToken",
]);

requireAll('staffController', [
  "@Post('registration/applications/:applicationId/decision')",
  '@UseGuards(StaffAccessGuard)',
  '@StaffAccessModes(StaffAccessMode.CONTROL_PLANE)',
  '@StaffPermissions(StaffPermission.STAFF_REQUEST_APPROVE)',
  'await this.access.requirePermission(request.user, StaffPermission.STAFF_REQUEST_APPROVE);',
]);

requireAll('decisionProducer', [
  'await this.emitRegistrationLifecycleReceipt(tx, application.id, correlationId)',
  'FROM auth.emit_registration_lifecycle_receipt(',
  "code: 'REGISTRATION_LIFECYCLE_RECEIPT_MISSING'",
  'replayed = false',
  '...(!replayed && deliveryAuthorized(deliveryKey)',
]);

const replayRead = 'return this.readResult(tx, applicationId, deliveryKey, true);';
if ((source.decisionProducer ?? '').split(replayRead).length - 1 !== 2) {
  failures.push(`${paths.decisionProducer}: both exact decision replay branches must suppress notification delivery`);
}

requireAll('receiptAuthority', [
  'CREATE ROLE pc_registration_receipt_authority',
  'NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS',
  'CREATE OR REPLACE FUNCTION auth.emit_registration_lifecycle_receipt(',
  "'auth.registration.lifecycle.receipt'",
  "'registration-lifecycle:'",
  'ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY',
  'Registration lifecycle receipt replay conflict',
]);

requireAll('runbook', [
  '/production accept-p0-registration current-main',
  'PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE',
  'PC_PROD_P0_STAFF_TOTP_SECRET',
  'MISSING_P0_CAUSAL_OUTBOX_PRODUCER',
  'AUCTION_LOT_NOT_ACCESSIBLE',
  'REG.RU',
  'Prisma-клиент exact-SHA API image',
  'не содержит',
]);

forbid('workflow', [
  /workflow_dispatch:/,
  /StrictHostKeyChecking=no/,
  /sshpass/i,
]);
forbid('executor', [
  /https?:\/\/[^\s"']+\/auth\/register/,
  /prisma\s+migrate\s+(?:reset|dev)/i,
  /docker\s+(?:build|commit|tag)\b/,
  /SET\s+(?:SESSION\s+)?row_security\s*=\s*off/i,
  /BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY/,
  /-e\s+["']?DATABASE_URL=/,
]);

const shellCheck = spawnSync('bash', ['-n', paths.executor], { encoding: 'utf8' });
if (shellCheck.status !== 0) failures.push(`${paths.executor}: bash -n failed: ${shellCheck.stderr.trim()}`);

try {
  const scope = JSON.parse(source.scope ?? '{}');
  if (scope.branch !== 'fix/production-p0-first-customer-acceptance-3750') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.productionHosting !== 'REG_RU_VPS_ONLY') failures.push(`${paths.scope}: hosting mismatch`);
  if (scope.newRecurringCostRub !== 0) failures.push(`${paths.scope}: recurring cost must be zero`);
  const allowed = new Set(scope.allowedPaths ?? []);
  for (const file of [paths.workflow, paths.executor, 'scripts/check-production-p0-first-customer-acceptance.mjs', paths.runbook]) {
    if (file && !allowed.has(file)) failures.push(`${paths.scope}: allowedPaths missing ${JSON.stringify(file)}`);
  }
  for (const phrase of [
    'MISSING_P0_CAUSAL_OUTBOX_PRODUCER',
    'auth.registration.lifecycle.receipt',
    'read-only PostgreSQL RLS assertion',
  ]) {
    if (!(scope.requiredBehavior ?? []).some((entry) => String(entry).includes(phrase))) {
      failures.push(`${paths.scope}: requiredBehavior missing ${JSON.stringify(phrase)}`);
    }
  }
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

if (failures.length > 0) {
  console.error('Production P0 first-customer acceptance contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS: exact-main owner authority, two public BFF registrations, mailbox acknowledgements, staff MFA/protected approval, customer MFA/cabinet/action/logout/re-login, cross-tenant BFF denial, PostgreSQL FORCE-RLS proof and causal lifecycle audit/outbox evidence are fail-closed.');
