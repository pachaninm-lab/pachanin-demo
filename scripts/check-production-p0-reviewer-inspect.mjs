#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-inspect.yml';
const runnerPath = 'scripts/production-p0-reviewer-inspect.sh';
const migrationPath = 'apps/api/prisma/migrations/20260810124500_p0_reviewer_login_readiness/migration.sql';
const correctionPath = 'apps/api/prisma/migrations/20260810125000_p0_reviewer_login_readiness_acl_correction/migration.sql';
const compatibilityPath = 'apps/api/prisma/migrations/20260831160000_p0_reviewer_scrypt_readiness/migration.sql';
const passwordHashingPath = 'apps/api/src/modules/auth/password-hashing.ts';
const passwordResetPath = 'apps/api/src/modules/auth/password-reset.service.ts';
const passwordResetRepositoryPath = 'apps/api/src/modules/auth/password-reset.repository.ts';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const correction = fs.readFileSync(correctionPath, 'utf8');
const compatibility = fs.readFileSync(compatibilityPath, 'utf8');
const passwordHashing = fs.readFileSync(passwordHashingPath, 'utf8');
const passwordReset = fs.readFileSync(passwordResetPath, 'utf8');
const passwordResetRepository = fs.readFileSync(passwordResetRepositoryPath, 'utf8');

const workflowMarkers = [
  "github.event.issue.number == 3072",
  "github.event.issue.number == 4637",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-reviewer-inspect current-main'",
  'workflow_call:',
  'controller_authorized:',
  'controller_target_sha:',
  'controller_run_id:',
  'controller_issue_number:',
  "github.event.comment.body == '/production release current-main'",
  'permissions:\n  contents: read',
  'contents: read\n      issues: write',
  'group: pc-crop-production-release-candidate',
  'queue: max',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'bash scripts/production-p0-reviewer-inspect.sh',
  "PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER: ${{ inputs.controller_authorized == true && inputs.controller_issue_number || github.event.issue.number }}",
  "PC_P0_TARGET_SHA: ${{ inputs.controller_authorized == true && inputs.controller_target_sha || '' }}",
  'Bind reviewer readiness to immutable release candidate',
  'git merge-base --is-ancestor "$target" "$current_main"',
  'git checkout --detach "$target"',
  'node scripts/check-production-p0-reviewer-inspect.mjs',
  'if: inputs.controller_authorized != true',
  migrationPath,
  correctionPath,
  compatibilityPath,
  passwordHashingPath,
  passwordResetPath,
  passwordResetRepositoryPath,
];

for (const marker of workflowMarkers) {
  if (!workflow.includes(marker)) {
    console.error(`Missing reviewer inspect workflow marker: ${marker}`);
    process.exit(1);
  }
}
if ((workflow.match(/^\s+queue: max$/gmu) || []).length !== 2) {
  console.error('Reviewer workflow and production job must both retain every serialized pending invocation.');
  process.exit(1);
}

