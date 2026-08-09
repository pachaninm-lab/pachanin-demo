import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  workflow: '.github/workflows/production-p0-first-customer-acceptance.yml',
  executor: 'scripts/production-p0-first-customer-acceptance.sh',
  checker: 'scripts/check-production-p0-first-customer-acceptance.mjs',
  runbook: 'docs/ops/production-p0-first-customer-acceptance.md',
  scope: 'docs/platform-v7/autopilot/scopes/production-p0-first-customer-acceptance-3749.json',
  decision: 'apps/api/src/modules/auth/registration-decision.service.ts',
  receiptMigration: 'apps/api/prisma/migrations/20260808213000_p0_registration_lifecycle_receipt/migration.sql',
  staffController: 'apps/api/src/modules/staff-access/staff-access.controller.ts',
  organizationController: 'apps/api/src/modules/auth/auth.controller.ts',
  organizationInvitations: 'apps/api/src/modules/auth/organization-invitation.service.ts',
  proxyBff: 'apps/web/app/api/proxy/[...path]/route.ts',
  registerBff: 'apps/web/app/api/auth/register/route.ts',
  verifyBff: 'apps/web/app/api/auth/registration/verify/route.ts',
  loginBff: 'apps/web/app/api/auth/login/route.ts',
  mfaBff: 'apps/web/app/api/auth/mfa-login/route.ts',
  logoutBff: 'apps/web/app/api/auth/logout/route.ts',
  staffBff: 'apps/web/app/api/staff/[...path]/route.ts',
};

const failures = [];
const source = {};
for (const [name, path] of Object.entries(paths)) {
  if (!fs.existsSync(path)) failures.push(`${path}: missing`);
  else source[name] = fs.readFileSync(path, 'utf8');
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
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  "github.event.comment.body == '/production p0-first-customer current-main'",
  'Resolve exact current main',
  'git rev-parse origin/main',
  'gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha',
  'persist-credentials: false',
  'issues: write',
  'PC_PROD_P0_EMAIL_TEMPLATE',
  'PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE',
  'PC_PROD_P0_IMAP_HOST',
  'PC_PROD_P0_MAILBOX_IMAP_HOST',
  'PC_PROD_P0_IMAP_USER',
  'PC_PROD_P0_MAILBOX_IMAP_USER',
  'PC_PROD_P0_IMAP_PASSWORD',
  'PC_PROD_P0_MAILBOX_IMAP_PASSWORD',
  'PC_PROD_P0_REVIEWER_EMAIL',
  'PC_PROD_P0_STAFF_EMAIL',
  'PC_PROD_P0_REVIEWER_PASSWORD',
  'PC_PROD_P0_STAFF_PASSWORD',
  'PC_PROD_P0_REVIEWER_TOTP_SECRET',
  'PC_PROD_P0_STAFF_TOTP_SECRET',
  'MISSING_P0_MAILBOX_PREREQUISITE',
  'MISSING_P0_REVIEWER_PREREQUISITE',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'StrictHostKeyChecking=yes',
  'Reconfirm exact main immediately before production mutation',
  'P0_MAIN_ADVANCED_BEFORE_MUTATION',
  'Execute exact-main P0 first-customer acceptance',
  'continue-on-error: true',
  'Enforce bounded redacted evidence',
  'rg --quiet --ignore-case',
  'P0_EVIDENCE_SCAN_FAILED',
  'P0_MAIN_ADVANCED_BEFORE_TERMINAL_RESULT',
  'postgres(?:ql)?://',
  'pc_(staff_)?(access|refresh)_token',
  'backupCodes',
  'DATABASE_URL=',
  'Publish bounded terminal result to release authority',
  'Guard exact main before artifact publication',
  "steps.evidence.outcome == 'success'",
  "steps.artifact_guard.outcome == 'success'",
  "steps.upload.outcome }}' == success",
  "steps.credential_cleanup.outcome }}' == success",
  "steps.publication.outcome }}' == success",
  'terminal_result=PASS',
  'artifact upload:',
  '$RUNNER_TEMP/pc-p0-production-key',
  'retention-days: 90',
  'P0_FIRST_CUSTOMER_ACCEPTANCE=PASS',
]);

