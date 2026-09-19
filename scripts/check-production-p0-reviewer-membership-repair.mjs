#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-membership-repair.yml';
const runnerPath = 'scripts/production-p0-reviewer-membership-repair.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-membership-repair.mjs';
const migrationPath = 'apps/api/prisma/migrations/20260810170000_p0_reviewer_membership_repair/migration.sql';
const ownerIdentityMigrationPath = 'apps/api/prisma/migrations/20260811023000_p0_reviewer_owner_identity_semantics/migration.sql';
const candidateScopeMigrationPath = 'apps/api/prisma/migrations/20260811090000_p0_reviewer_membership_candidate_scope/migration.sql';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-membership-repair-3799.json';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const ownerIdentityMigration = fs.readFileSync(ownerIdentityMigrationPath, 'utf8');
const candidateScopeMigration = fs.readFileSync(candidateScopeMigrationPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const requireMarkers = (label, source, markers) => {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      console.error(`Missing ${label} marker: ${marker}`);
      process.exit(1);
    }
  }
};

requireMarkers('workflow', workflow, [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-reviewer-membership-repair current-main'",
  'permissions:\n  contents: read',
  'contents: read\n      issues: write',
  'cancel-in-progress: false',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'bash scripts/production-p0-reviewer-membership-repair.sh',
  migrationPath,
  ownerIdentityMigrationPath,
  candidateScopeMigrationPath,
  scopePath,
  'postgresql-candidate-scope:',
  'PostgreSQL 16 unrelated-membership repair proof',
  'prisma migrate deploy --schema prisma/schema.prisma',
  'SET SESSION AUTHORIZATION pc_staff_runtime',
  "1|1|0|0|0|0",
  "REPAIRED|1|1|1|0|0|0|1|1|1|1",
  "ALREADY_REPAIRED|1|1|1|0|0|0|1|1|1|1",
  "2|1|1|1|1|1",
]);

requireMarkers('runner', runner, [
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "COMMAND='/production p0-reviewer-membership-repair current-main'",
  'gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha',
  'git rev-parse origin/main',
  'StrictHostKeyChecking=yes',
  'ssh-keyscan -T 10',
  'org.opencontainers.image.revision',
  'STAFF_DATABASE_URL',
  'docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs -',
  "principal.user_name !== 'pc_staff_runtime'",
  "to_regprocedure('auth.repair_single_reviewer_membership()')",
  'Prisma.TransactionIsolationLevel.Serializable',
  'FROM auth.repair_single_reviewer_membership()',
  'REVIEWER_MEMBERSHIP_REPAIR|',
  'REPAIRED',
  'ALREADY_REPAIRED',
  'PRODUCTION_MUTATION=REVIEWER_MEMBERSHIP_ONLY',
  'REVIEWER_PASSWORD_RESET_REQUIRED',
  'REVIEWER_MEMBERSHIP_REPAIR_FAILED_CLOSED',
  'trap cleanup EXIT',
  'rm -f -- "$key_path" "$known_hosts"',
]);

const nodeMatch = runner.match(
  /docker exec -i "\$api_id" \/nodejs\/bin\/node --input-type=commonjs - <<'NODE'\n([\s\S]*?)\nNODE/,
);
if (!nodeMatch) {
  console.error('Bounded CommonJS reviewer repair executor is missing.');
  process.exit(1);
}
const embeddedNode = nodeMatch[1];
const syntax = spawnSync(process.execPath, ['--check'], {
  input: embeddedNode,
  encoding: 'utf8',
});
if (syntax.status !== 0) {
  console.error('Embedded reviewer repair Node executor is not syntactically valid.');
  process.exit(1);
}

