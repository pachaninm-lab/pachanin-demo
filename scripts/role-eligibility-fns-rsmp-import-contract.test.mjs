import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FNS_RSMP_EXPECTED_XSD_SHA256,
  validateFnsRsmpImportContract,
} from './role-eligibility-fns-rsmp-import-contract.mjs';

const validProbe = () => ({
  schemaVersion: 'role-eligibility-fns-rsmp-source-contract-probe.v1',
  source: 'FNS_RSMP',
  authorityRoot: 'https://www.nalog.gov.ru/opendata/7707329152-rsmp/',
  legalSemantics: 'OFFICIAL_OPEN_DATA_POSITIVE_MEMBERSHIP_ONLY',
  absenceSemantics: 'ABSENCE_IS_NOT_NEGATIVE_LEGAL_ENTITY_EVIDENCE',
  automaticNegativeAuthority: false,
  mode: 'READ_ONLY_EXTERNAL_OBSERVATION',
  productionDatabaseMutation: 0,
  registrationTouched: false,
  passport: {
    finalUrl: 'https://www.nalog.gov.ru/opendata/7707329152-rsmp/',
    status: 200,
    contentType: 'text/html',
    declaresXml: true,
    declaresOpenDataset: true,
    dataUrl: 'https://file.nalog.ru/opendata/7707329152-rsmp/data-10082026-structure-12052026.zip',
    structureUrl: 'https://file.nalog.ru/opendata/7707329152-rsmp/structure-12052026.xsd',
  },
  structure: {
    finalUrl: 'https://file.nalog.ru/opendata/7707329152-rsmp/structure-12052026.xsd',
    status: 200,
    contentType: 'application/xml',
    contentLength: 32641,
    sha256: FNS_RSMP_EXPECTED_XSD_SHA256,
    identityShapeObserved: true,
    activityShapeObserved: true,
  },
  data: {
    finalUrl: 'https://file.nalog.ru/opendata/7707329152-rsmp/data-10082026-structure-12052026.zip',
    status: 200,
    contentType: 'application/octet-stream',
    contentLengthHeader: '2112689281',
    etag: '"be08c7795c929660a73e8b9f0b2bf5b8-252"',
    lastModified: 'Mon, 10 Aug 2026 07:37:36 GMT',
  },
  contractStatus: 'PROVEN_OFFICIAL_OPEN_DATA_MACHINE_CONTRACT',
  productionTransportEligible: true,
});

const expectCode = (mutate, code) => {
  const probe = validProbe();
  mutate(probe);
  assert.throws(
    () => validateFnsRsmpImportContract(probe),
    (error) => error?.code === code,
  );
};

test('authorizes only the proven official FNS RSMP snapshot contract and keeps it supplementary', () => {
  const result = validateFnsRsmpImportContract(validProbe());
  assert.equal(result.authorized, true);
  assert.equal(result.source, 'FNS_RSMP');
  assert.equal(result.admissionAuthority, false);
  assert.equal(result.automaticNegativeAuthority, false);
  assert.equal(result.absenceSemantics, 'ABSENCE_IS_NOT_NEGATIVE_LEGAL_ENTITY_EVIDENCE');
  assert.equal(result.archiveBytes, '2112689281');
  assert.equal(result.snapshotDate, '2026-08-10');
  assert.equal(result.structureVersion, '12052026');
  assert.equal(result.structureSha256, FNS_RSMP_EXPECTED_XSD_SHA256);
  assert.equal(result.nextPhase, 'STREAMING_ZIP_XML_IMPORT_REQUIRED');
  assert.equal(result.productionDatabaseMutation, 0);
  assert.equal(result.registrationTouched, false);
  assert.equal(result.enforcementChanged, false);
});

test('fails closed if RSMP absence could be treated as negative authority', () => {
  expectCode(
    (probe) => { probe.automaticNegativeAuthority = true; },
    'FNS_RSMP_IMPORT_NEGATIVE_AUTHORITY_FORBIDDEN',
  );
});

test('fails closed if the proof was produced with DB or registration mutation', () => {
  expectCode(
    (probe) => { probe.productionDatabaseMutation = 1; },
    'FNS_RSMP_IMPORT_PROBE_BOUNDARY_VIOLATION',
  );
});

test('fails closed on non-official archive host', () => {
  expectCode(
    (probe) => { probe.passport.dataUrl = 'https://example.org/opendata/7707329152-rsmp/data-10082026-structure-12052026.zip'; },
    'FNS_RSMP_IMPORT_DATA_URL_INVALID',
  );
});

test('fails closed on XSD fingerprint drift even when identity fields still look present', () => {
  expectCode(
    (probe) => { probe.structure.sha256 = 'a'.repeat(64); },
    'FNS_RSMP_IMPORT_XSD_FINGERPRINT_UNAUTHORIZED',
  );
});

test('fails closed if archive size exceeds the bounded compressed-input limit', () => {
  expectCode(
    (probe) => { probe.data.contentLengthHeader = String(5n * 1024n * 1024n * 1024n); },
    'FNS_RSMP_IMPORT_ARCHIVE_SIZE_INVALID',
  );
});

test('fails closed if data filename and XSD filename declare different structure versions', () => {
  expectCode(
    (probe) => { probe.passport.structureUrl = 'https://file.nalog.ru/opendata/7707329152-rsmp/structure-13052026.xsd'; },
    'FNS_RSMP_IMPORT_REDIRECT_OR_DISCOVERY_DRIFT',
  );
});

test('fails closed when the machine-readable contract is no longer proven', () => {
  expectCode(
    (probe) => { probe.productionTransportEligible = false; },
    'FNS_RSMP_IMPORT_MACHINE_CONTRACT_NOT_PROVEN',
  );
});
