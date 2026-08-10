#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-preflight.yml';
const migrationPath = 'apps/api/prisma/migrations/20260810071000_p0_reviewer_preflight_authority/migration.sql';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');

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
  'SET search_path = pg_catalog, auth, pg_temp',
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

if (/GRANT\s+SELECT[^;]*auth\.staff_assignments[^;]*(?:pc_staff_runtime|app_staff|one_deal_staff)/is.test(migration)) {
  console.error('Migration must not grant direct staff_assignments SELECT to a staff runtime.');
  process.exit(1);
}
if (/RETURNS\s+TABLE\s*\([^)]*(?:email|user_id|membership|organization|tenant|session|credential|secret)/is.test(migration)) {
  console.error('Reviewer preflight function must return aggregate counts only.');
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

console.log('PASS: production P0 reviewer preflight is owner-only, exact-main and function-only under pc_staff_runtime.');