forbid('workflow', [
  /workflow_dispatch:/,
  /StrictHostKeyChecking=no/,
  /sshpass/i,
  /SSH_PASSWORD/i,
  /BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY/,
  /github\.actor\s*==\s*['"]github-actions\[bot\]['"]/,
  /Netlify|Vercel/,
]);

requireAll('executor', [
  'assert_exact_main',
  'http_request()',
  'assert_exact_main\n  curl',
  'fetch_verification_token()',
  'imaplib.IMAP4_SSL',
  'BODY.PEEK[]',
  "['gh', 'api', f\"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main\", '--jq', '.sha']",
  "template.count('{identity}') == 1",
  "template.count('{run}') == 1",
  "template.count('{slot}') == 1",
  'MISSING_P0_MAILBOX_PREREQUISITE',
  'MISSING_P0_REVIEWER_PREREQUISITE',
  'MISSING_P0_CAUSAL_OUTBOX_PRODUCER',
  'register_identity a seller',
  'register_identity b buyer',
  '$LIVE_BASE/api/auth/register',
  '$LIVE_BASE/api/auth/registration/verify',
  'p0-email-verify-replay:',
  'REGISTRATION_EMAIL_TOKEN_INVALID',
  '$LIVE_BASE/api/auth/login',
  '$LIVE_BASE/api/auth/membership-select',
  '$LIVE_BASE/api/auth/mfa-login',
  '$LIVE_BASE/api/auth/logout',
  '$LIVE_BASE/api/staff/registration/applications',
  '[[ "$status" == 201 ]] || fail "P0_REVIEWER_APPROVAL_${label^^}_FAILED"',
  'notificationDelivered',
  "payload.get('replayed') is not False",
  "payload.get('replayed') is not True",
  "if 'notificationDelivered' in payload",
  'P0_DECISION_REPLAY_NOTIFICATION_NOT_SUPPRESSED',
  'DECISION_REPLAY_NOTIFICATION_SUPPRESSED=1',
  'P0_DECISION_REPLAY_NOTIFICATION=PASS',
  'P0_REVIEWER_CONTROL_PLANE_CONTEXT_INVALID',
  "row.get('role') == 'PLATFORM_OWNER'",
  'activate_reviewer_control_plane',
  '$LIVE_BASE/api/staff/access/requests',
  "'accessMode': 'CONTROL_PLANE'",
  "'staff-request:read', 'staff-request:approve'",
  '$LIVE_BASE/api/staff/access/grants/$grant_id/activate',
  '$LIVE_BASE/api/staff/session-context',
  'end_reviewer_control_plane',
  '$LIVE_BASE/api/staff/access/sessions/$REVIEWER_STAFF_SESSION_ID/end',
  'customer_login a initial',
  'customer_login b initial',
  'customer_login a relogin',
  'customer_login b relogin',
  '$LIVE_BASE/api/proxy/auth/organization-team',
  '$LIVE_BASE/api/proxy/auth/organization-memberships/${MEMBERSHIP_ID[a]}/role',
  '400) fail P0_CROSS_TENANT_REQUEST_WAS_MALFORMED',
  '401) fail P0_CROSS_TENANT_REQUEST_WAS_UNAUTHENTICATED',
  'com.docker.compose.project.config_files',
  'config --format json',
  'grainflow-migration',
  'org.opencontainers.image.revision',
  'migration_database_url',
  'run_admin_evidence()',
  'printf \'%s\\0\' "$migration_database_url" "$admin_mode"',
  '| docker exec -i "$api_id" /nodejs/bin/node -e "$admin_node"',
  'AUTH_DATABASE_URL',
  "new PrismaClient({ datasources: { db: { url: process.env.AUTH_DATABASE_URL } } })",
  "new PrismaClient({ datasources: { db: { url: databaseUrl } } })",
  'SET TRANSACTION READ ONLY',
  'SET LOCAL ROLE pc_registration_receipt_authority',
  'rolsuper',
  'rolbypassrls',
  'rolcanlogin',
  'rolinherit',
  'member_count',
  'relrowsecurity',
  'relforcerowsecurity',
  "row_security_active('public.outbox_entries')",
  'out_of_scope_visible',
  'outbox_entries_registration_receipt_select',
  'outbox_entries_registration_receipt_insert',
  'has_table_privilege',
  'has_any_column_privilege',
  'forbidden_write_privilege',
  'auth_audit_events_append_only',
  'auth_audit_events_no_truncate',
  'function.prosecdef',
  'function.proconfig',
  'owner.rolname AS owner_name',
  'aclexplode',
  'public_execute',
  'SET row_security TO',
  "set_config('app.current_user_id', $1, true)",
  'app.current_user_id',
  'app.current_org_id',
  'app.current_tenant_id',
  'app.current_role',
  'app.current_session_id',
  'P0_TENANT_A_RLS=1',
  'P0_TENANT_B_RLS=0',
  'auth.emit_registration_lifecycle_receipt(text,text)',
  'pc_registration_receipt_authority',
  'auth.registration.lifecycle.receipt',
  'registration-lifecycle:',
  "'approvalEventId' FROM receipt",
  "'activationEventId' FROM receipt",
  "entry.\"payload\" ->> 'applicationKind'",
  "entry.\"payload\" ->> 'requestedWorkspace'",
  "entry.\"payload\" ->> 'requestedRole'",
  'P0_REMOTE_EXACT_REVISIONS=PASS',
  "payload.get('service') != 'web'",
  "payload.get('releaseAuthority') != 'exact-sha'",
  'P0_MIGRATION_IMAGE_REVISION=PASS',
  'P0_CAUSAL_AUDIT_OUTBOX=PASS',
  'secretsOrRawTokensInEvidence',
]);

forbid('executor', [
  /(?:^|[;\n])\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/im,
  /prisma\s+migrate\s+(?:reset|dev)/i,
  /\bpsql\b/i,
  /POSTGRES_(?:USER|DB|PASSWORD)/,
  /docker\s+(?:build|commit|tag)\b/,
  /docker\s+compose[^\n]*(?:down|rm\s+-f)/,
  /docker\s+exec[^\n]*migration_database_url/,
  /docker\s+exec[^\n]*migration_(?:service|image)/,
  /docker\s+compose[^\n]*run[^\n]*migrat/i,
  /\b(?:demo|mock|localStorage|static-fallback)\b/i,
  /set\s+-x/,
  /curl[^\n]*(?:--verbose|-v\b|--trace)/,
  /StrictHostKeyChecking=no/,
  /sshpass/i,
  /(?:echo|printf)[^\n]*(?:PASSWORD|TOTP_SECRET|VERIFY_TOKEN|MFA_SECRET)/i,
  /gh\s+(?:secret|variable)\s+set/i,
]);

requireAll('decision', [
  'await this.audit(tx, {',
  'await this.emitRegistrationLifecycleReceipt(tx, application.id, correlationId);',
  'await this.emitRegistrationLifecycleReceipt(tx, applicationId, correlationId);',
  'FROM auth.emit_registration_lifecycle_receipt(',
  'REGISTRATION_LIFECYCLE_RECEIPT_MISSING',
  'return this.readResult(tx, applicationId, deliveryKey, true);',
  '...(!replayed && deliveryAuthorized(deliveryKey)',
]);
const decision = source.decision ?? '';
const replayRead = 'return this.readResult(tx, applicationId, deliveryKey, true);';
if (decision.split(replayRead).length - 1 !== 2) {
  failures.push(`${paths.decision}: both exact decision replay branches must suppress notification delivery`);
}
for (const marker of [
  'await this.emitRegistrationLifecycleReceipt(tx, application.id, correlationId);',
  'await this.emitRegistrationLifecycleReceipt(tx, applicationId, correlationId);',
]) {
  const index = decision.indexOf(marker);
  const auditIndex = decision.lastIndexOf('await this.audit(tx, {', index);
  if (index < 0 || auditIndex < 0 || auditIndex > index) {
    failures.push(`${paths.decision}: causal receipt must follow approval audit for ${JSON.stringify(marker)}`);
  }
}

requireAll('receiptMigration', [
  'pc_registration_receipt_authority',
  'NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS',
  'auth.emit_registration_lifecycle_receipt',
  'SECURITY DEFINER',
  'SET row_security = on',
  'auth.registration.lifecycle.receipt',
  "'registration-lifecycle:' || application.id || ':' || application.version::text",
  "'auditId', approval_audit.id",
  "'approvalEventId', approval_event.id",
  "'activationEventId', activation_event.id",
  'ON CONFLICT ("idempotencyKey") DO NOTHING',
  'REVOKE ALL ON FUNCTION auth.emit_registration_lifecycle_receipt(text, text)',
]);
forbid('receiptMigration', [
  /BYPASSRLS(?!\s+NOCREATEDB)/,
  /GRANT\s+EXECUTE[^;]+TO\s+PUBLIC/i,
  /GRANT\s+(?:UPDATE|DELETE)[^;]+pc_registration_receipt_authority/i,
]);

requireAll('registerBff', [
  'assertCsrf(request)',
  "request.headers.get('idempotency-key')",
  "'idempotency-key': idempotencyKey",
  'sendTransactionalMail',
  'if (!deliveryResult.delivered)',
  "status: 'EMAIL_VERIFICATION_REQUIRED'",
]);
requireAll('verifyBff', ['assertCsrf(request)', '/auth/registration/email/verify']);
requireAll('loginBff', ['assertCsrf(request)', 'mfaRequired', 'setupSecret']);
requireAll('mfaBff', ['assertCsrf(request)', '/auth/mfa/verify']);
requireAll('logoutBff', ['assertCsrf(request)', '/auth/logout']);
requireAll('staffBff', [
  'const registrationDecision = /^registration\\/applications\\/[^/]+\\/decision$/.test(path);',
  "request.headers.get('idempotency-key')",
  'idempotencyKey.length < 16',
  'idempotencyKey.length > 128',
  "code: 'IDEMPOTENCY_KEY_REQUIRED'",
  "'idempotency-key': idempotencyKey",
  'staffAccessToken',
  "'x-staff-access-session': staffAccessToken",
  'notificationDelivered',
  'assertCsrf(request)',
]);

requireAll('staffController', [
  "@Post('registration/applications/:applicationId/decision')",
  '@UseGuards(StaffAccessGuard)',
  '@StaffAccessModes(StaffAccessMode.CONTROL_PLANE)',
  '@StaffPermissions(StaffPermission.STAFF_REQUEST_APPROVE)',
  'await this.access.requirePermission(request.user, StaffPermission.STAFF_REQUEST_APPROVE)',
]);

requireAll('organizationController', [
  "@Post('organization-memberships/:membershipId/role')",
  'this.organizationInvitations.changeMembershipRole(',
]);
requireAll('organizationInvitations', [
  'await this.establishAdminIdentityContext(tx, user, admin);',
  'FROM auth.change_organization_membership_role(',
  "throw new ConflictException({ code: 'MEMBERSHIP_VERSION_CONFLICT' })",
]);
requireAll('proxyBff', [
  "headers.set('Authorization', `Bearer ${token}`);",
  "const demoToken = token.startsWith('demo.');",
  "if (!API_URL && !isDemo) return realBackendUnavailable('api_url_missing');",
]);

requireAll('runbook', [
  'REG.RU',
  '/production p0-first-customer current-main',
  'PC_PROD_P0_EMAIL_TEMPLATE',
  'PC_PROD_P0_REVIEWER_TOTP_SECRET',
  'PLATFORM_OWNER',
  'CONTROL_PLANE',
  'staff-request:approve',
  'MISSING_P0_CAUSAL_OUTBOX_PRODUCER',
  'auth.registration.lifecycle.receipt',
  'registration-lifecycle:<applicationId>:<applicationVersion>',
  'A=1',
  'B=0',
  'read-only',
  'external PostgreSQL',
  'AUTH_DATABASE_URL',
  'pc_registration_receipt_authority',
  'no-members',
  'write privileges',
  'append-only',
  'SECURITY DEFINER',
  'NUL-delimited pipe',
  'never',
]);

try {
  const scope = JSON.parse(source.scope ?? '{}');
  const expectedPaths = [
    '.github/workflows/production-p0-first-customer-acceptance.yml',
    'scripts/production-p0-first-customer-acceptance.sh',
    'scripts/check-production-p0-first-customer-acceptance.mjs',
    'docs/ops/production-p0-first-customer-acceptance.md',
    'docs/platform-v7/autopilot/scopes/production-p0-first-customer-acceptance-3749.json',
  ];
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push(`${paths.scope}: schema mismatch`);
  if (scope.branch !== 'fix/production-p0-first-customer-acceptance-3750') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.status !== 'active') failures.push(`${paths.scope}: scope is not active`);
  if (scope.productionHosting !== 'REG_RU_VPS_ONLY') failures.push(`${paths.scope}: hosting mismatch`);
  if (scope.newRecurringCostRub !== 0) failures.push(`${paths.scope}: recurring cost must remain zero`);
  if (JSON.stringify(scope.allowedPaths) !== JSON.stringify(expectedPaths)) failures.push(`${paths.scope}: exact path allowlist mismatch`);
  for (const needle of [
    'owner-authenticated issue command',
    'public production Web BFF',
    'two unique run-scoped public customer identities',
    'read-only PostgreSQL RLS assertion',
    'auth.registration.lifecycle.receipt',
    'MISSING_P0_CAUSAL_OUTBOX_PRODUCER',
  ]) {
    if (!JSON.stringify(scope).includes(needle)) failures.push(`${paths.scope}: missing authority ${JSON.stringify(needle)}`);
  }
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

const syntax = spawnSync('bash', ['-n', paths.executor], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`${paths.executor}: bash -n failed: ${syntax.stderr.trim()}`);

const emailRenderer = (source.executor ?? '').match(/render_email\(\) \{[\s\S]*?python3 <<'PY'\n([\s\S]*?)\nPY\n\}/);
if (!emailRenderer) {
  failures.push(`${paths.executor}: email-template renderer missing`);
} else {
  const runRenderer = (template) => spawnSync('python3', ['-c', emailRenderer[1]], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PC_P0_EMAIL_TEMPLATE: template,
      P0_EMAIL_IDENTITY: 'run-123-a',
      P0_EMAIL_RUN: 'run-123',
      P0_EMAIL_SLOT: 'a',
    },
  });
  const identityFixture = runRenderer('p0+{identity}@example.com');
  if (identityFixture.status !== 0 || identityFixture.stdout.trim() !== 'p0+run-123-a@example.com') {
    failures.push(`${paths.executor}: {identity} email-template fixture failed`);
  }
  const legacyFixture = runRenderer('p0+{run}-{slot}@example.com');
  if (legacyFixture.status !== 0 || legacyFixture.stdout.trim() !== 'p0+run-123-a@example.com') {
    failures.push(`${paths.executor}: {run}/{slot} email-template fixture failed`);
  }
  if (runRenderer('p0+{identity}-{run}-{slot}@example.com').status === 0) {
    failures.push(`${paths.executor}: ambiguous email-template fixture did not fail closed`);
  }
}

