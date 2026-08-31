#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-preflight.yml';
const migrationPath = 'apps/api/prisma/migrations/20260810071000_p0_reviewer_preflight_authority/migration.sql';
const repairMigrationPath = 'apps/api/prisma/migrations/20260810093500_p0_staff_authority_acl_repair/migration.sql';
const runtimeGrantsPath = 'infra/kind/production-like/postgresql-runtime-grants.sql';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const repairMigration = fs.readFileSync(repairMigrationPath, 'utf8');
const runtimeGrants = fs.readFileSync(runtimeGrantsPath, 'utf8');

const requiredWorkflow = [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-reviewer-preflight current-main'",
  'DEFAULT_HOST: 195.19.12.120',
  'SSH_HOST_FINGERPRINT_SECRET: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile=',
  'git fetch --no-tags origin main',
  'gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha',
  "--filter 'label=com.docker.compose.service=web'",
  "--filter 'label=com.docker.compose.service=api'",
  'org.opencontainers.image.revision',
  'docker exec -i "$api_id" /nodejs/bin/node -',
  'sanitizeErrorCode',
  '(async () => {',
  '})().catch((error) => {',
  'P0_REVIEWER_PREFLIGHT_DB_ERROR|',
  'P0_REVIEWER_PREFLIGHT_INVALID_COUNTS',
  'process.exitCode = 34',
  'STAFF_DATABASE_URL',
  "principal.user_name !== 'pc_staff_runtime'",
  'principal.rolsuper',
  'principal.rolbypassrls',
  'principal.can_read_deals',
  'principal.can_read_staff_assignments',
  "to_regprocedure('auth.staff_reviewer_preflight()')",
  'principal.reviewer_preflight_execute',
  'FROM auth.staff_reviewer_preflight()',
  'PRODUCTION_MUTATION=NONE',
  'rm -f -- "$key_path"',
  'rm -f -- "$known_hosts"',
];
for (const marker of requiredWorkflow) {
  if (!workflow.includes(marker)) {
    console.error(`Missing required reviewer-preflight marker: ${marker}`);
    process.exit(1);
  }
}

const stdinInspector = 'docker exec -i "$api_id" /nodejs/bin/node - <<\'NODE\'';
if ((workflow.split(stdinInspector).length - 1) !== 1) {
  console.error('Reviewer preflight must attach stdin exactly once for its heredoc-fed Node inspector.');
  process.exit(1);
}
if (/docker exec\s+"\$api_id"\s+\/nodejs\/bin\/node\s+-\s+<<'NODE'/.test(workflow)) {
  console.error('Reviewer preflight must not detach stdin from the heredoc-fed Node inspector.');
  process.exit(1);
}

