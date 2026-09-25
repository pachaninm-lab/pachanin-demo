#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FNS_RSMP_AUTHORITY_ROOT = 'https://www.nalog.gov.ru/opendata/7707329152-rsmp/';
export const FNS_RSMP_DATASET_PREFIX = '/opendata/7707329152-rsmp/';
export const FNS_RSMP_DATA_HOST = 'file.nalog.ru';
export const FNS_RSMP_EXPECTED_XSD_SHA256 = '1d90729f30a3b6119f20db6ca34664034950ecacf86f9fae925ab60ce3cf3845';
export const FNS_RSMP_MAX_ARCHIVE_BYTES = 4n * 1024n * 1024n * 1024n;
export const FNS_RSMP_MAX_XSD_BYTES = 1024 * 1024;

const PROBE_SCHEMA = 'role-eligibility-fns-rsmp-source-contract-probe.v1';
const LEGAL_SEMANTICS = 'OFFICIAL_OPEN_DATA_POSITIVE_MEMBERSHIP_ONLY';
const ABSENCE_SEMANTICS = 'ABSENCE_IS_NOT_NEGATIVE_LEGAL_ENTITY_EVIDENCE';
const PROVEN_STATUS = 'PROVEN_OFFICIAL_OPEN_DATA_MACHINE_CONTRACT';
const SHA256 = /^[a-f0-9]{64}$/;
const DATA_PATH = /^\/opendata\/7707329152-rsmp\/data-(\d{8})-structure-(\d{8})\.zip$/;
const STRUCTURE_PATH = /^\/opendata\/7707329152-rsmp\/structure-(\d{8})\.xsd$/;
const ALLOWED_ARCHIVE_TYPES = new Set(['application/octet-stream', 'application/zip']);

export class FnsRsmpImportContractError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'FnsRsmpImportContractError';
    this.code = code;
    this.details = details;
  }
}

const reject = (code, details = {}) => {
  throw new FnsRsmpImportContractError(code, details);
};

function requireRecord(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject(code);
  return value;
}

function canonicalOfficialUrl(raw, expectedHost, expectedPathPattern, code) {
  let url;
  try {
    url = new URL(String(raw || ''));
  } catch {
    reject(code, { reason: 'URL_INVALID' });
  }
  if (url.protocol !== 'https:' || url.hostname !== expectedHost || url.username || url.password || url.port || url.search || url.hash) {
    reject(code, { reason: 'URL_AUTHORITY_MISMATCH' });
  }
  const match = url.pathname.match(expectedPathPattern);
  if (!match) reject(code, { reason: 'PATH_CONTRACT_MISMATCH' });
  return { url: url.toString(), match };
}

function parseDdMmYyyy(value, code) {
  const match = String(value || '').match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!match) reject(code, { value });
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== Number(yyyy) || date.getUTCMonth() + 1 !== Number(mm) || date.getUTCDate() !== Number(dd)) {
    reject(code, { value });
  }
  return date;
}

function parsePositiveBytes(raw, code) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) reject(code, { value: raw ?? null });
  const value = BigInt(raw);
  if (value <= 0n || value > FNS_RSMP_MAX_ARCHIVE_BYTES) reject(code, { value: raw });
  return value;
}

function sameUrl(left, right) {
  return String(left || '') === String(right || '');
}