const remote = (source.executor ?? '').match(/<<'REMOTE'\n([\s\S]*?)\nREMOTE\n/);
if (!remote) {
  failures.push(`${paths.executor}: bounded remote authority heredoc missing`);
} else {
  const remoteSyntax = spawnSync('bash', ['-n'], { input: remote[1], encoding: 'utf8' });
  if (remoteSyntax.status !== 0) {
    failures.push(`${paths.executor}: remote authority bash -n failed: ${remoteSyntax.stderr.trim()}`);
  }

  const nodeBlocks = [...remote[1].matchAll(/<<'NODE'[^\n]*\n([\s\S]*?)\nNODE/g)];
  if (nodeBlocks.length !== 2) {
    failures.push(`${paths.executor}: expected exactly two bounded remote Node programs, found ${nodeBlocks.length}`);
  } else {
    for (const [index, block] of nodeBlocks.entries()) {
      const nodeSyntax = spawnSync(process.execPath, ['--check', '-'], { input: block[1], encoding: 'utf8' });
      if (nodeSyntax.status !== 0) {
        failures.push(`${paths.executor}: remote Node program ${index + 1} syntax failed: ${nodeSyntax.stderr.trim()}`);
      }
    }
  }

  const composeParser = remote[1].match(/python3 -c '\n([\s\S]*?)\n' <<< \"\$compose_json\"/);
  if (!composeParser) {
    failures.push(`${paths.executor}: Compose authority parser missing`);
  } else {
    const pythonSyntax = spawnSync(
      'python3',
      ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'],
      { input: composeParser[1], encoding: 'utf8' },
    );
    if (pythonSyntax.status !== 0) {
      failures.push(`${paths.executor}: Compose authority parser syntax failed: ${pythonSyntax.stderr.trim()}`);
    }
    const fixtureUrl = 'postgresql://migration:fixture@db.example:5432/platform?sslmode=require';
    const fixture = JSON.stringify({
      services: {
        api: { image: 'example/api:sha-fixture' },
        web: { image: 'example/web:sha-fixture' },
        migration: {
          image: 'ghcr.io/example/grainflow-migration:sha-fixture',
          command: ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
          environment: { DATABASE_URL: fixtureUrl },
        },
      },
    });
    const fixtureRun = spawnSync('python3', ['-c', composeParser[1]], { input: fixture, encoding: 'utf8' });
    const expectedFixture = [
      'migration',
      'ghcr.io/example/grainflow-migration:sha-fixture',
      Buffer.from(fixtureUrl).toString('base64'),
    ].join('\n');
    if (fixtureRun.status !== 0 || fixtureRun.stdout.trim() !== expectedFixture) {
      failures.push(`${paths.executor}: Compose authority parser fixture failed`);
    }
    const ambiguous = JSON.stringify({
      services: {
        migration: { image: 'example/grainflow-migration:a', environment: { DATABASE_URL: fixtureUrl } },
        migrate_shadow: { image: 'example/grainflow-migration:b', environment: { DATABASE_URL: fixtureUrl } },
      },
    });
    const ambiguousRun = spawnSync('python3', ['-c', composeParser[1]], { input: ambiguous, encoding: 'utf8' });
    if (ambiguousRun.status === 0) failures.push(`${paths.executor}: ambiguous migration authority did not fail closed`);
  }
}

const localRoleStatements = (source.executor ?? '').match(/SET LOCAL ROLE [A-Za-z0-9_]+/g) ?? [];
if (JSON.stringify(localRoleStatements) !== JSON.stringify(['SET LOCAL ROLE pc_registration_receipt_authority'])) {
  failures.push(`${paths.executor}: only the bounded receipt authority may be assumed: ${JSON.stringify(localRoleStatements)}`);
}

if (failures.length) {
  console.error('Production P0 first-customer acceptance contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: owner-only exact-main REG.RU acceptance requires two mail-delivered public BFF registrations, single-use verification, existing staff approval with recent MFA, customer MFA and relogin, a permitted action, authenticated cross-tenant BFF denial, paired read-only PostgreSQL RLS A=1/B=0, and exact causal registration audit/outbox receipts without exposing secrets.');