const inspectorMatch = workflow.match(/docker exec -i "\$api_id" \/nodejs\/bin\/node - <<'NODE'\n([\s\S]*?)\n\s*NODE/);
if (!inspectorMatch) {
  console.error('Reviewer preflight Node inspector block is missing.');
  process.exit(1);
}
const inspector = inspectorMatch[1];
const asyncStart = inspector.indexOf('(async () => {');
const asyncEnd = inspector.indexOf('})().catch((error) => {');
const firstAwait = inspector.indexOf('await ');
const lastAwait = inspector.lastIndexOf('await ');
if (asyncStart < 0 || asyncEnd < 0 || firstAwait < asyncStart || lastAwait > asyncEnd) {
  console.error('Reviewer preflight Prisma awaits must remain inside the bounded async IIFE.');
  process.exit(1);
}
for (const pattern of [
  /console\.error\(\s*error\s*\)/,
  /error\.(?:message|stack)/,
  /JSON\.stringify\(\s*error/,
  /console\.log\([^\n]*(?:DATABASE_URL|STAFF_DATABASE_URL)/,
]) {
  if (pattern.test(inspector)) {
    console.error(`Reviewer preflight diagnostics may expose sensitive runtime detail: ${pattern}`);
    process.exit(1);
  }
}

const forbiddenWorkflow = [
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
  /secrets\.PC_PROD_P0_REVIEWER_PASSWORD/,
  /secrets\.PC_PROD_P0_REVIEWER_TOTP_SECRET/,
];
for (const pattern of forbiddenWorkflow) {
  if (pattern.test(workflow)) {
    console.error(`Reviewer preflight is not bounded/read-only: ${pattern}`);
    process.exit(1);
  }
}

const requiredMigration = [
  'CREATE OR REPLACE FUNCTION auth.staff_reviewer_preflight()',
  'RETURNS TABLE (\n  active_owner_count integer,\n  usable_reviewer_count integer\n)',
  'SECURITY DEFINER',
  'STABLE',
  'SET search_path = pg_catalog, pg_temp',
  'SET row_security = on',
  "assignment.role = 'PLATFORM_OWNER'",
  "assignment.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')",
  "assignment.status IN ('ELIGIBLE', 'ACTIVE')",
  'assignment.revoked_at IS NULL',
  'assignment.suspended_at IS NULL',
  'ALTER FUNCTION auth.staff_reviewer_preflight() OWNER TO pc_staff_authority',
  'REVOKE ALL ON FUNCTION auth.staff_reviewer_preflight() FROM PUBLIC',
  'GRANT EXECUTE ON FUNCTION auth.staff_reviewer_preflight() TO pc_staff_runtime',
  "rolname IN ('app_staff', 'one_deal_staff')",
  "'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime'",
  "'app_auth', 'app_runtime', 'app_storage', 'app_outbox'",
  "'one_deal_auth', 'one_deal_app', 'one_deal_storage'",
  "has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'SELECT')",
  "'pc_staff_runtime', 'auth.staff_reviewer_preflight()', 'EXECUTE'",
];
for (const marker of requiredMigration) {
  if (!migration.includes(marker)) {
    console.error(`Missing bounded reviewer authority marker: ${marker}`);
    process.exit(1);
  }
}

if (/SET search_path\s*=\s*[^\n]*(?:\bauth\b|\bpublic\b)/i.test(migration)) {
  console.error('Reviewer preflight SECURITY DEFINER search_path must not include application schemas.');
  process.exit(1);
}
if (/GRANT\s+SELECT[^;]*auth\.staff_assignments[^;]*(?:pc_staff_runtime|app_staff|one_deal_staff)/is.test(migration)) {
  console.error('Migration must not grant direct staff_assignments SELECT to a staff runtime.');
  process.exit(1);
}
if (/RETURNS\s+TABLE\s*\([^)]*(?:email|user_id|membership|organization|tenant|session|credential|secret)/is.test(migration)) {
  console.error('Reviewer preflight function must return aggregate counts only.');
  process.exit(1);
}

const requiredRepair = [
  "rolname = 'pc_staff_authority'",
  "rolname = 'pc_staff_runtime'",
  'staff authority/runtime roles must remain membership-isolated',
  "to_regprocedure('auth.staff_reviewer_preflight()')",
  "owner.rolname = 'pc_staff_authority'",
  'GRANT USAGE ON SCHEMA auth TO pc_staff_authority',
  'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\n  ON auth.staff_assignments FROM pc_staff_authority',
  'GRANT SELECT ON auth.staff_assignments TO pc_staff_authority',
  'REVOKE ALL PRIVILEGES ON auth.staff_assignments FROM pc_staff_runtime',
  "rolname IN ('app_staff', 'one_deal_staff')",
  "has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'SELECT')",
  "has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'SELECT')",
  "'pc_staff_runtime', 'auth.staff_reviewer_preflight()', 'EXECUTE'",
  'FROM auth.staff_reviewer_preflight() AS result',
];
for (const marker of requiredRepair) {
  if (!repairMigration.includes(marker)) {
    console.error(`Missing staff-authority ACL repair marker: ${marker}`);
    process.exit(1);
  }
}

if (/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)[^;]*auth\.staff_assignments[^;]*(?:pc_staff_runtime|app_staff|one_deal_staff)/is.test(repairMigration)) {
  console.error('ACL repair must not grant direct staff_assignments table privileges to a staff runtime.');
  process.exit(1);
}
if (!/GRANT\s+SELECT\s+ON\s+auth\.staff_assignments\s+TO\s+pc_staff_authority\s*;/is.test(repairMigration)) {
  console.error('ACL repair must restore exactly the bounded pc_staff_authority staff_assignments read.');
  process.exit(1);
}
if (/\b(?:INSERT\s+INTO|UPDATE\s+auth\.staff_assignments|DELETE\s+FROM\s+auth\.staff_assignments)\b/i.test(repairMigration)) {
  console.error('ACL repair must not mutate staff assignment rows.');
  process.exit(1);
}
if (/\b(?:CREATE|ALTER)\s+(?:ROLE|USER)\b/i.test(repairMigration)) {
  console.error('ACL repair must not create or elevate PostgreSQL principals.');
  process.exit(1);
}

for (const marker of [
  'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, auth FROM app_staff;',
  'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, auth FROM app_staff;',
  'GRANT EXECUTE ON FUNCTION auth.staff_reviewer_preflight() TO app_staff;',
]) {
  if (!runtimeGrants.includes(marker)) {
    console.error(`Production-like staff runtime grant contract missing marker: ${marker}`);
    process.exit(1);
  }
}
if (/GRANT\s+SELECT[^;]*auth\.staff_assignments[^;]*app_staff/is.test(runtimeGrants)) {
  console.error('Production-like app_staff must not receive direct staff_assignments SELECT.');
  process.exit(1);
}

if (!/permissions:\n\s+contents: read/.test(workflow)) {
  console.error('Top-level permissions must remain contents: read');
  process.exit(1);
}
if (!/permissions:\n\s+contents: read\n\s+issues: write/.test(workflow)) {
  console.error('Production job may add only issues: write to contents: read');
  process.exit(1);
}

console.log('PASS: production P0 reviewer preflight is owner-only, exact-main, aggregate-only, stdin-safe and async-safe; diagnostics remain bounded while every staff runtime remains table-free.');
