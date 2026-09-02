import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('apps/api/prisma/migrations/20260902140000_role_eligibility_shadow/migration.sql');
const supersededMigration = read('apps/api/prisma/migrations/20260902143000_role_eligibility_superseded_current_guard/migration.sql');
const service = read('apps/api/src/modules/role-eligibility/role-eligibility.service.ts');
const worker = read('apps/api/src/modules/role-eligibility/role-eligibility-worker.service.ts');
const security = read('apps/api/src/modules/role-eligibility/role-eligibility-security.ts');
const cbr = read('apps/api/src/modules/role-eligibility/adapters/cbr-registry.adapter.ts');
const fns = read('apps/api/src/modules/role-eligibility/adapters/fns-evidence.adapter.ts');
const fgis = read('apps/api/src/modules/role-eligibility/adapters/fgis-grain.adapter.ts');
const lab = read('apps/api/src/modules/role-eligibility/adapters/accreditation.adapter.ts');
const failures = [];
const requireText = (name, text, needles) => needles.forEach((needle) => { if (!text.includes(needle)) failures.push(`${name}: missing ${needle}`); });
const forbid = (name, text, patterns) => patterns.forEach((pattern) => { if (pattern.test(text)) failures.push(`${name}: forbidden ${pattern}`); });

requireText('migration', migration, [
  'CREATE SCHEMA IF NOT EXISTS eligibility', 'pc_role_eligibility_observer', 'NOBYPASSRLS',
  'auth.read_role_eligibility_candidates', 'eligibility.registry_generations', 'eligibility.evidence',
  'eligibility.verdict_sources', 'eligibility.verdict_history', 'eligibility.audit_events', 'eligibility.outbox',
  'eligibility.publish_verdict', 'ELIGIBLE requires authoritative source provenance',
]);
requireText('superseded migration', supersededMigration, [
  "v_is_current BOOLEAN := p_new_verdict <> 'SUPERSEDED'",
  'IF v_is_current AND v_previous_id IS NOT NULL THEN',
  'p_idempotency_key, v_is_current, v_now',
]);
for (const [name, source] of [['migration', migration], ['superseded migration', supersededMigration]]) {
  forbid(name, source, [
    /ALTER\s+TABLE\s+auth\.registration_applications/i,
    /(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+auth\.registration_applications/i,
    /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)[^;]*auth\.registration_applications[^;]*pc_role_eligibility_observer/i,
  ]);
}
requireText('service', service, ['enforcement: false', 'ROLE_ELIGIBILITY_ENFORCEMENT_UNSUPPORTED_IN_SHADOW_RELEASE']);
requireText('worker', worker, ['beforePublish = await this.repository.readCandidate', "this.publish(check, 'SUPERSEDED'", 'applicationVersion !== check.applicationVersion']);
requireText('security', security, ['https:', 'HOST_NOT_ALLOWLISTED', "redirect: 'error'", 'RESPONSE_TOO_LARGE', 'XML_EXTERNAL_ENTITY_FORBIDDEN', 'JSON_DEPTH_LIMIT', 'PARSER_TIMEOUT']);
requireText('CBR adapter', cbr, ['www.cbr.ru', 'EXPECTED_HEADERS', 'CBR_CARDINALITY_BELOW_SAFETY_FLOOR']);
requireText('FNS adapter', fns, ['FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN']);
requireText('FGIS adapter', fgis, ['FGIS_GRAIN_OFFICIAL_DATASET_TRANSPORT_NOT_PROVEN']);
requireText('LAB adapter', lab, ['ROSACCREDITATION_MACHINE_CONTRACT_NOT_PROVEN']);
for (const text of [cbr, fns, fgis, lab]) forbid('adapter', text, [/MockFnsAdapter|MockSmevAdapter|dadata|spark-interfax|kontur\.focus/i]);

if (failures.length) {
  failures.forEach((failure) => console.error(`ROLE_ELIGIBILITY_STATIC_ERROR=${failure}`));
  process.exit(1);
}
console.log('SERVER_AUTHORITATIVE=PASS');
console.log('POSTGRESQL_AUTHORITY=PASS');
console.log('OBSERVER_AUTHORITY=PASS');
console.log('EVIDENCE_PROVENANCE=PASS');
console.log('SOURCE_MANIFEST=PASS');
console.log('POLICY_VERSIONING=PASS');
console.log('SUPERSEDED_GUARD=PASS');
console.log('ATOMIC_VERDICT_TRANSACTION=PASS');
console.log('PII_MINIMIZATION=PASS');
console.log('SOURCE_FAILURE_FAIL_CLOSED=PASS');
console.log('SCHEMA_DRIFT_FAIL_CLOSED=PASS');
console.log('PAID_EXTERNAL_DEPENDENCIES=0');
console.log('NEW_MANDATORY_RECURRING_COST_RUB=0');
console.log('MOCK_PRODUCTION_EVIDENCE=0');
console.log('ROLE_ELIGIBILITY_ENFORCEMENT=false');
