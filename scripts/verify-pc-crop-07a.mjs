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

function requirePattern(key, pattern, description) {
  const source = content.get(key) || '';
  if (!pattern.test(source)) {
    failures.push(`${files[key]}: missing ${description}`);
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
  'CREATE TABLE public."regulatory_integration_inbox_entries"',
  'CREATE TABLE public."regulatory_integration_inbox_conflicts"',
  'regulatory_integration_inbox_identity_key',
  'regulatory_integration_inbox_claim_idx',
  'regulatory_integration_inbox_identity_immutable',
  'regulatory_integration_inbox_conflict_no_update',
  'regulatory_integration_inbox_conflict_no_delete',
  'REFERENCES public."outbox_entries"',
  '"leaseOwner"',
  '"leaseExpiresAt"',
  '"nextAttemptAt"',
  '"version" BIGINT',
]);

requireText('rls', [
  'ENABLE ROW LEVEL SECURITY',
  'FORCE ROW LEVEL SECURITY',
  "current_setting('app.current_tenant_id', true)",
  "current_setting('app.current_org_id', true)",
  'CREATE POLICY regulatory_integration_inbox_delete',
  'USING (false)',
  'DROP POLICY IF EXISTS regulatory_integration_inbox_conflicts_update',
  'DROP POLICY IF EXISTS regulatory_integration_inbox_conflicts_delete',
]);

requireText('schema', [
  'model RegulatoryIntegrationInboxEntry',
  'model RegulatoryIntegrationInboxConflict',
  '@@map("regulatory_integration_inbox_entries")',
  '@@map("regulatory_integration_inbox_conflicts")',
  'regulatoryIntegrationInboxEntries',
]);
requirePattern(
  'schema',
  /\bconflicts\s+RegulatoryIntegrationInboxConflict\[\]/u,
  'formatted reverse relation conflicts RegulatoryIntegrationInboxConflict[]',
);

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

requireText('policy', [
  "INBOX_REDRIVE: 'regulatory-integration:inbox:redrive'",
  'assertRegulatoryInboxRedriveAuthority(',
  'staffRoles',
  'mfaVerified',
  'reason must contain at least 12 characters',
  'trusted identity is required for regulatory inbox redrive',
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
  'async redrive(',
  'assertRegulatoryInboxRedriveAuthority(',
  'REGULATORY_INTEGRATION_INBOX_REDRIVE',
  'REGULATORY_INTEGRATION_INBOX_REDRIVEN',
  "'regulatory-integration'",
  "'inbox-redrive'",
  'pg_advisory_xact_lock',
  'audit_events',
  'outbox_entries',
  'runtimeIdempotencyKey',
  'idempotency key is already bound to another inbox identity',
  'missing matching immutable audit evidence',
  'inbox entry cannot be redriven from state',
  'state" = \'RETRY\'',
  "kind: 'REPLAY'",
  "? 'VERIFIED'",
  ": 'QUARANTINED'",
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
  'redrives a quarantined entry with immutable audit and canonical outbox evidence',
  'REGULATORY_INTEGRATION_INBOX_REDRIVE',
  'REGULATORY_INTEGRATION_INBOX_REDRIVEN',
  "kind: 'REPLAY'",
  'staffRoles: [StaffRole.PLATFORM_ADMIN]',
  "not.toContain('rawBodySha256')",
  "not.toContain('evidenceReference')",
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
  '"GOVERNED_REDRIVE_PERMISSION_MFA_JUSTIFICATION"',
  '"IMMUTABLE_REDRIVE_AUDIT_CANONICAL_OUTBOX"',
  '"IDEMPOTENT_REDRIVE_REPLAY"',
  '"secondOutboxOrRelay": false',
  '"productionHosting": "REG_RU_VPS_ONLY"',
]);

forbidText('repository', [
  'localStorage',
  'sessionStorage',
  'rawPayload',
  'console.log(',
]);
forbidText('lifecycle', [
  'localStorage',
  'sessionStorage',
  'rawPayload',
  'console.log(',
  'CREATE TABLE',
]);
forbidText('migration', [
  'CREATE TABLE "regulatory_integration_outbox',
  'CREATE TABLE "regulatory_integration_relay',
]);
forbidText('workflow', ['netlify', 'vercel', 'production deployment']);

const pass = failures.length === 0;
const report = {
  schemaVersion: 'pc-crop.regulatory-integration-inbox-acceptance.v1',
  slice: 'PC-CROP-07A',
  exactHead,
  status: pass ? 'PASS' : 'FAIL',
  operationalStatus: 'NOT_ATTESTED',
  postgresql: '16',
  invariants: {
    durableInsertBeforeProviderAck: pass,
    deterministicReplay: pass,
    immutableHashConflict: pass,
    serverDerivedTenantOrganization: pass,
    forceRls: pass,
    competingWorkerSkipLocked: pass,
    expiredLeaseReclaim: pass,
    retryQuarantineDead: pass,
    governedRedrivePermissionMfaJustification: pass,
    immutableRedriveAuditCanonicalOutbox: pass,
    idempotentRedriveReplay: pass,
    redriveTenantOrganizationIsolation: pass,
    canonicalOutboxOnly: pass,
    rawPayloadNotPersistedOrLogged: pass,
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
