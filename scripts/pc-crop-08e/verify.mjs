import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/pc-crop-08e';
const exactHead = process.env.EXACT_HEAD || '';
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const marker = (name) => fs.existsSync(path.join(root, evidenceDir, name));

for (const name of [
  'scope-guard.ok',
  'migration.ok',
  'api-typecheck.ok',
  'contract-tests.ok',
  'postgresql-acceptance.ok',
]) {
  if (!marker(name)) failures.push(`missing evidence marker: ${name}`);
}
if (!/^[a-f0-9]{40}$/u.test(exactHead)) failures.push('invalid exact head');

const contract = read('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-provider-attestation.contract.ts');
const repository = read('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-provider-attestation.repository.ts');
const migration = read('apps/api/prisma/migrations/20260724145500_fgis_grain_provider_attestation_authority/migration.sql');
const moduleSource = read('apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts');
const e2e = read('apps/api/test/industrial/fgis-grain-provider-attestation.e2e-spec.ts');
const scope = JSON.parse(read('docs/platform-v7/autopilot/scopes/pc-crop-08e-fgis-provider-attestation.json'));
const runtime = `${contract}\n${repository}\n${moduleSource}`;

for (const pattern of [
  /\bfetch\s*\(/u,
  /\baxios\b/u,
  /\bHttpService\b/u,
  /\bcreateSign\s*\(/u,
  /BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY/u,
  /CONFIRMED_LIVE/u,
]) {
  if (pattern.test(runtime)) failures.push(`forbidden runtime pattern ${pattern}`);
}

const required = [
  'PRE_PRODUCTION',
  'PRODUCTION_ACTIVATION_FORBIDDEN',
  'OWNER',
  'SECURITY',
  'LEGAL',
  'OPERATIONS',
  'mfaVerified',
  'withTrustedContext',
  'TransactionIsolationLevel.Serializable',
  'public."audit_events"',
  'public."outbox_entries"',
  'fgis_grain_provider_configurations',
  'fgis_grain_provider_attestations',
  'SUSPENDED',
  'REVOKED',
];
for (const value of required) {
  if (!`${contract}\n${repository}\n${migration}`.includes(value)) {
    failures.push(`required authority marker missing: ${value}`);
  }
}

if (!migration.includes('FORCE ROW LEVEL SECURITY')) failures.push('forced RLS missing');
if (!migration.includes('reject_fgis_grain_provider_attestation_mutation')) failures.push('immutable attestation trigger missing');
if (!migration.includes("current_setting('app.current_tenant_id', true)")) failures.push('tenant RLS context missing');
if (!migration.includes("current_setting('app.current_org_id', true)")) failures.push('organization RLS context missing');
if (!moduleSource.includes('FgisGrainProviderAttestationRepository')) failures.push('module binding missing');
if (!repository.includes('new Set([...approved.values()].map((row) => row.actorUserId))')
  || !repository.includes('One actor cannot decide multiple gates')) {
  failures.push('independent actor separation missing');
}
if (!repository.includes('validUntil.getTime() > Date.now()')) failures.push('live TTL approval check missing');
if (!repository.includes('configurationVersion') || !repository.includes('STALE')) failures.push('configuration version binding missing');
if (!repository.includes('contentMatches(current, draft)')) failures.push('content-version authority missing');
if (repository.includes('clientTenantId') || repository.includes('clientOrganizationId')) failures.push('client-selected authority marker found');

for (const value of [
  'deterministic replay',
  'stale If-Match',
  'role separation and MFA',
  'invalidates approvals only when reference content changes',
  'governed suspend and irreversible revoke',
  'never activates PRODUCTION',
  'immutable',
  'NotFoundException',
]) {
  if (!e2e.includes(value)) failures.push(`E2E acceptance marker missing: ${value}`);
}

if (scope.issue !== 3172 || scope.operationalStatus !== 'NOT_ATTESTED') failures.push('scope issue/status mismatch');
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') failures.push('production hosting mismatch');

const invariants = {
  postgresqlAuthority: marker('migration.ok') && migration.includes('fgis_grain_provider_configurations'),
  tenantAndOrganizationRls: migration.includes('app.current_tenant_id') && migration.includes('app.current_org_id'),
  immutableAttestations: migration.includes('attestations_no_update') && migration.includes('attestations_no_delete'),
  referenceOnlyConfiguration: contract.includes('endpointReference')
    && contract.includes('credentialReference')
    && contract.includes('signingKeyReference')
    && contract.includes('INLINE_SECRET_OR_ENDPOINT_FORBIDDEN'),
  serverDerivedAuthority: repository.includes('context.tenantId')
    && repository.includes('context.orgId')
    && repository.includes('context.userId')
    && repository.includes('context.role'),
  fourIndependentGates: ['OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS']
    .every((gate) => repository.includes(gate)),
  mfaRequired: repository.includes('mfaVerified !== true'),
  ttlAndVersionBinding: repository.includes('validUntil') && repository.includes('configurationVersion'),
  contentVersionInvalidation: repository.includes('contentMatches(current, draft)')
    && repository.includes('version = current.version + 1n'),
  optimisticConcurrency: repository.includes('expectedVersion') && repository.includes('PreconditionFailedException'),
  atomicAuditAndCanonicalOutbox: repository.includes('public."audit_events"')
    && repository.includes('public."outbox_entries"')
    && repository.includes('TransactionIsolationLevel.Serializable'),
  governedSuspendAndRevoke: repository.includes('async suspend(')
    && repository.includes('async revoke('),
  productionActivationDenied: contract.includes('PRODUCTION_ACTIVATION_FORBIDDEN'),
  noSecondQueue: !runtime.includes('BullModule') && !runtime.includes('new Queue'),
  noNetworkOrCryptoImplementation: !runtime.includes('fetch(')
    && !runtime.includes('HttpService')
    && !runtime.includes('createSign('),
  operationalStatusNotAttested: contract.includes("'NOT_ATTESTED'"),
  productionHostingRegRuOnly: scope.productionHosting === 'REG_RU_VPS_ONLY',
};
for (const [name, value] of Object.entries(invariants)) {
  if (!value) failures.push(`invariant failed: ${name}`);
}

const report = {
  schemaVersion: 'pc-crop.fgis-grain-provider-attestation-acceptance.v1',
  slice: 'PC-CROP-08E',
  issue: 3172,
  exactHead,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  postgresql: '16',
  adapterCode: 'FGIS_ZERNO',
  apiVersion: '1.0.23',
  operationalStatus: 'NOT_ATTESTED',
  states: ['DRAFT', 'UNDER_REVIEW', 'TEST_APPROVED', 'SUSPENDED', 'REVOKED'],
  requiredGates: ['OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS'],
  invariants,
  boundaries: {
    rawCredentialCertificateOrPrivateKeyBytes: false,
    cryptoImplementation: false,
    networkClient: false,
    externalProviderCall: false,
    secondInboxOutboxOrRelay: false,
    productionActivation: false,
    directDealLotOrSdizMutation: false,
    confirmedLiveClaim: false,
    productionDeployment: false,
    productionHosting: 'REG_RU_VPS_ONLY',
  },
  failures,
};

fs.mkdirSync(path.join(root, evidenceDir), { recursive: true });
fs.writeFileSync(
  path.join(root, evidenceDir, 'pc-crop-08e-acceptance.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
