#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const paths = {
  scope: 'docs/platform-v7/autopilot/scopes/pc-crop-post-registration-w1a-4997.json',
  registry: 'apps/api/src/modules/organizations/organization-capability.registry.ts',
  migration: 'apps/api/prisma/migrations/20260904193000_organization_capability_shadow_authority/migration.sql',
  repository: 'apps/api/src/modules/organizations/organization-capability.repository.ts',
  module: 'apps/api/src/modules/organizations/organizations.module.ts',
};

const text = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, readFileSync(resolve(root, path), 'utf8')]),
);

const expectedCodes = [
  'SELL_CROP',
  'BUY_CROP',
  'OWN_TRANSPORT',
  'PROVIDE_LOGISTICS',
  'PROVIDE_EXPEDITION',
  'STORE_CROP',
  'PROVIDE_ELEVATOR_SERVICES',
  'PROVIDE_LAB_TESTING',
  'PROVIDE_SURVEYING',
  'PROVIDE_FINANCING',
  'PROVIDE_INSURANCE',
  'ACCOUNTING_INTEGRATION',
  'API_INTEGRATION',
];

function assert(condition, message) {
  if (!condition) throw new Error(`W1A_VERIFY_FAILED: ${message}`);
}

const registryArrayMatch = text.registry.match(/ORGANIZATION_CAPABILITY_CODES\s*=\s*\[([\s\S]*?)\]\s*as const/);
assert(registryArrayMatch, 'canonical registry array missing');
const registryCodes = [...registryArrayMatch[1].matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
assert(JSON.stringify(registryCodes) === JSON.stringify(expectedCodes), 'canonical registry is not the exact 13-code specification');
assert(new Set(registryCodes).size === 13, 'canonical registry contains duplicate capability codes');

for (const code of expectedCodes) {
  assert(text.migration.includes(`'${code}'`), `migration closed registry missing ${code}`);
}
for (const table of ['organization_assignments', 'command_receipts']) {
  assert(text.migration.includes(`ALTER TABLE capability.${table} ENABLE ROW LEVEL SECURITY`), `${table} RLS not enabled`);
  assert(text.migration.includes(`ALTER TABLE capability.${table} FORCE ROW LEVEL SECURITY`), `${table} FORCE RLS missing`);
}
assert(text.migration.includes("current_setting('app.current_tenant_id', true)"), 'tenant context missing');
assert(text.migration.includes("current_setting('app.current_org_id', true)"), 'organization context missing');
assert(text.migration.includes('outbox_entries_organization_capability_insert'), 'canonical outbox extension missing');
assert(text.migration.includes('capability.resolve_server_evidence'), 'bounded server evidence resolver missing');
assert(text.migration.includes("verdict.verdict = 'ELIGIBLE'"), 'evidence resolver does not require current ELIGIBLE verdict');
assert(!/INSERT\s+INTO\s+capability\.organization_assignments/i.test(text.migration), 'implicit capability backfill detected');
assert(!/(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+auth\.registration_applications/i.test(text.migration), 'registration mutation detected');
assert(!/(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+eligibility\.verdicts/i.test(text.migration), 'Role Eligibility verdict mutation detected');

for (const marker of [
  'pg_advisory_xact_lock',
  'ORGANIZATION_CAPABILITY_VERSION_CONFLICT',
  'ORGANIZATION_CAPABILITY_IDEMPOTENCY_PAYLOAD_MISMATCH',
  'requestFingerprint',
  'tx.auditEvent.create',
  'tx.outboxEntry.create',
  'Prisma.TransactionIsolationLevel.Serializable',
]) {
  assert(text.repository.includes(marker), `repository contract missing ${marker}`);
}
assert(text.module.includes('OrganizationCapabilityController'), 'controller is not wired');
assert(text.module.includes('OrganizationCapabilityRepository'), 'repository is not wired');
assert(text.module.includes('OrganizationCapabilityService'), 'service is not wired');

const scope = JSON.parse(text.scope);
assert(scope.authorityBaseExactMain === '7de3dcf6a7c90d76b7e5aff5c57a8df4b30c4d2a', 'scope exact-main baseline drifted');
assert(scope.newRecurringCostRub === 0, 'new recurring cost is not zero');

console.log('ORGANIZATION_CAPABILITY_W1A_STATIC=PASS');
console.log(`CANONICAL_CAPABILITY_CODES=${registryCodes.length}`);
console.log('REGISTRATION_CODE_CHANGED=0');
console.log('ROLE_ELIGIBILITY_MUTATION=0');
console.log('IMPLICIT_GRANTS=0');