export function validateFnsRsmpImportContract(input) {
  const probe = requireRecord(input, 'FNS_RSMP_IMPORT_PROBE_INVALID');
  if (probe.schemaVersion !== PROBE_SCHEMA) reject('FNS_RSMP_IMPORT_PROBE_SCHEMA_UNSUPPORTED');
  if (probe.source !== 'FNS_RSMP') reject('FNS_RSMP_IMPORT_SOURCE_MISMATCH');
  if (probe.authorityRoot !== FNS_RSMP_AUTHORITY_ROOT) reject('FNS_RSMP_IMPORT_AUTHORITY_ROOT_MISMATCH');
  if (probe.legalSemantics !== LEGAL_SEMANTICS) reject('FNS_RSMP_IMPORT_LEGAL_SEMANTICS_MISMATCH');
  if (probe.absenceSemantics !== ABSENCE_SEMANTICS) reject('FNS_RSMP_IMPORT_ABSENCE_SEMANTICS_MISMATCH');
  if (probe.automaticNegativeAuthority !== false) reject('FNS_RSMP_IMPORT_NEGATIVE_AUTHORITY_FORBIDDEN');
  if (probe.mode !== 'READ_ONLY_EXTERNAL_OBSERVATION' || probe.productionDatabaseMutation !== 0 || probe.registrationTouched !== false) {
    reject('FNS_RSMP_IMPORT_PROBE_BOUNDARY_VIOLATION');
  }
  if (probe.contractStatus !== PROVEN_STATUS || probe.productionTransportEligible !== true) {
    reject('FNS_RSMP_IMPORT_MACHINE_CONTRACT_NOT_PROVEN');
  }

  const passport = requireRecord(probe.passport, 'FNS_RSMP_IMPORT_PASSPORT_MISSING');
  if (passport.finalUrl !== FNS_RSMP_AUTHORITY_ROOT || passport.status !== 200 || passport.declaresXml !== true || passport.declaresOpenDataset !== true) {
    reject('FNS_RSMP_IMPORT_PASSPORT_CONTRACT_MISMATCH');
  }

  const data = requireRecord(probe.data, 'FNS_RSMP_IMPORT_DATA_CONTRACT_MISSING');
  const structure = requireRecord(probe.structure, 'FNS_RSMP_IMPORT_STRUCTURE_CONTRACT_MISSING');
  const dataUrl = canonicalOfficialUrl(passport.dataUrl, FNS_RSMP_DATA_HOST, DATA_PATH, 'FNS_RSMP_IMPORT_DATA_URL_INVALID');
  const dataFinalUrl = canonicalOfficialUrl(data.finalUrl, FNS_RSMP_DATA_HOST, DATA_PATH, 'FNS_RSMP_IMPORT_DATA_FINAL_URL_INVALID');
  const structureUrl = canonicalOfficialUrl(passport.structureUrl, FNS_RSMP_DATA_HOST, STRUCTURE_PATH, 'FNS_RSMP_IMPORT_STRUCTURE_URL_INVALID');
  const structureFinalUrl = canonicalOfficialUrl(structure.finalUrl, FNS_RSMP_DATA_HOST, STRUCTURE_PATH, 'FNS_RSMP_IMPORT_STRUCTURE_FINAL_URL_INVALID');
  if (!sameUrl(dataUrl.url, dataFinalUrl.url) || !sameUrl(structureUrl.url, structureFinalUrl.url)) {
    reject('FNS_RSMP_IMPORT_REDIRECT_OR_DISCOVERY_DRIFT');
  }

  const dataRelease = parseDdMmYyyy(dataUrl.match[1], 'FNS_RSMP_IMPORT_DATA_RELEASE_DATE_INVALID');
  const dataStructureVersion = dataUrl.match[2];
  const structureVersion = structureUrl.match[1];
  if (dataStructureVersion !== structureVersion) reject('FNS_RSMP_IMPORT_STRUCTURE_VERSION_MISMATCH');
  parseDdMmYyyy(structureVersion, 'FNS_RSMP_IMPORT_STRUCTURE_DATE_INVALID');

  if (structure.status !== 200 || structure.contentType !== 'application/xml') reject('FNS_RSMP_IMPORT_XSD_TRANSPORT_INVALID');
  if (!Number.isInteger(structure.contentLength) || structure.contentLength <= 0 || structure.contentLength > FNS_RSMP_MAX_XSD_BYTES) {
    reject('FNS_RSMP_IMPORT_XSD_SIZE_INVALID');
  }
  if (typeof structure.sha256 !== 'string' || !SHA256.test(structure.sha256) || structure.sha256 !== FNS_RSMP_EXPECTED_XSD_SHA256) {
    reject('FNS_RSMP_IMPORT_XSD_FINGERPRINT_UNAUTHORIZED');
  }
  if (structure.identityShapeObserved !== true || structure.activityShapeObserved !== true) {
    reject('FNS_RSMP_IMPORT_REQUIRED_FIELDS_NOT_PROVEN');
  }

  if (data.status !== 200 || !ALLOWED_ARCHIVE_TYPES.has(data.contentType)) reject('FNS_RSMP_IMPORT_ARCHIVE_TRANSPORT_INVALID');
  const archiveBytes = parsePositiveBytes(data.contentLengthHeader, 'FNS_RSMP_IMPORT_ARCHIVE_SIZE_INVALID');
  if (typeof data.etag !== 'string' || data.etag.trim() === '') reject('FNS_RSMP_IMPORT_ETAG_REQUIRED');
  const lastModified = new Date(String(data.lastModified || ''));
  if (Number.isNaN(lastModified.getTime())) reject('FNS_RSMP_IMPORT_LAST_MODIFIED_REQUIRED');
  if (lastModified.getTime() < dataRelease.getTime()) reject('FNS_RSMP_IMPORT_RELEASE_TIMESTAMP_CONTRADICTION');

  return Object.freeze({
    schemaVersion: 'role-eligibility-fns-rsmp-import-authority.v1',
    source: 'FNS_RSMP',
    authorized: true,
    admissionAuthority: false,
    automaticNegativeAuthority: false,
    absenceSemantics: ABSENCE_SEMANTICS,
    archiveUrl: dataFinalUrl.url,
    archiveBytes: archiveBytes.toString(),
    archiveEtag: data.etag,
    archiveLastModified: lastModified.toISOString(),
    snapshotDate: dataRelease.toISOString().slice(0, 10),
    structureUrl: structureFinalUrl.url,
    structureVersion,
    structureSha256: structure.sha256,
    nextPhase: 'STREAMING_ZIP_XML_IMPORT_REQUIRED',
    productionDatabaseMutation: 0,
    registrationTouched: false,
    enforcementChanged: false,
  });
}

function writeResult(path, value) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (path) writeFileSync(resolve(path), json, 'utf8');
  else process.stdout.write(json);
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath) {
    console.error('usage: node scripts/role-eligibility-fns-rsmp-import-contract.mjs <probe.json> [output.json]');
    process.exit(2);
  }
  try {
    const probe = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
    writeResult(outputPath, validateFnsRsmpImportContract(probe));
  } catch (error) {
    const code = error instanceof FnsRsmpImportContractError ? error.code : 'FNS_RSMP_IMPORT_CONTRACT_INTERNAL_ERROR';
    writeResult(outputPath, {
      schemaVersion: 'role-eligibility-fns-rsmp-import-authority.v1',
      source: 'FNS_RSMP',
      authorized: false,
      errorCode: code,
      automaticNegativeAuthority: false,
      productionDatabaseMutation: 0,
      registrationTouched: false,
      enforcementChanged: false,
    });
    console.error(code);
    process.exit(2);
  }
}