const runnerMarkers = [
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "COMMAND='/production p0-reviewer-inspect current-main'",
  "LEGACY_RELEASE_ISSUE_NUMBER='3072'",
  "CONTINUATION_ISSUE_NUMBER='4637'",
  ': "${PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER:?PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER is required}"',
  'RELEASE_ISSUE_NUMBER="$PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER"',
  'gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha',
  'assert_release_candidate()',
  'git merge-base --is-ancestor "$TARGET_SHA" "$current_main"',
  'StrictHostKeyChecking=yes',
  'ssh-keyscan -T 10',
  'org.opencontainers.image.revision',
  "label=com.docker.compose.service=auth-mail-worker",
  'label=com.docker.compose.project=$project',
  '(( ${#worker_ids[@]} == 1 ))',
  'worker_revision="$(docker inspect --format \'{{ index .Config.Labels "org.opencontainers.image.revision" }}\' "$worker_id")"',
  '[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" && "$worker_revision" == "$target_sha" ]]',
  '[[ "$worker_health" == healthy ]]',
  "http://127.0.0.1:3003/ready",
  'if(!r.ok)process.exit(1)',
  "x.component!=='auth-mail-worker'",
  "x.status!=='ready'||x.component!=='auth-mail-worker'||x.checks?.database!==true",
  'STAFF_DATABASE_URL',
  'docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs -',
  'sanitizeErrorCode',
  '(async () => {',
  '})().catch((error) => {',
  "principal.user_name !== 'pc_staff_runtime'",
  'principal.rolsuper',
  'principal.rolbypassrls',
  'principal.can_read_deals',
  'principal.can_read_users',
  'principal.can_read_memberships',
  'principal.can_read_organizations',
  'principal.can_read_credentials',
  'principal.can_read_assignments',
  "to_regprocedure('auth.staff_reviewer_preflight()')",
  "to_regprocedure('auth.staff_reviewer_login_readiness()')",
  "to_regprocedure('auth.staff_reviewer_credential_format_ready(text)')",
  'FROM auth.staff_reviewer_preflight() preflight',
  'CROSS JOIN auth.staff_reviewer_login_readiness() readiness',
  'P0_REVIEWER_READINESS_INVALID_COUNTS',
  'P0_REVIEWER_READINESS_NON_MONOTONIC',
  'P0_REVIEWER_LOGIN_NOT_READY',
  'P0_REVIEWER_CREDENTIAL_FORMAT_CONTRACT_INVALID',
  'REVIEWER_CREDENTIAL_FORMAT|V2_BCRYPT_OR_SCRYPT_131072_R8_P1|PASS',
  'function.prosrc',
  'formatSource !== expectedFormatSource',
  'wrong_version_ready',
  'invalid_alphabet_ready',
  'P0_REVIEWER_INSPECT_DB_ERROR|',
  'REVIEWER_LOGIN_READINESS|',
  'HUMAN_REVIEWER_LOGIN_CEREMONY_REQUIRED',
  'REVIEWER_PASSWORD_RESET_REQUIRED',
  'REVIEWER_MFA_ENROLLMENT_REQUIRED',
  'PRODUCTION_MUTATION=NONE',
  'REVIEWER_INSPECT_FAILED_CLOSED',
  'P0_REVIEWER_READINESS=PASS',
  'P0_REVIEWER_AUTH_MAIL_WORKER=EXACT_READY',
  'trap cleanup EXIT',
  'rm -f -- "$key_path" "$known_hosts"',
];

for (const marker of runnerMarkers) {
  if (!runner.includes(marker)) {
    console.error(`Missing reviewer login-readiness runner marker: ${marker}`);
    process.exit(1);
  }
}