for (const pattern of [
  /console\.error\(\s*error\s*\)/,
  /error\.(?:message|stack)/,
  /JSON\.stringify\(\s*error/,
  /console\.(?:log|error)\([^\n]*(?:DATABASE_URL|STAFF_DATABASE_URL)/,
  /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|ALTER\s+|CREATE\s+|DROP\s+)\b/i,
  /bootstrap-platform-owner\.mjs/,
  /BOOTSTRAP_PLATFORM_OWNER_/,
  /PC_PROD_P0_(?:STAFF|REVIEWER)_(?:PASSWORD|TOTP_SECRET)/,
  /passwordHash|password_hash|mfaSecret|mfa_secret|backup_code|backupHash/i,
]) {
  if (pattern.test(embeddedNode)) {
    console.error(`Reviewer repair executor is broader or more sensitive than allowed: ${pattern}`);
    process.exit(1);
  }
}

if (!/\$transaction\([\s\S]*FROM auth\.repair_single_reviewer_membership\(\)[\s\S]*TransactionIsolationLevel\.Serializable/.test(embeddedNode)) {
  console.error('Reviewer repair must be one SERIALIZABLE function-only transaction.');
  process.exit(1);
}

requireMarkers('migration', migration, [
  'pc_reviewer_membership_repair_authority',
  'NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
  'reviewer membership repair authority must remain membership-isolated',
  "rolname = 'pc_staff_runtime'",
  "to_regprocedure('auth.staff_reviewer_login_readiness()')",
  "to_regprocedure('auth.lock_staff_access_event_chain(text)')",
  "relation.relname IN ('users', 'user_orgs', 'organizations', 'outbox_entries')",
  'relation.relrowsecurity',
  'relation.relforcerowsecurity',
  'users_reviewer_membership_repair_select',
  'organizations_reviewer_membership_repair_select',
  'organizations_reviewer_membership_repair_insert',
  'user_orgs_reviewer_membership_repair_select',
  'user_orgs_reviewer_membership_repair_insert',
  'outbox_entries_reviewer_membership_repair_select',
  'outbox_entries_reviewer_membership_repair_insert',
  "current_setting('app.reviewer_membership_repair_scope', true) = 'single'",
  "'org_pc_internal_platform_v1'",
  "'tenant_pc_internal_platform_v1'",
  "'membership_pc_reviewer_internal_v1'",
  "'0000000000'",
  "'Прозрачная Цена — внутренний контур'",
  "'PLATFORM_INTERNAL'",
  "'GUEST'",
  "'employee'",
  'CREATE OR REPLACE FUNCTION auth.repair_single_reviewer_membership()',
  'SECURITY DEFINER',
  'SET search_path = pg_catalog, pg_temp',
  'SET row_security = on',
  "session_user <> 'pc_staff_runtime'",
  "current_setting('transaction_isolation') <> 'serializable'",
  "pg_catalog.hashtextextended('auth.repair_single_reviewer_membership.v1', 0)",
  'FROM auth.staff_reviewer_login_readiness() readiness',
  "assignment.role = 'PLATFORM_OWNER'",
  "assignment.status = 'ACTIVE'",
  'PERFORM auth.lock_staff_access_event_chain(v_user_id)',
  "'staff.identity.membership.repaired'",
  "'P0_REVIEWER_MEMBERSHIP_REPAIR_3799'",
  "'auth.staff.reviewer.membership.repaired'",
  "'p0-reviewer-membership-repair:v1'",
  "public.digest(pg_catalog.convert_to(v_audit_material::text, 'UTF8'), 'sha256')",
  'ALTER FUNCTION auth.repair_single_reviewer_membership()',
  'OWNER TO pc_reviewer_membership_repair_authority',
  'REVOKE ALL ON FUNCTION auth.repair_single_reviewer_membership() FROM PUBLIC',
  'GRANT EXECUTE ON FUNCTION auth.repair_single_reviewer_membership()',
  'TO pc_staff_runtime',
  'pc_staff_runtime must remain function-only for reviewer repair',
  'reviewer membership repair RLS policy set is incomplete',
]);

for (const migrationFilterPath of [
  migrationPath,
  ownerIdentityMigrationPath,
  candidateScopeMigrationPath,
]) {
  const workflowReferences = workflow.split(migrationFilterPath).length - 1;
  if (workflowReferences !== 2) {
    console.error(`Reviewer repair workflow must cover ${migrationFilterPath} on pull_request and push.`);
    process.exit(1);
  }
}

requireMarkers('owner-identity correction migration', ownerIdentityMigration, [
  "v_needle constant text := 'assignment.activated_at IS NOT NULL'",
  "EXECUTE replace(v_definition, v_needle, 'TRUE')",
  "owner.rolname = 'pc_reviewer_membership_repair_authority'",
  "'pc_staff_runtime'",
  "'auth.repair_single_reviewer_membership()'",
  "'EXECUTE'",
]);

requireMarkers('candidate-scope correction migration', candidateScopeMigration, [
  'CONFLICTING_EXISTING_MEMBERSHIP',
  'v_old_query constant text',
  'WHERE membership."userId" = v_user_id;',
  'v_new_query constant text',
  'membership."id" = \'membership_pc_reviewer_internal_v1\'',
  'membership."organizationId" = \'org_pc_internal_platform_v1\'',
  'v_occurrences <> 1',
  'EXECUTE replace(v_definition, v_old_query, v_new_query)',
  'global reviewer membership candidate scan remains',
  'v_new_occurrences <> 1',
  "owner.rolname = 'pc_reviewer_membership_repair_authority'",
  "'pc_staff_runtime'",
  "'auth.repair_single_reviewer_membership()'",
  "'EXECUTE'",
  'rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole',
]);

for (const pattern of [
  /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|TRUNCATE\s+|ALTER\s+(?:TABLE|POLICY|ROLE)|CREATE\s+ROLE|DROP\s+ROLE)\b/i,
  /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)/i,
  /\b(?:BYPASSRLS|SUPERUSER)\b/i,
]) {
  if (pattern.test(candidateScopeMigration)) {
    console.error(`Candidate-scope correction migration is broader than function-definition replacement: ${pattern}`);
    process.exit(1);
  }
}
if ((candidateScopeMigration.match(/EXECUTE replace\(v_definition, v_old_query, v_new_query\)/g) || []).length !== 1) {
  console.error('Candidate-scope correction must replace exactly one bounded function query.');
  process.exit(1);
}

