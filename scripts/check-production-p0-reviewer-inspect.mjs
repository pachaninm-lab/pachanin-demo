#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-inspect.yml';
const runnerPath = 'scripts/production-p0-reviewer-inspect.sh';
const migrationPath = 'apps/api/prisma/migrations/20260810124500_p0_reviewer_login_readiness/migration.sql';
const correctionPath = 'apps/api/prisma/migrations/20260810125000_p0_reviewer_login_readiness_acl_correction/migration.sql';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const correction = fs.readFileSync(correctionPath, 'utf8');

const workflowMarkers = [
  "github.event.issue.number == 3072",
  "github.event.issue.number == 4637",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-reviewer-inspect current-main'",
  'permissions:\n  contents: read',
  'contents: read\n      issues: write',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'bash scripts/production-p0-reviewer-inspect.sh',
  'PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER: ${{ github.event.issue.number }}',
  migrationPath,
  correctionPath,
];

for (const marker of workflowMarkers) {
  if (!workflow.includes(marker)) {
    console.error(`Missing reviewer inspect workflow marker: ${marker}`);
    process.exit(1);
  }
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
  'StrictHostKeyChecking=yes',
  'ssh-keyscan -T 10',
  'org.opencontainers.image.revision',
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
  'FROM auth.staff_reviewer_preflight() preflight',
  'CROSS JOIN auth.staff_reviewer_login_readiness() readiness',
  'P0_REVIEWER_READINESS_INVALID_COUNTS',
  'P0_REVIEWER_READINESS_NON_MONOTONIC',
  'P0_REVIEWER_INSPECT_DB_ERROR|',
  'REVIEWER_LOGIN_READINESS|',
  'HUMAN_REVIEWER_LOGIN_CEREMONY_REQUIRED',
  'REVIEWER_PASSWORD_RESET_REQUIRED',
  'REVIEWER_MFA_ENROLLMENT_REQUIRED',
  'PRODUCTION_MUTATION=NONE',
  'REVIEWER_INSPECT_FAILED_CLOSED',
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

if (/RETURNS\s+TABLE\s*\([^)]*(?:email|user_id|membership_id|organization_id|tenant_id|session_id|password_hash|secret|ciphertext|backup|token)/is.test(migration)) {
  console.error('Reviewer login-readiness function must return aggregate counts only.');
  process.exit(1);
}
if (/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)[^;]*(?:pc_staff_runtime|app_staff|one_deal_staff)/is.test(migration + '\n' + correction)) {
  console.error('No staff runtime may receive direct table privileges from the readiness migrations.');
  process.exit(1);
}
if (/\b(?:INSERT\s+INTO|UPDATE\s+(?:auth|public)\.|DELETE\s+FROM\s+(?:auth|public)\.)\b/i.test(migration + '\n' + correction)) {
  console.error('Reviewer login-readiness migrations must not mutate business or identity rows.');
  process.exit(1);
}
if (/\b(?:CREATE|ALTER)\s+(?:ROLE|USER)\b/i.test(migration + '\n' + correction)) {
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

console.log('PASS: reviewer login-readiness inspect is owner-only, exact-main, pinned-SSH, aggregate-only, identity-RLS-bounded, credential-state-ACL-bounded, Node-24-safe and mutation-free.');
