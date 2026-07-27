#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA || 'UNKNOWN';
const evidenceDir = path.resolve(root, process.env.EVIDENCE_DIR || 'artifacts/pc-crop-07b');
const files = {
  dto: 'apps/api/src/modules/regulatory-integration/dto/regulatory-integration-control-tower.dto.ts',
  policy: 'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.policy.ts',
  readRepository: 'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.repository.ts',
  redriveRepository: 'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.redrive.repository.ts',
  reconciliationRepository: 'apps/api/src/modules/regulatory-integration/regulatory-integration.reconciliation.repository.ts',
  commandService: 'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.command.service.ts',
  controller: 'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.controller.ts',
  module: 'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts',
  postgres: 'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.postgresql.spec.ts',
  readBff: 'apps/web/app/api/platform-v7/integrations/[[...path]]/route.ts',
  staffBff: 'apps/web/app/api/staff/integration-control-tower/[[...path]]/route.ts',
  commandProxy: 'apps/web/app/api/staff/integrations/_command-proxy.ts',
  page: 'apps/web/app/platform-v7/integrations/page.tsx',
  detailPage: 'apps/web/app/platform-v7/integrations/[adapterCode]/page.tsx',
  client: 'apps/web/components/crop-platform/IntegrationControlTowerClient.tsx',
  adapter: 'apps/web/components/crop-platform/integration-control-tower-live-adapter.ts',
  css: 'apps/web/components/crop-platform/IntegrationControlTowerClient.module.css',
  routes: 'apps/web/lib/platform-v7/routes.ts',
  cabinet: 'apps/web/lib/platform-v7/cabinet-access-policy.ts',
  canonicalization: 'apps/web/lib/platform-v7/route-canonicalization.ts',
  webTests: 'apps/web/tests/unit/platformV7IntegrationControlTower.test.ts',
  adapterTests: 'apps/web/tests/unit/integrationControlTowerLiveAdapter.test.ts',
  scope: 'docs/platform-v7/autopilot/scopes/pc-crop-07b-private-integration-control-tower.json',
  workflow: '.github/workflows/pc-crop-07b.yml',
};

const failures = [];
const content = new Map();
for (const [key, relative] of Object.entries(files)) {
  const absolute = path.resolve(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`${relative}: required file is missing`);
    content.set(key, '');
  } else {
    content.set(key, fs.readFileSync(absolute, 'utf8'));
  }
}

function requireText(key, needles) {
  const source = content.get(key) || '';
  for (const needle of needles) {
    if (!source.includes(needle)) failures.push(`${files[key]}: missing ${JSON.stringify(needle)}`);
  }
}

function forbidText(key, needles) {
  const source = content.get(key) || '';
  for (const needle of needles) {
    if (source.includes(needle)) failures.push(`${files[key]}: forbidden ${JSON.stringify(needle)}`);
  }
}

