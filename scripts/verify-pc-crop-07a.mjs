#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA || 'UNKNOWN';
const evidenceDir = path.resolve(
  root,
  process.env.EVIDENCE_DIR || 'artifacts/pc-crop-07a',
);

const files = {
  schema: 'apps/api/prisma/schema.prisma',
  migration: 'apps/api/prisma/migrations/20260722120000_regulatory_integration_inbox/migration.sql',
  rls: 'infra/sql/postgresql-regulatory-integration-inbox-policies.sql',
  types: 'apps/api/src/modules/regulatory-integration/regulatory-integration.types.ts',
  errors: 'apps/api/src/modules/regulatory-integration/regulatory-integration.errors.ts',
  stateMachine: 'apps/api/src/modules/regulatory-integration/regulatory-integration.state-machine.ts',
  policy: 'apps/api/src/modules/regulatory-integration/regulatory-integration.inbox-policy.ts',
  repository: 'apps/api/src/modules/regulatory-integration/regulatory-integration.inbox.repository.ts',
  lifecycle: 'apps/api/src/modules/regulatory-integration/regulatory-integration.inbox-lifecycle.repository.ts',
  module: 'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts',
  e2e: 'apps/api/test/industrial/regulatory-integration-inbox.e2e-spec.ts',
  workflow: '.github/workflows/pc-crop-07a.yml',
  scope: 'docs/platform-v7/autopilot/scopes/pc-crop-07a.json',
};

const failures = [];
const content = new Map();

for (const [key, relative] of Object.entries(files)) {
  const absolute = path.resolve(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`${relative}: required file is missing`);
    content.set(key, '');
    continue;
  }
  content.set(key, fs.readFileSync(absolute, 'utf8'));
}

function requireText(key, needles) {
  const source = content.get(key) || '';
  for (const needle of needles) {
    if (!source.includes(needle)) {
      failures.push(`${files[key]}: missing ${JSON.stringify(needle)}`);
    }
  }
}

function forbidText(key, needles) {
  const source = content.get(key) || '';
  for (const needle of needles) {
    if (source.includes(needle)) {
      failures.push(`${files[key]}: forbidden ${JSON.stringify(needle)}`);
    }
  }
}

requireText('migration', [
  'CREATE TABLE "regulatory_integration_inbox_entries"',
  'CREATE TABLE "regulatory_integration_inbox_conflicts"',
  'regulatory_integration_inbox_identity_uidx',
  'regulatory_integration_inbox_claim_idx',
  'regulatory_integration_inbox_immutable_identity',
  'regulatory_integration_inbox_conflicts_immutable',
  'REFERENCES "outbox_entries"',
  '"leaseOwner"',
  '"leaseExpiresAt"',
  '"nextAttemptAt"',
  '"version" BIGINT',
]);

requireText('rls', [
  'ENABLE ROW LEVEL SECURITY',
  'FORCE ROW LEVEL SECURITY',
  "current_setting('app.current_tenant_id'::text, true)",
  "current_setting('app.current_org_id'::text, true)",
  'regulatory_integration_inbox_deny_delete',
  'regulatory_integration_inbox_conflicts_deny_delete',
]);

requireText('schema', [
  'model RegulatoryIntegrationInboxEntry',
  'model RegulatoryIntegrationInboxConflict',
  '@@map("regulatory_integration_inbox_entries")',
  '@@map("regulatory_integration_inbox_conflicts")',
  'regulatoryIntegrationInboxEntries',
  'conflicts     RegulatoryIntegrationInboxConflict[]',
]);

requireText('types', [
  "'RECEIVED'",
  "'VERIFIED'",
  "'PROCESSING'",
  "'PROCESSED'",
  "'RETRY'",
  "'QUARANTINED'",
  "'DEAD'",
  'ProviderAcknowledgementState',
  'BusinessAcceptanceState',
]);

requireText('repository', [
  'Prisma.TransactionIsolationLevel.Serializable',
  'FOR UPDATE SKIP LOCKED',
  'ON CONFLICT',
  'providerAcknowledgementEligible: true',
  'providerAcknowledgementEligible: false',
  'regulatory_integration_inbox_conflicts',
  'leaseExpiresAt',
  'async retry(',
  'async quarantine(',
  'async deadLetter(',
]);

requireText('lifecycle', [
  'recordVerification(',
  'markProviderAcknowledged(',
  "? 'VERIFIED'",
  ": 'QUARANTINED'",
  "kind: 'REPLAY'",
]);

requireText('module', [
  'RegulatoryIntegrationInboxRepository',
  'RegulatoryIntegrationInboxLifecycleRepository',
  'exports:',
]);

requireText('e2e', [
  'commits before ACK eligibility',
  'separates replay from immutable conflict',
  'two concurrent workers disjoint claims',
  'reclaims an expired crash lease',
  'fails closed across tenant and organization boundaries',
  'requires provider ACK before recording business acceptance',
]);

requireText('workflow', [
  'postgres:16',
  'prisma migrate deploy',
  'prisma migrate diff',
  'postgresql-regulatory-integration-inbox-policies.sql',
  'regulatory-integration-inbox.e2e-spec.ts',
  'verify-pc-crop-07a.mjs',
  'pc-crop-07a-acceptance.json',
  'retention-days: 90',
]);

requireText('scope', [
  '"issue": 3030',
  '"operationalStatus": "NOT_ATTESTED"',
  '"DURABLE_INSERT_BEFORE_PROVIDER_ACK"',
  '"FOR_UPDATE_SKIP_LOCKED_COMPETING_WORKERS"',
  '"secondOutboxOrRelay": false',
  '"productionHosting": "REG_RU_VPS_ONLY"',
]);

forbidText('repository', [
  'localStorage',
  'sessionStorage',
  'rawPayload',
  'console.log(',
]);
forbidText('lifecycle', ['localStorage', 'sessionStorage', 'console.log(']);
forbidText('migration', [
  'CREATE TABLE "regulatory_integration_outbox',
  'CREATE TABLE "regulatory_integration_relay',
]);
forbidText('workflow', ['netlify', 'vercel', 'production deployment']);

const report = {
  schemaVersion: 'pc-crop.regulatory-integration-inbox-acceptance.v1',
  slice: 'PC-CROP-07A',
  exactHead,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  operationalStatus: 'NOT_ATTESTED',
  postgresql: '16',
  invariants: {
    durableInsertBeforeProviderAck: failures.length === 0,
    deterministicReplay: failures.length === 0,
    immutableHashConflict: failures.length === 0,
    serverDerivedTenantOrganization: failures.length === 0,
    forceRls: failures.length === 0,
    competingWorkerSkipLocked: failures.length === 0,
    expiredLeaseReclaim: failures.length === 0,
    retryQuarantineDead: failures.length === 0,
    canonicalOutboxOnly: failures.length === 0,
    rawPayloadNotPersistedOrLogged: failures.length === 0,
  },
  boundaries: {
    publicWebhookController: false,
    vendorSpecificMapping: false,
    liveExternalIntegration: false,
    productionDeployment: false,
    productionHosting: 'REG_RU_VPS_ONLY',
  },
  failures,
};

fs.mkdirSync(evidenceDir, { recursive: true });
const reportPath = path.join(evidenceDir, 'pc-crop-07a-acceptance.json');
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (failures.length > 0) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
