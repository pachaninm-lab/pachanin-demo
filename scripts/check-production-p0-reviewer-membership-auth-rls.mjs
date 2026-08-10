import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath =
  'apps/api/prisma/migrations/20260810193000_p0_reviewer_membership_repair_auth_rls/migration.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');

const required = [
  "pc_reviewer_membership_repair_authority",
  "auth.repair_single_reviewer_membership()",
  "relation.relname IN ('staff_assignments', 'staff_access_events')",
  'relation.relrowsecurity',
  'relation.relforcerowsecurity',
  'staff_assignments_reviewer_membership_repair_select',
  'staff_access_events_reviewer_membership_repair_select',
  'staff_access_events_reviewer_membership_repair_insert',
  "current_setting('app.reviewer_membership_repair_scope', true) = 'single'",
  "role = 'PLATFORM_OWNER'",
  "status = 'ACTIVE'",
  "id = 'sae_p0_reviewer_membership_repair_v1'",
  "effective_tenant_id = 'tenant_pc_internal_platform_v1'",
  "effective_organization_id = 'org_pc_internal_platform_v1'",
  "resource_id = 'membership_pc_reviewer_internal_v1'",
  "correlation_id = 'p0-reviewer-membership-repair-v1'",
  "action = 'staff.identity.membership.repaired'",
  "outcome = 'SUCCESS'",
  "reason = 'P0_REVIEWER_MEMBERSHIP_REPAIR_3799'",
  "FOR SELECT TO pc_reviewer_membership_repair_authority",
  "FOR INSERT TO pc_reviewer_membership_repair_authority",
  "pc_staff_runtime must remain function-only for reviewer repair",
];

for (const marker of required) {
  assert.ok(sql.includes(marker), `missing auth RLS correction marker: ${marker}`);
}

assert.equal(
  (sql.match(/CREATE POLICY staff_assignments_reviewer_membership_repair_select/g) || [])
    .length,
  1,
  'staff assignment repair policy must be unique',
);
assert.equal(
  (sql.match(/CREATE POLICY staff_access_events_reviewer_membership_repair_select/g) || [])
    .length,
  1,
  'staff access event SELECT repair policy must be unique',
);
assert.equal(
  (sql.match(/CREATE POLICY staff_access_events_reviewer_membership_repair_insert/g) || [])
    .length,
  1,
  'staff access event INSERT repair policy must be unique',
);

for (const forbidden of [
  'BYPASSRLS',
  'SUPERUSER',
  'LOGIN PASSWORD',
  'GRANT pc_reviewer_membership_repair_authority TO',
  'GRANT UPDATE',
  'GRANT DELETE',
  'GRANT TRUNCATE',
  'FOR UPDATE TO pc_reviewer_membership_repair_authority',
  'FOR DELETE TO pc_reviewer_membership_repair_authority',
  'USING (true)',
  'WITH CHECK (true)',
]) {
  assert.ok(!sql.includes(forbidden), `forbidden authority widening: ${forbidden}`);
}

assert.match(
  sql,
  /actor_user_id\s*=\s*\(\s*SELECT min\(assignment\.user_id\)[\s\S]*HAVING count\(\*\) = 1\s*\)/,
  'staff audit policies must stay bound to the unique active reviewer assignment',
);
assert.match(
  sql,
  /FOREACH privilege_name IN ARRAY ARRAY\[[\s\S]*'UPDATE'[\s\S]*'DELETE'[\s\S]*'TRUNCATE'[\s\S]*\]/,
  'migration proof must reject write-surface widening',
);

console.log('production P0 reviewer membership auth RLS contract: PASS');