const nodeInspectorMatch = runner.match(
  /docker exec -i "\$api_id" \/nodejs\/bin\/node --input-type=commonjs - <<'NODE'\n([\s\S]*?)\nNODE/,
);
if (!nodeInspectorMatch) {
  console.error('Reviewer login-readiness Node inspector is missing or not explicit CommonJS.');
  process.exit(1);
}
const nodeInspector = nodeInspectorMatch[1];
const asyncStart = nodeInspector.indexOf('(async () => {');
const asyncEnd = nodeInspector.indexOf('})().catch((error) => {');
const firstAwait = nodeInspector.indexOf('await ');
const lastAwait = nodeInspector.lastIndexOf('await ');
if (asyncStart < 0 || asyncEnd < 0 || firstAwait < asyncStart || lastAwait > asyncEnd) {
  console.error('Every Prisma await must remain inside the bounded async IIFE.');
  process.exit(1);
}
for (const pattern of [
  /console\.error\(\s*error\s*\)/,
  /error\.(?:message|stack)/,
  /JSON\.stringify\(\s*error/,
  /console\.log\([^\n]*(?:DATABASE_URL|STAFF_DATABASE_URL)/,
]) {
  if (pattern.test(nodeInspector)) {
    console.error(`Reviewer inspector diagnostics may expose sensitive runtime detail: ${pattern}`);
    process.exit(1);
  }
}

const forbiddenRuntime = [
  /FROM\s+auth\.staff_assignments/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+(?:auth\.|public\.)/i,
  /\bDELETE\s+FROM\b/i,
  /\bCREATE\s+(?:ROLE|USER|TABLE|FUNCTION)\b/i,
  /\bALTER\s+(?:ROLE|USER|TABLE)\b/i,
  /\bDROP\s+(?:ROLE|USER|TABLE|FUNCTION)\b/i,
  /bootstrap-platform-owner\.mjs/,
  /BOOTSTRAP_PLATFORM_OWNER_/,
  /PC_PROD_P0_STAFF_PASSWORD/,
  /PC_PROD_P0_STAFF_TOTP_SECRET/,
  /PC_PROD_P0_REVIEWER_PASSWORD/,
  /PC_PROD_P0_REVIEWER_TOTP_SECRET/,
  /password_hash/i,
  /mfa_secret_ciphertext/i,
  /mfa_backup_hashes/i,
];

for (const pattern of forbiddenRuntime) {
  if (pattern.test(workflow) || pattern.test(runner)) {
    console.error(`Reviewer inspect is not aggregate-only/read-only: ${pattern}`);
    process.exit(1);
  }
}

const migrationMarkers = [
  "rolname = 'pc_staff_authority'",
  "rolname = 'pc_staff_runtime'",
  'staff authority/runtime roles must remain membership-isolated',
  'users_staff_reviewer_readiness',
  'user_orgs_staff_reviewer_readiness',
  'organizations_staff_reviewer_readiness',
  "current_setting('app.staff_reviewer_readiness_scope', true) = 'aggregate'",
  'CREATE OR REPLACE FUNCTION auth.staff_reviewer_login_readiness()',
  'assignment_ready_count integer',
  'active_identity_ready_count integer',
  'membership_ready_count integer',
  'password_ready_count integer',
  'mfa_enrolled_ready_count integer',
  'login_ready_count integer',
  'LANGUAGE plpgsql',
  'SECURITY DEFINER',
  'STABLE',
  'SET search_path = pg_catalog, pg_temp',
  'SET row_security = on',
  "pg_catalog.set_config(\n    'app.staff_reviewer_readiness_scope',",
  "assignment.status = 'ACTIVE'",
  "subject.\"status\" = 'ACTIVE'",
  "membership.\"status\" = 'ACTIVE'",
  "organization.\"status\" = 'VERIFIED'",
  "subject.\"passwordHash\" ~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$'",
  'credential.mfa_enabled = true',
  'subject."mfaEnabled" = true',
  "credential.mfa_key_version = 'v1'",
  'credential.locked_until IS NULL',
  'ALTER FUNCTION auth.staff_reviewer_login_readiness() OWNER TO pc_staff_authority',
  'REVOKE ALL ON FUNCTION auth.staff_reviewer_login_readiness() FROM PUBLIC',
  'GRANT EXECUTE ON FUNCTION auth.staff_reviewer_login_readiness() TO pc_staff_runtime',
  "rolname IN ('app_staff', 'one_deal_staff')",
  "'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime'",
  "has_function_privilege(\n    'pc_staff_runtime',\n    'auth.staff_reviewer_login_readiness()',",
  "has_table_privilege('pc_staff_runtime', table_name, 'SELECT')",
  'FROM auth.staff_reviewer_login_readiness() AS result',
  'reviewer login-readiness aggregate proof is invalid',
];

for (const marker of migrationMarkers) {
  if (!migration.includes(marker)) {
    console.error(`Missing reviewer login-readiness migration marker: ${marker}`);
    process.exit(1);
  }
}

const correctionMarkers = [
  'DROP POLICY IF EXISTS credential_states_staff_reviewer_readiness',
  'ON auth.credential_states',
  "policy.schemaname = 'auth'",
  "policy.tablename = 'credential_states'",
  "policy.policyname = 'credential_states_staff_reviewer_readiness'",
  'credential-state reviewer readiness policy must not remain inert',
  "rolname = 'pc_staff_authority'",
  'pc_staff_authority must remain membership-isolated',
  "has_column_privilege(\n      'pc_staff_authority',\n      'auth.credential_states',",
  "has_table_privilege('pc_staff_authority', 'auth.credential_states', 'UPDATE')",
  "has_table_privilege('pc_staff_runtime', 'auth.credential_states', 'SELECT')",
  "'auth.staff_reviewer_login_readiness()',",
  'pc_staff_runtime readiness EXECUTE grant is missing',
];
for (const marker of correctionMarkers) {
  if (!correction.includes(marker)) {
    console.error(`Missing reviewer readiness ACL-correction marker: ${marker}`);
    process.exit(1);
  }
}

const compatibilityMarkers = [
  'CREATE OR REPLACE FUNCTION auth.staff_reviewer_credential_format_ready(candidate text)',
  'RETURNS boolean',
  'LANGUAGE sql',
  'IMMUTABLE',
  'STRICT',
  'SECURITY INVOKER',
  'SET search_path = pg_catalog, pg_temp',
  "candidate ~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$'",
  "candidate ~ '^\\$scrypt\\$v=1\\$n=131072,r=8,p=1\\$[A-Za-z0-9_-]{21}[AQgw]\\$[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'",
  'ALTER FUNCTION auth.staff_reviewer_credential_format_ready(text)',
  'OWNER TO pc_staff_authority',
  'REVOKE ALL ON FUNCTION auth.staff_reviewer_credential_format_ready(text) FROM PUBLIC',
  'GRANT EXECUTE ON FUNCTION auth.staff_reviewer_credential_format_ready(text)',
  'P0_REVIEWER_CREDENTIAL_FORMAT_V2_BCRYPT_OR_SCRYPT_131072_R8_P1',
  'CREATE OR REPLACE FUNCTION auth.staff_reviewer_login_readiness()',
  'auth.staff_reviewer_credential_format_ready(subject."passwordHash") AS password_ready',
  'CREATE OR REPLACE FUNCTION auth.staff_reviewer_password_reset_subject()',
  'OR NOT auth.staff_reviewer_credential_format_ready(subject."passwordHash")',
  "bcrypt_sample text := '$2b$12$' || repeat('A', 53)",
  "scrypt_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'",
  "stale_scrypt_sample text := '$scrypt$v=1$n=65536,r=8,p=1$'",
  "noncanonical_salt_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'",
  "noncanonical_key_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'",
  "wrong_version_sample text := '$scrypt$v=2$n=131072,r=8,p=1$'",
  "wrong_r_sample text := '$scrypt$v=1$n=131072,r=16,p=1$'",
  "wrong_p_sample text := '$scrypt$v=1$n=131072,r=8,p=2$'",
  "short_salt_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'",
  "long_key_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'",
  "invalid_alphabet_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'",
  'reviewer credential-format truth table is invalid',
  'PUBLIC must not execute the reviewer credential-format helper',
];
for (const marker of compatibilityMarkers) {
  if (!compatibility.includes(marker)) {
    console.error(`Missing reviewer scrypt-readiness compatibility marker: ${marker}`);
    process.exit(1);
  }
}
if ((compatibility.match(/auth\.staff_reviewer_credential_format_ready\(subject\."passwordHash"\)/gmu) || []).length !== 2) {
  console.error('Both reviewer readiness and reset eligibility must use the same credential-format predicate.');
  process.exit(1);
}
const helperDefinition = compatibility.match(
  /CREATE OR REPLACE FUNCTION auth\.staff_reviewer_credential_format_ready\(candidate text\)([\s\S]*?)\$function\$;/u,
)?.[1] ?? '';
if (!helperDefinition.includes('SECURITY INVOKER') || helperDefinition.includes('SECURITY DEFINER')) {
  console.error('Reviewer credential-format helper must remain a table-free SECURITY INVOKER function.');
  process.exit(1);
}
const helperBody = compatibility.match(
  /CREATE OR REPLACE FUNCTION auth\.staff_reviewer_credential_format_ready\(candidate text\)[\s\S]*?AS \$function\$\n([\s\S]*?)\n\$function\$;/u,
)?.[1]?.trim().replace(/\s+/gu, ' ') ?? '';
const expectedHelperBody = [
  'SELECT',
  "candidate ~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$'",
  "OR candidate ~ '^\\$scrypt\\$v=1\\$n=131072,r=8,p=1\\$[A-Za-z0-9_-]{21}[AQgw]\\$[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'",
].join(' ');
if (helperBody !== expectedHelperBody) {
  console.error('Reviewer credential-format helper body must contain exactly the reviewed bcrypt and current-scrypt predicates.');
  process.exit(1);
}

for (const marker of [
  "const SCRYPT_KEY_BYTES = 32",
  "const SCRYPT_SALT_BYTES = 16",
  "const SCRYPT_SCHEME = 'scrypt'",
  'const SCRYPT_VERSION = 1',
  'PASSWORD_SCRYPT_PARAMS = Object.freeze({ N: 131_072, r: 8, p: 1 })',
  'return `$${SCRYPT_SCHEME}$v=${SCRYPT_VERSION}$n=${N},r=${r},p=${p}$${salt.toString(\'base64url\')}$${key.toString(\'base64url\')}`',
  'return encodeScryptHash(salt, key)',
]) {
  if (!passwordHashing.includes(marker)) {
    console.error(`Password-hashing implementation drifted from reviewer credential-format readiness: ${marker}`);
    process.exit(1);
  }
}
for (const marker of [
  "import { hashPassword } from './password-hashing'",
  'const passwordHash = await hashPassword(newPassword)',
]) {
  if (!passwordReset.includes(marker)) {
    console.error(`Password-reset writer drifted from the reviewed hash-format authority: ${marker}`);
    process.exit(1);
  }
}
if (!/this\.repository\.replacePassword\(\s*tx,\s*challenge\.id,\s*challenge\.user_id,\s*passwordHash,\s*now,\s*\)/u.test(passwordReset)) {
  console.error('Password reset must pass the current hash unchanged into the bounded repository sink.');
  process.exit(1);
}
if (!/FROM auth\.replace_password_after_reset\(\s*\$\{challengeId\},\s*\$\{userId\},\s*\$\{passwordHash\},\s*\$\{now\}\s*\)/u.test(passwordResetRepository)) {
  console.error('Password-reset repository must bind the reviewed hash into the PostgreSQL replacement authority.');
  process.exit(1);
}

if (/RETURNS\s+TABLE\s*\([^)]*(?:email|user_id|membership_id|organization_id|tenant_id|session_id|password_hash|secret|ciphertext|backup|token)/is.test(migration)) {
  console.error('Reviewer login-readiness function must return aggregate counts only.');
  process.exit(1);
}
const readinessMigrations = migration + '\n' + correction + '\n' + compatibility;
if (/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)[^;]*(?:pc_staff_runtime|app_staff|one_deal_staff)/is.test(readinessMigrations)) {
  console.error('No staff runtime may receive direct table privileges from the readiness migrations.');
  process.exit(1);
}
if (/\b(?:INSERT\s+INTO|UPDATE\s+(?:auth|public)\.|DELETE\s+FROM\s+(?:auth|public)\.)\b/i.test(readinessMigrations)) {
  console.error('Reviewer login-readiness migrations must not mutate business or identity rows.');
  process.exit(1);
}
if (/\b(?:CREATE|ALTER)\s+(?:ROLE|USER)\b/i.test(readinessMigrations)) {
  console.error('Reviewer login-readiness migrations must reuse confined principals, not create/elevate them.');
  process.exit(1);
}
if (/CREATE\s+POLICY\s+[^;]*credential_states/is.test(correction)) {
  console.error('The ACL correction must not recreate a policy on auth.credential_states.');
  process.exit(1);
}
if (!/permissions:\n\s+contents: read/.test(workflow)) {
  console.error('Top-level workflow permissions must remain contents: read.');
  process.exit(1);
}
if (!/permissions:\n\s+contents: read\n\s+issues: write/.test(workflow)) {
  console.error('Production inspect may add only issues: write to contents: read.');
  process.exit(1);
}

console.log('PASS: reviewer login-readiness inspect is owner-only, immutable-candidate-bound, exact-worker-ready, bcrypt/scrypt-format-aware, pinned-SSH, aggregate-only, identity-RLS-bounded, credential-state-ACL-bounded, Node-24-safe and mutation-free.');
