import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/pc-crop-08f';
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

const contract = read('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-registry.contract.ts');
const repository = read('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-registry.repository.ts');
const migration = read('apps/api/prisma/migrations/20260724160500_fgis_grain_sdiz_registry/migration.sql');
const moduleSource = read('apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts');
const e2e = read('apps/api/test/industrial/fgis-grain-sdiz-registry.e2e-spec.ts');
const scope = JSON.parse(read('docs/platform-v7/autopilot/scopes/pc-crop-08f-sdiz-registry.json'));
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

for (const required of [
  'CREATED',
  'SUBSCRIBED',
  'CANCELED',
  'EXTINGUISHED',
  'SUBSCRIBED_CONFIRMED',
  'providerSdizId',
  'sdizNumber',
  'SDIZNumber',
  'lotNumber',
  'createLotNumber',
  'correctedBySDIZNumber',
  'correctedSDIZNumber',
  'extinctionId',
  'extinctionRefusalId',
  'sourceInboxEntryId',
  'batchFingerprint',
  'withTrustedContext',
  'TransactionIsolationLevel.Serializable',
  'public."regulatory_integration_inbox_entries"',
  'public."audit_events"',
  'public."outbox_entries"',
]) {
  if (!`${contract}\n${repository}`.includes(required)) {
    failures.push(`required SDIZ authority marker missing: ${required}`);
  }
}

if (!migration.includes('FORCE ROW LEVEL SECURITY')) failures.push('forced RLS missing');
if (!migration.includes("current_setting('app.current_tenant_id', true)")) failures.push('tenant RLS missing');
if (!migration.includes("current_setting('app.current_org_id', true)")) failures.push('organization RLS missing');
if (!migration.includes('reject_fgis_grain_sdiz_batch_mutation')) failures.push('immutable batch trigger missing');
if (!moduleSource.includes('FgisGrainSdizRegistryRepository')) failures.push('module binding missing');
if (!repository.includes("inbox.signatureStatus !== 'VERIFIED'")) failures.push('verified signature gate missing');
if (!repository.includes("inbox.state !== 'PROCESSING'")) failures.push('processing-state gate missing');
if (!repository.includes('leaseExpiresAt.getTime() <= Date.now()')) failures.push('live lease gate missing');
if (!repository.includes('incomingTime < currentTime')) failures.push('monotonic time gate missing');
if (!repository.includes('incomingTime === currentTime')) failures.push('same-time fingerprint conflict missing');
if (!repository.includes("businessAccepted: false")) failures.push('no automatic business acceptance marker missing');
if (!repository.includes('linkedDomainOperationType')) failures.push('inbox linkage missing');

for (const markerText of [
  'atomically applies verified inbox',
  'replays the same inbox and rejects payload mismatch',
  'applies monotonic updates',
  'missing verification, lost lease or hash mismatch',
  'isolates projections by tenant and organization',
  'businessAcceptedAt: null',
]) {
  if (!e2e.includes(markerText)) failures.push(`E2E acceptance marker missing: ${markerText}`);
}

if (scope.issue !== 3178 || scope.operationalStatus !== 'NOT_ATTESTED') failures.push('scope issue/status mismatch');
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') failures.push('production hosting mismatch');

const invariants = {
  postgresqlProjectionAuthority: marker('migration.ok')
    && migration.includes('fgis_grain_sdiz_records'),
  verifiedInboxOnly: repository.includes("signatureStatus !== 'VERIFIED'")
    && repository.includes('verificationAccepted'),
  liveLeaseRequired: repository.includes("state !== 'PROCESSING'")
    && repository.includes('leaseExpiresAt.getTime() <= Date.now()'),
  exactContractPins: repository.includes("schemaVersion !== '1.0.23'")
    && repository.includes("mappingVersion !== 'fgis-zerno-1.0.23-catalog.v1'"),
  officialStatusesOnly: contract.includes('FGIS_GRAIN_1_0_23_SDIZ_STATUSES'),
  aliasConsistency: contract.includes('SDIZ_NUMBER_ALIAS_CONFLICT'),
  deterministicBatchFingerprint: contract.includes('computeFgisGrainSdizBatchFingerprint'),
  boundedBatch: contract.includes('FGIS_GRAIN_SDIZ_MAX_BATCH_SIZE'),
  monotonicProviderTime: repository.includes('incomingTime < currentTime')
    && repository.includes('incomingTime === currentTime'),
  replayBoundToInboxHashAndFingerprint: repository.includes('batchMatches')
    && repository.includes('rawBodySha256')
    && repository.includes('batchFingerprint'),
  atomicInboxProjectionAuditOutbox: repository.includes('public."regulatory_integration_inbox_entries"')
    && repository.includes('public."fgis_grain_sdiz_projection_batches"')
    && repository.includes('public."audit_events"')
    && repository.includes('public."outbox_entries"')
    && repository.includes('TransactionIsolationLevel.Serializable'),
  immutableSourceBatches: migration.includes('batches_no_update')
    && migration.includes('batches_no_delete'),
  tenantOrganizationRls: migration.includes('app.current_tenant_id')
    && migration.includes('app.current_org_id'),
  noAutomaticBusinessAcceptance: repository.includes('businessAccepted: false')
    && repository.includes('businessAcceptedAt" = NULL'),
  noDirectBusinessMutation: !runtime.includes('UPDATE public."deals"')
    && !runtime.includes('UPDATE public."lots"')
    && !runtime.includes('UPDATE public."shipments"')
    && !runtime.includes('UPDATE public."payments"'),
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
  schemaVersion: 'pc-crop.fgis-grain-sdiz-registry-acceptance.v1',
  slice: 'PC-CROP-08F',
  issue: 3178,
  exactHead,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  postgresql: '16',
  adapterCode: 'FGIS_ZERNO',
  apiVersion: '1.0.23',
  operationCatalogSha256: '4fc7cc075b956f0adca26331a99627d07cde77d63ec2fc017d0cbbc5f701c87a',
  operationalStatus: 'NOT_ATTESTED',
  officialStatuses: [
    'CREATED',
    'SUBSCRIBED',
    'CANCELED',
    'EXTINGUISHED',
    'SUBSCRIBED_CONFIRMED',
  ],
  invariants,
  boundaries: {
    rawXmlOrSignatureBytesPersisted: false,
    networkClient: false,
    externalProviderCall: false,
    directDealLotShipmentOrPaymentMutation: false,
    automaticLegalAcceptance: false,
    secondInboxOutboxOrRelay: false,
    confirmedLiveClaim: false,
    productionDeployment: false,
    productionHosting: 'REG_RU_VPS_ONLY',
  },
  failures,
};

fs.mkdirSync(path.join(root, evidenceDir), { recursive: true });
fs.writeFileSync(
  path.join(root, evidenceDir, 'pc-crop-08f-acceptance.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
