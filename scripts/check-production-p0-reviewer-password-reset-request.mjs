import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-password-reset-request.yml';
const scriptPath = 'scripts/production-p0-reviewer-password-reset-request.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-password-reset-request.mjs';
const controllerPath = 'apps/api/src/modules/auth/auth.controller.ts';
const controllerSpecPath = 'apps/api/src/modules/auth/auth.controller.password-reset.spec.ts';
const migrationPath = 'apps/api/prisma/migrations/20260812154500_p0_reviewer_password_reset_subject/migration.sql';
const scopePath = 'docs/security/p0-reviewer-password-reset-request-3785.json';
const concurrentScopePath = 'docs/platform-v7/autopilot/scopes/p0-reviewer-reset-durable-outbox-evidence-3785.json';

const read = (path) => fs.readFileSync(path, 'utf8');
const workflow = read(workflowPath);
const script = read(scriptPath);
const controller = read(controllerPath);
const controllerSpec = read(controllerSpecPath);
const migration = read(migrationPath);
const scope = JSON.parse(read(scopePath));
const concurrentScope = JSON.parse(read(concurrentScopePath));

const requireAll = (label, haystack, needles) => {
  for (const needle of needles) {
    if (!haystack.includes(needle)) throw new Error(`${label} missing: ${needle}`);
  }
};
const rejectAll = (label, haystack, needles) => {
  for (const needle of needles) {
    if (haystack.includes(needle)) throw new Error(`${label} forbidden: ${needle}`);
  }
};

requireAll('workflow', workflow, [
  'issue_comment:',
  'pull_request:',
  '/production p0-reviewer-reset-request current-main',
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  workflowPath,
  scriptPath,
  checkerPath,
  controllerPath,
  controllerSpecPath,
  scopePath,
  concurrentScopePath,
  'PC_PROD_SSH_HOST_FINGERPRINT',
]);
rejectAll('workflow', workflow, [
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
  'upload-artifact',
  'actions/upload-artifact',
  'StrictHostKeyChecking=no',
  'UserKnownHostsFile=/dev/null',
]);

requireAll('controller', controller, [
  "@Headers('x-correlation-id') correlationId?: string",
  'return this.passwordReset.request(dto.email, ip, deliveryKey, correlationId, dto.locale);',
]);
if (controller.includes('return this.passwordReset.request(dto.email, ip, deliveryKey);')) {
  throw new Error('controller must not drop reset correlation id or locale');
}
requireAll('controller spec', controllerSpec, [
  "locale: 'zh'",
  "'reset-correlation-20260816'",
  "'203.0.113.77'",
  'expect(passwordReset.request).toHaveBeenCalledWith(',
  "'zh'",
]);

requireAll('script', script, [
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile="$known_hosts"',
  "failure_reason='SSH_HOST_KEY_SCAN_FAILED'",
  "failure_reason='SSH_HOST_KEY_FINGERPRINT_MISMATCH'",
  "failure_reason='SSH_TRANSPORT_FAILED'",
  'for attempt in 1 2 3',
  '/usr/bin/ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true',
  'staff_reviewer_preflight()',
  'staff_reviewer_login_readiness()',
  'staff_reviewer_password_reset_subject()',
  "counts.join('|') !== '1|1|1|1|1|0|0|0'",
  '/platform-v7/forgot-password?lang=ru',
  '/api/auth/forgot-password',
  'x-csrf-token',
  'x-correlation-id: $correlation_id',
  'Origin: $live_base',
  '--data-binary "@$request_body"',
  'label=com.docker.compose.service=auth-mail-worker',
  "[[ \"$worker_state\" == 'running' ]]",
  "[[ \"$worker_health\" == 'healthy' ]]",
  "AUTH_MAIL_DATABASE_URL_FILE || '/run/pc-auth-mail/database-url'",
  'FROM auth.mail_outbox',
  "WHERE message_kind = 'PASSWORD_RESET'",
  'AND correlation_id = $1',
  "status === 'SENT' || status === 'DEAD_LETTER'",
  'Password reset challenge/outbox transaction failed',
  "failure_reason='DURABLE_OUTBOX_TRANSACTION_FAILED'",
  "failure_reason='NO_DURABLE_OUTBOX_EFFECT'",
  "failure_reason='AUTH_MAIL_DEAD_LETTER'",
  "failure_reason='AUTH_MAIL_DELIVERY_TIMEOUT'",
  'durable PASSWORD_RESET outbox state:',
  'reset token / encrypted payload output: \\`NONE\\`',
  'PRODUCTION_MUTATION=NORMAL_PASSWORD_RESET_REQUEST_ONLY',
  'reviewer identity exposure: \\`NONE\\`',
  'password/TOTP handling: \\`NONE\\`',
]);
rejectAll('script', script, [
  'password_reset_delivery_result',
  '\"delivered\"[[:space:]]*:[[:space:]]*true',
  'payload_ciphertext',
  'payload_iv',
  'payload_tag',
  'decryptAuthMailEnvelope',
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
  'passwordHash =',
  'mfa_secret_ciphertext =',
  'UPDATE public."users"',
  'INSERT INTO public."users"',
  'DELETE FROM public."users"',
  'StrictHostKeyChecking=no',
  'UserKnownHostsFile=/dev/null',
]);