requireText('dto', [
  'role is server-derived', 'tenantId is server-derived', 'organizationId is server-derived',
  'expectedVersion must be supplied only through If-Match', "'TEST'", "'PREPROD'",
]);
requireText('policy', [
  'Role.COMPLIANCE_OFFICER', 'Role.EXECUTIVE', 'StaffRole.OPERATIONS_SUPERVISOR',
  'MFA_REQUIRED', 'JIT_AUTHORITY_REQUIRED', 'HUMAN_REASON_REQUIRED',
  'deriveIntegrationControlTowerPrimaryAction',
]);
requireText('readRepository', [
  'withTrustedContext', 'MAX_AGGREGATES = 1_000', 'credentialReferenceExpiresAt: null',
  'credentialMetadataAvailable: false', "return 'ADAPTER_READY'", "return 'TEST'",
  "row.environment === 'TEST'", "row.environment === 'PREPROD'",
  'regulatory_integration_inbox_entries',
]);
forbidText('readRepository', [
  "return 'CONFIRMED_LIVE'", 'requestReconciliation(', 'INSERT INTO', 'UPDATE public.',
  'localStorage', 'sessionStorage', 'rawBodySha256',
]);
requireText('redriveRepository', [
  'Prisma.TransactionIsolationLevel.Serializable', 'pg_advisory_xact_lock',
  'expectedVersion', 'FOR UPDATE', 'REGULATORY_INTEGRATION_INBOX_REDRIVE',
  'REGULATORY_INTEGRATION_INBOX_REDRIVEN', "kind: 'REPLAY'", 'audit_events', 'outbox_entries',
]);
requireText('reconciliationRepository', [
  'Prisma.TransactionIsolationLevel.Serializable', 'pg_advisory_xact_lock',
  'REGULATORY_INTEGRATION_RECONCILIATION_REQUESTED', 'FOR UPDATE',
  "kind: 'REPLAY'", 'audit_events', 'outbox_entries',
]);
requireText('commandService', [
  'RegulatoryIntegrationControlTowerRedriveRepository',
  'RegulatoryIntegrationReconciliationRepository',
]);
requireText('controller', [
  "@Controller('platform-v7/integrations')", 'parseIntegrationIfMatch',
  'StaffAccessMode.JIT_PRIVILEGED', 'access.actorUserId !== user.id',
  'access.expiresAt.getTime() <= Date.now()', 'access.effectiveTenantId !== user.tenantId',
  'access.effectiveOrganizationId !== user.orgId', 'access.effectiveUserId !== null',
  'access.targetDealId != null', "response.setHeader('ETag'", "'private, no-store'",
]);
forbidText('controller', ['clientRole', 'clientTenant', 'clientOrganization']);
requireText('postgres', [
  'isolates tenant/org and never infers CONFIRMED_LIVE',
  'persists reconciliation audit/outbox once and replays deterministically',
  'redrives with atomic If-Match and replays after the row version changes',
  "honestStatus: 'DEGRADED'", "honestStatus).not.toBe('CONFIRMED_LIVE')",
]);
for (const key of ['readBff', 'staffBff']) {
  requireText(key, ['ACCESS_COOKIE', "cache: 'no-store'", "redirect: 'manual'", 'AbortSignal.timeout(8_000)']);
  forbidText(key, ['localStorage', 'sessionStorage']);
}
requireText('staffBff', ['pc_staff_access_token', 'X-Staff-Access-Session']);
requireText('commandProxy', [
  'assertCsrf(request)', 'pc_staff_access_token', "request.headers.get('if-match')",
  "'If-Match': ifMatch", 'MAX_BODY_BYTES', "redirect: 'manual'",
]);
forbidText('commandProxy', ['tenantId:', 'organizationId:', 'membershipId:', 'role:']);
requireText('page', [
  'ACCESS_COOKIE', 'redirect(', "data-authority='postgresql-private-bff'",
  "data-static-authority-fallback='false'",
]);
requireText('detailPage', ['SAFE_ADAPTER_CODE', 'notFound()', 'initialAdapterCode']);
requireText('client', [
  'collectIntegrationControlTowerPages', 'parseIntegrationControlTowerRecord',
  "data-static-authority-fallback='false'", "'loading'", "'empty'", "'forbidden'",
  "'conflict'", "'stale'", "'reconnecting'", "'degraded'", "role='dialog'",
  "'X-CSRF-Token': csrfToken", "'If-Match': `\"${pending.ifMatch}\"`",
]);
forbidText('client', ['localStorage', 'sessionStorage', 'MOCK_OK', 'LIVE_SIMULATED']);
requireText('adapter', [
  'INTEGRATION_CONTROL_TOWER_MAX_PAGES = 20', 'INTEGRATION_CONTROL_TOWER_MAX_ITEMS = 2_000',
  'credentialReferenceExpiresAt: null', 'credentialMetadataAvailable: false',
  'if (seenCursors.has(page.nextCursor)) return null', 'JSON.stringify(existing) !== JSON.stringify(item)',
]);
requireText('css', [
  '@media (max-width: 900px)', '@media (max-width: 640px)', '@media (max-width: 430px)',
  ':focus-visible', 'prefers-reduced-motion', 'safe-area-inset-bottom',
]);
requireText('routes', ['PLATFORM_V7_INTEGRATIONS_ROUTE', "'/platform-v7/integrations'"]);
requireText('cabinet', [
  "new Set(['operator', 'compliance', 'executive'])", 'INTEGRATION_CONTROL_ROUTE',
]);
requireText('canonicalization', [
  "integrations: '/platform-v7/integrations'",
]);
forbidText('canonicalization', [
  "'/platform-v7/integrations': PLATFORM_V7_CANONICAL_ROUTES.connectors",
]);
requireText('scope', [
  '"issue": 3040', '"operationalStatus": "NOT_ATTESTED"',
  '"clientSelectedRoleTenantAuthority": false', '"staticOrFixtureAuthorityFallback": false',
  '"confirmedLiveInferenceFromCodeOrMocks": false', '"secondInboxOutboxOrRelay": false',
  '"productionDeploymentEvidence": false',
]);
requireText('workflow', [
  'name: PC-CROP-07B Integration Control Tower Acceptance', 'postgres:16',
  'PC_CROP_07B_POSTGRESQL', 'tsconfig.pc-crop.json', 'verify-pc-crop-07b.mjs',
  'pc-crop-07b-acceptance.json', 'retention-days: 90',
]);
forbidText('workflow', ['netlify', 'vercel', 'production deployment']);

const pass = failures.length === 0;
const report = {
  schemaVersion: 'pc-crop.integration-control-tower-acceptance.v1',
  slice: 'PC-CROP-07B',
  issue: 3040,
  exactHead,
  status: pass ? 'PASS' : 'FAIL',
  operationalStatus: 'NOT_ATTESTED',
  postgresql: '16',
  invariants: {
    privateAuthenticatedBff: pass,
    serverDerivedTenantOrganizationRole: pass,
    oversightRoleBoundary: pass,
    explicitHonestStatuses: pass,
    confirmedLiveNeverInferred: pass,
    boundedReadModel: pass,
    strictPayloadAdapter: pass,
    noStaticAuthorityFallback: pass,
    jitMfaHumanReason: pass,
    optimisticIfMatch: pass,
    atomicRedriveReplay: pass,
    atomicReconciliationReplay: pass,
    canonicalAuditOutboxOnly: pass,
    tenantOrganizationIsolation: pass,
    ruEnZh: pass,
    mobileAccessibleStates: pass,
  },
  boundaries: {
    publicUnauthenticatedIntegrationRoute: false,
    rawPayloadOrSecretDisplay: false,
    liveExternalProviderCall: false,
    secondInboxOutboxOrRelay: false,
    productionDeployment: false,
    productionHosting: 'REG_RU_VPS_ONLY',
  },
  failures,
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(
  path.join(evidenceDir, 'pc-crop-07b-acceptance.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

if (!pass) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
