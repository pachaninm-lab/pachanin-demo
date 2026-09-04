import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = 'docs/platform-v7/autopilot/scopes/pc-crop-integration-binding-authority-4997.json';
const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function allowed(pathname) {
  return manifest.allowedPaths.some((pattern) =>
    pattern.endsWith('/**') ? pathname.startsWith(pattern.slice(0, -3)) : pathname === pattern);
}

test('scope is exact-main bound and excludes registration authority', () => {
  assert.equal(manifest.branch, 'feat/pc-crop-integration-binding-authority-4997');
  assert.match(manifest.authorityBaseExactMain, /^[0-9a-f]{40}$/u);
  assert.equal(manifest.productionHosting, 'REG_RU_VPS_ONLY');
  assert.equal(manifest.newRecurringCostRub, 0);
  for (const entry of manifest.allowedPaths) {
    assert.doesNotMatch(entry, /(?:^|\/)(?:registration|role-eligibility)(?:\/|$)/u);
  }
});

test('pull-request diff stays inside the declared contour', { skip: !process.env.PC_CROP_BASE_REF }, () => {
  const changed = execFileSync(
    'git',
    ['diff', '--name-only', `${process.env.PC_CROP_BASE_REF}...HEAD`],
    { cwd: root, encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean);
  assert.deepEqual(changed.filter((entry) => !allowed(entry)), []);
});

test('canonical binding transports and maturity ladder are exact', () => {
  const domain = source('packages/domain-core/src/integration-capability.ts');
  for (const transport of ['REST', 'WEBHOOK', '1C', 'SFTP', 'FILE', 'DEEPLINK', 'PLATFORM_UI', 'MANUAL']) {
    assert.match(domain, new RegExp(`'${transport}'`, 'u'));
  }
  for (const maturity of [
    'DISCOVERED', 'PUBLIC_SPEC_VERIFIED', 'CONTRACT_MAPPED', 'ADAPTER_IMPLEMENTED',
    'CONTRACT_TESTED', 'EXTERNAL_ACCESS_PENDING', 'CONTRACT_PENDING', 'LIVE_TESTING',
    'LIVE_ACCEPTED', 'DEGRADED', 'SUSPENDED',
  ]) {
    assert.match(domain, new RegExp(`${maturity}: '${maturity}'`, 'u'));
  }
  assert.match(domain, /mayCarryRealTraffic: bindingStatus === 'ACTIVE' && maturity === 'LIVE_ACCEPTED'/u);
  assert.match(domain, /!OWN_RECEIPT_ISSUERS\.has/u);
});

test('default registry is fail-closed and mocks require explicit stub mode', () => {
  const registry = source('packages/integration-sdk/src/registry.ts');
  const config = source('packages/integration-sdk/src/live/integration-config.ts');
  const wiring = source('packages/integration-sdk/src/live/live-registry.ts');
  assert.doesNotMatch(registry, /integrationRegistry\.register\('[^']+', new Mock/u);
  assert.match(config, /return 'disabled';/u);
  assert.match(wiring, /if \(config\.mode === 'stub'\)[\s\S]*registry\.register\(name, factory\(\)\)/u);
  assert.match(wiring, /readonly mode: AdapterMode = 'disabled'/u);
});

test('binding authority uses forced RLS and evidence is select-only for app principals', () => {
  const migration = source(
    'apps/api/prisma/migrations/20260904230000_integration_binding_authority/migration.sql',
  );
  for (const table of [
    'integration_bindings',
    'integration_capability_evidence',
    'integration_binding_events',
  ]) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\."${table}" FORCE ROW LEVEL SECURITY;`, 'u'));
  }
  assert.match(migration, /GRANT SELECT ON public\."integration_capability_evidence" TO %I/u);
  assert.doesNotMatch(migration, /GRANT [^;]*(?:INSERT|UPDATE|DELETE)[^;]*integration_capability_evidence/u);
  assert.match(migration, /PC_INTEGRATION_BINDING_SELF_ACTIVATION_FORBIDDEN/u);
  assert.match(migration, /integration_capability_evidence_live_receipt_check/u);
});

test('commands are durable, serialized, idempotent and atomic', () => {
  const repository = source(
    'apps/api/src/modules/service-providers/integration-binding.repository.ts',
  );
  assert.match(repository, /app_organization_capability_is_org_admin/u);
  assert.match(repository, /pg_advisory_xact_lock/u);
  assert.match(repository, /assertIntegrationBindingReplay/u);
  assert.match(repository, /tx\.auditEvent\.create/u);
  assert.match(repository, /integration_binding_events/u);
  assert.match(repository, /INSERT INTO public\."outbox_entries"/u);
  assert.match(repository, /TransactionIsolationLevel\.Serializable/u);
});

test('accounting transmission consumes the same canonical maturity vocabulary', () => {
  const transmission = source('apps/api/src/modules/accounting/document-transmission.policy.ts');
  const center = source('apps/api/src/modules/accounting/connection-center.policy.ts');
  assert.match(transmission, /IntegrationCapabilityMaturity\.LIVE_ACCEPTED/u);
  assert.match(center, /IntegrationCapabilityMaturity\.LIVE_ACCEPTED/u);
  assert.doesNotMatch(
    `${transmission}\n${center}`,
    /\bAdapterMaturity\b|\bCONFIRMED_LIVE\b|\bADAPTER_READY\b|\bNOT_ATTESTED\b/u,
  );
});