if (/gh issue comment[\s\S]{0,1400}\$reviewer_email/.test(script)) {
  throw new Error('reviewer email must never reach issue comments');
}
if (!/printf '\{\"email\":\"%s\",\"locale\":\"ru\"\}' \"\$reviewer_email\" > \"\$request_body\"/.test(script)) {
  throw new Error('reviewer email must only be written into the root-only request body');
}

requireAll('migration', migration, [
  'CREATE OR REPLACE FUNCTION auth.staff_reviewer_password_reset_subject()',
  'RETURNS text',
  'SECURITY DEFINER',
  'SET row_security = on',
  "assignment.role = 'PLATFORM_OWNER'",
  "assignment.status = 'ACTIVE'",
  'ALTER FUNCTION auth.staff_reviewer_password_reset_subject() OWNER TO pc_staff_authority',
  'REVOKE ALL ON FUNCTION auth.staff_reviewer_password_reset_subject() FROM PUBLIC',
  'GRANT EXECUTE ON FUNCTION auth.staff_reviewer_password_reset_subject() TO pc_staff_runtime',
]);
rejectAll('migration', migration, [
  'UPDATE public."users" SET',
  'INSERT INTO public."users"',
  'DELETE FROM public."users"',
  'SET row_security = off',
]);

if (scope.schemaVersion !== 'pc.p0.reviewer-password-reset-request.v2') throw new Error('scope schemaVersion invalid');
if (scope.productionMutation !== 'NORMAL_PASSWORD_RESET_REQUEST_ONLY') throw new Error('scope productionMutation invalid');
if (scope.deliveryAuthority !== 'DURABLE_AUTH_MAIL_OUTBOX') throw new Error('scope deliveryAuthority invalid');
if (scope.correlationAuthority !== 'WEB_TO_API_TO_OUTBOX') throw new Error('scope correlationAuthority invalid');
if (scope.secretsInActions !== 'FORBIDDEN') throw new Error('scope must forbid reviewer secrets in Actions');
if (scope.terminalSuccess?.durableOutbox !== 'SENT') throw new Error('scope terminal durable outbox status invalid');
if (!Array.isArray(scope.forbidden) || !scope.forbidden.includes('AUTH_MAIL_PAYLOAD_DECRYPTION_FOR_EVIDENCE')) {
  throw new Error('scope must forbid payload decryption for evidence');
}

const expectedAllowedPaths = [
  workflowPath,
  controllerPath,
  controllerSpecPath,
  scopePath,
  concurrentScopePath,
  checkerPath,
  scriptPath,
].sort();
if (concurrentScope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('concurrent scope schema invalid');
if (concurrentScope.branch !== 'fix/p0-reviewer-reset-durable-outbox-evidence-3785') throw new Error('concurrent scope branch invalid');
if (concurrentScope.status !== 'active' || concurrentScope.issue !== 3785 || concurrentScope.releaseIssue !== 3072) {
  throw new Error('concurrent scope authority invalid');
}
if (JSON.stringify([...concurrentScope.allowedPaths].sort()) !== JSON.stringify(expectedAllowedPaths)) {
  throw new Error('concurrent scope allowedPaths mismatch');
}
const b = concurrentScope.boundaries || {};
if (!b.registrationOnly || !b.reviewerAccessOnly || !b.ownerOnlyOperationalTrigger || !b.exactMainGuard) {
  throw new Error('concurrent scope operational boundary invalid');
}
if (b.newRecurringCostRub !== 0 || b.directPasswordWrite || b.directMfaWrite || b.roleOrTenantMutation
    || b.authMailPayloadDecryptionForEvidence || b.reviewerPiiOutput || b.credentialOutput || b.rawLogOutput || b.sshHostKeyBypass) {
  throw new Error('concurrent scope security boundary invalid');
}

console.log('production P0 reviewer password-reset durable-outbox contract PASS');
