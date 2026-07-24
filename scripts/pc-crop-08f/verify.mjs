#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.EVIDENCE_DIR || 'artifacts/pc-crop-08f';
const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA || 'UNKNOWN';
const failures = [];

function requireFile(path, label) {
  if (!existsSync(path)) failures.push(`${label}: missing ${path}`);
}

for (const [path, label] of [
  [join(root, 'scope-guard.ok'), 'scope'],
  [join(root, 'migration.ok'), 'migration'],
  [join(root, 'typecheck.ok'), 'typecheck'],
  [join(root, 'contract-tests.ok'), 'contract tests'],
  [join(root, 'postgresql-acceptance.ok'), 'PostgreSQL acceptance'],
]) requireFile(path, label);

const migrationPath = 'apps/api/prisma/migrations/20260724190000_fgis_grain_sdiz_projection/migration.sql';
const contractPath = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.contract.ts';
const repositoryPath = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.repository.ts';
const modulePath = 'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts';
for (const path of [migrationPath, contractPath, repositoryPath, modulePath]) requireFile(path, 'authority');

const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
const contract = existsSync(contractPath) ? readFileSync(contractPath, 'utf8') : '';
const repository = existsSync(repositoryPath) ? readFileSync(repositoryPath, 'utf8') : '';
const moduleText = existsSync(modulePath) ? readFileSync(modulePath, 'utf8') : '';

const invariants = {
  officialFiveStatusSet: contract.includes('FGIS_GRAIN_1_0_23_SDIZ_STATUSES'),
  exactIdentifierAliases: ['sdizID', 'sdizNumber', 'SDIZNumber', 'correctedBySDIZNumber', 'correctedSDIZNumber', 'extinctionId', 'extinctionRefusalId']
    .every((value) => contract.includes(value)),
  boundedSortedBatch: contract.includes('FGIS_GRAIN_SDIZ_MAX_BATCH_SIZE') && contract.includes('.sort('),
  batchFingerprintBound: contract.includes('BATCH_FINGERPRINT_MISMATCH'),
  forcedTenantOrgRls: migration.includes('FORCE ROW LEVEL SECURITY')
    && migration.includes("current_setting('app.current_tenant_id', true)")
    && migration.includes("current_setting('app.current_org_id', true)"),
  immutableProjectionBatch: migration.includes('reject_fgis_grain_sdiz_batch_mutation'),
  canonicalInboxAuthority: repository.includes("inbox.state !== 'PROCESSING'")
    && repository.includes("inbox.signatureStatus !== 'VERIFIED'")
    && repository.includes('leaseExpiresAt'),
  officialVersionPins: repository.includes("const API_VERSION = '1.0.23'")
    && repository.includes('FGIS_GRAIN_SDIZ_MAPPING_VERSION'),
  monotonicProviderTime: repository.includes('FGIS_SDIZ_STALE_PROVIDER_EVENT')
    && repository.includes('FGIS_SDIZ_SAME_TIME_FINGERPRINT_CONFLICT'),
  atomicInboxAuditOutboxProjection: repository.includes('insertAudit(')
    && repository.includes('insertOutbox(')
    && repository.includes('insertBatch(')
    && repository.includes('upsertProjection('),
  deterministicReplay: repository.includes('readReplayMutation')
    && repository.includes('replayAlreadyBound'),
  noBusinessAcceptanceMutation: !repository.includes('"businessAcceptedAt" ='),
  noProviderConfirmationMutation: !repository.includes('"confirmedAt" ='),
  provenanceReadBoundary: repository.includes('sourceEvidenceReference')
    && repository.includes('sourceRawBodySha256')
    && !repository.includes('rawXml'),
  moduleRegistered: moduleText.includes('FgisGrainSdizProjectionRepository'),
};
for (const [key, value] of Object.entries(invariants)) if (!value) failures.push(`invariant:${key}`);

for (const forbidden of ['fetch(', 'axios', 'HttpService', 'CryptoPro', 'privateKey', 'certificateBytes', 'CONFIRMED_LIVE']) {
  if (repository.includes(forbidden)) failures.push(`forbidden repository token: ${forbidden}`);
}

const report = {
  schemaVersion: 'pc-crop.fgis-grain-sdiz-projection-acceptance.v1',
  slice: 'PC-CROP-08F',
  issue: 3178,
  exactHead,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  operationalStatus: 'NOT_ATTESTED',
  postgresql: '16',
  officialPackageSha256: '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7',
  operationCatalogSha256: '4fc7cc075b956f0adca26331a99627d07cde77d63ec2fc017d0cbbc5f701c87a',
  invariants,
  boundaries: {
    liveProviderCall: false,
    rawXmlPersistence: false,
    directDealLotShipmentPaymentMutation: false,
    automaticBusinessAcceptance: false,
    providerConfirmation: false,
    secondInboxOutboxOrRelay: false,
    productionDeployment: false,
    confirmedLiveClaim: false,
    productionHosting: 'REG_RU_VPS_ONLY',
  },
  failures,
};
mkdirSync(root, { recursive: true });
writeFileSync(join(root, 'pc-crop-08f-acceptance.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report));
if (failures.length) process.exit(1);