if (!/CREATE OR REPLACE FUNCTION auth\.repair_single_reviewer_membership\(\)\s*RETURNS TABLE/.test(migration)) {
  console.error('Repair authority must expose exactly one no-argument function.');
  process.exit(1);
}
const repairSignature = migration.match(
  /CREATE OR REPLACE FUNCTION auth\.repair_single_reviewer_membership\(([^)]*)\)/,
);
if (!repairSignature || repairSignature[1].trim() !== '') {
  console.error('Repair function may not accept an email, user, organization, tenant or any other argument.');
  process.exit(1);
}
if (/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)[^;]*(?:pc_staff_runtime|app_staff|one_deal_staff)/is.test(migration)) {
  console.error('No LOGIN staff runtime may receive direct table privileges.');
  process.exit(1);
}
if (/\b(?:UPDATE|DELETE)\s+(?:public\.|auth\.)/i.test(migration)) {
  console.error('Reviewer membership repair must not expose UPDATE or DELETE business mutations.');
  process.exit(1);
}
if (/\bINSERT\s+INTO\s+(?!public\."organizations"|public\."user_orgs"|auth\.staff_access_events|public\."outbox_entries")/i.test(migration)) {
  console.error('Reviewer repair inserts outside its four bounded evidence/membership relations.');
  process.exit(1);
}
if (/\b(?:UPDATE|INSERT\s+INTO)\s+(?:public\."users"|auth\.credential_states|auth\.staff_assignments|auth\.sessions|auth\.mfa_)/i.test(migration)) {
  console.error('Reviewer repair may not change identity, assignment, password, MFA or session state.');
  process.exit(1);
}
const returnSignature = migration.match(
  /CREATE OR REPLACE FUNCTION auth\.repair_single_reviewer_membership\(\)\s*RETURNS TABLE \(([\s\S]*?)\)\s*LANGUAGE plpgsql/,
);
const expectedReturnSignature = [
  'result_code text',
  'assignment_ready_count integer',
  'active_identity_ready_count integer',
  'membership_ready_count integer',
  'password_ready_count integer',
  'mfa_enrolled_ready_count integer',
  'login_ready_count integer',
  'internal_organization_count integer',
  'internal_membership_count integer',
  'audit_event_count integer',
  'outbox_event_count integer',
].join(',');
const actualReturnSignature = returnSignature?.[1]
  .split('\n')
  .map((line) => line.trim().replace(/,$/, ''))
  .filter(Boolean)
  .join(',');
if (actualReturnSignature !== expectedReturnSignature) {
  console.error('Repair result must contain only the exact bounded result code and aggregate counts.');
  process.exit(1);
}
if (!/REVOKE ALL ON FUNCTION auth\.repair_single_reviewer_membership\(\) FROM PUBLIC/.test(migration)) {
  console.error('Repair function must not remain executable by PUBLIC.');
  process.exit(1);
}

const expectedPaths = [
  workflowPath,
  runnerPath,
  checkerPath,
  migrationPath,
  ownerIdentityMigrationPath,
  candidateScopeMigrationPath,
  scopePath,
].sort();
const actualPaths = [...scope.allowedPaths].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
  console.error('Governed scope does not match the exact seven-file repair surface.');
  process.exit(1);
}
if (scope.issue !== 3799
    || scope.branch !== 'fix/p0-reviewer-unrelated-membership-3799'
    || scope.operationalStatus !== 'P0_REVIEWER_MEMBERSHIP_REPAIR_BOUNDED'
    || scope.boundaries?.productionMutation !== 'REVIEWER_MEMBERSHIP_ONLY'
    || scope.boundaries?.identityMutation !== false
    || scope.boundaries?.staffAssignmentMutation !== false
    || scope.boundaries?.passwordMutation !== false
    || scope.boundaries?.mfaMutation !== false
    || scope.boundaries?.newRecurringCostRub !== 0) {
  console.error('Governed scope boundaries are incomplete or unsafe.');
  process.exit(1);
}

console.log('PASS: owner-only exact-main reviewer membership repair is no-argument, SERIALIZABLE, FORCE-RLS-bounded, function-only, PII-free at output, audit/outbox-backed and limited to the fixed internal organization plus one GUEST membership while preserving unrelated memberships.');
