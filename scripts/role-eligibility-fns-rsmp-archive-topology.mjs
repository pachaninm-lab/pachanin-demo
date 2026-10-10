#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FNS_RSMP_DATA_HOST,
  validateFnsRsmpImportContract,
} from './role-eligibility-fns-rsmp-import-contract.mjs';

const MAX_TAIL_BYTES = 128 * 1024;
const MAX_CENTRAL_DIRECTORY_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 20_000;
const MAX_ENTRY_DECOMPRESSED_BYTES = 128 * 1024 * 1024;
const MAX_TOTAL_DECOMPRESSED_BYTES = 128 * 1024 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 1_000;
const REQUEST_TIMEOUT_MS = 30_000;
const SHA256 = /^[a-f0-9]{64}$/;

const u16 = (view, offset) => view.getUint16(offset, true);
const u32 = (view, offset) => view.getUint32(offset, true);

export class FnsRsmpArchiveTopologyError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'FnsRsmpArchiveTopologyError';
    this.code = code;
    this.details = details;
  }
}

const reject = (code, details = {}) => {
  throw new FnsRsmpArchiveTopologyError(code, details);
};

function safeInteger(value, code) {
  const parsed = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) reject(code, { value: String(value) });
  return parsed;
}

function archiveUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || ''));
  } catch {
    reject('FNS_RSMP_TOPOLOGY_ARCHIVE_URL_INVALID');
  }
  if (
    url.protocol !== 'https:'
    || url.hostname !== FNS_RSMP_DATA_HOST
    || url.username
    || url.password
    || url.port
    || url.search
    || url.hash
    || !/^\/opendata\/7707329152-rsmp\/data-\d{8}-structure-\d{8}\.zip$/.test(url.pathname)
  ) reject('FNS_RSMP_TOPOLOGY_ARCHIVE_AUTHORITY_INVALID');
  return url;
}

function decodeArchiveName(bytes, utf8) {
  let name;
  if (utf8) {
    try {
      name = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      reject('FNS_RSMP_TOPOLOGY_ENTRY_NAME_UTF8_INVALID');
    }
  } else {
    if ([...bytes].some((value) => value > 0x7f)) reject('FNS_RSMP_TOPOLOGY_NON_ASCII_LEGACY_NAME_FORBIDDEN');
    name = Buffer.from(bytes).toString('ascii');
  }
  name = name.replace(/\\/g, '/');
  if (!name || name.includes('\0') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    reject('FNS_RSMP_TOPOLOGY_ENTRY_PATH_INVALID');
  }
  const segments = name.split('/');
  if (segments.some((part) => part === '..' || part === '.')) reject('FNS_RSMP_TOPOLOGY_ENTRY_PATH_TRAVERSAL');
  if (!/^[A-Za-z0-9_.\/-]+$/.test(name)) reject('FNS_RSMP_TOPOLOGY_ENTRY_NAME_CHARACTER_INVALID');
  return name;
}

function parseExtraFields(bytes) {
  const fields = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 0;
  while (cursor < bytes.byteLength) {
    if (cursor + 4 > bytes.byteLength) reject('FNS_RSMP_TOPOLOGY_EXTRA_FIELD_TRUNCATED');
    const id = u16(view, cursor);
    const size = u16(view, cursor + 2);
    cursor += 4;
    if (cursor + size > bytes.byteLength) reject('FNS_RSMP_TOPOLOGY_EXTRA_FIELD_BOUNDS');
    fields.push({ id, size });
    cursor += size;
  }
  return fields;
}

export function parseEocdTail(bytes, absoluteStart, archiveBytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 22) reject('FNS_RSMP_TOPOLOGY_EOCD_TAIL_TOO_SMALL');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= 0; offset -= 1) {
    if (u32(view, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) reject('FNS_RSMP_TOPOLOGY_EOCD_MISSING');
  const diskNumber = u16(view, eocd + 4);
  const centralDisk = u16(view, eocd + 6);
  const entriesOnDisk = u16(view, eocd + 8);
  const totalEntries = u16(view, eocd + 10);
  const centralBytes = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);
  const commentBytes = u16(view, eocd + 20);
  const absoluteEocd = absoluteStart + eocd;

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) reject('FNS_RSMP_TOPOLOGY_MULTIDISK_FORBIDDEN');
  if (totalEntries === 0xffff || centralBytes === 0xffffffff || centralOffset === 0xffffffff) reject('FNS_RSMP_TOPOLOGY_ZIP64_FORBIDDEN');
  if (totalEntries <= 0 || totalEntries > MAX_ENTRIES) reject('FNS_RSMP_TOPOLOGY_ENTRY_COUNT_INVALID', { totalEntries });
  if (centralBytes <= 0 || centralBytes > MAX_CENTRAL_DIRECTORY_BYTES) reject('FNS_RSMP_TOPOLOGY_CENTRAL_DIRECTORY_SIZE_INVALID', { centralBytes });
  if (absoluteEocd + 22 + commentBytes !== archiveBytes) reject('FNS_RSMP_TOPOLOGY_EOCD_END_MISMATCH');
  if (centralOffset + centralBytes !== absoluteEocd) reject('FNS_RSMP_TOPOLOGY_CENTRAL_DIRECTORY_LAYOUT_INVALID');
  if (centralOffset + centralBytes > archiveBytes) reject('FNS_RSMP_TOPOLOGY_CENTRAL_DIRECTORY_BOUNDS');

  return { totalEntries, centralBytes, centralOffset, commentBytes, absoluteEocd };
}

export function parseCentralDirectory(bytes, expectedEntries) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength <= 0) reject('FNS_RSMP_TOPOLOGY_CENTRAL_DIRECTORY_EMPTY');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = [];
  let cursor = 0;
  let totalCompressedBytes = 0;
  let totalDecompressedBytes = 0;
  let maxCompressedBytes = 0;
  let maxDecompressedBytes = 0;
  let maxRatio = 0;
  let descriptorEntries = 0;
  const methods = new Set();

  for (let index = 0; index < expectedEntries; index += 1) {
    if (cursor + 46 > bytes.byteLength || u32(view, cursor) !== 0x02014b50) reject('FNS_RSMP_TOPOLOGY_CENTRAL_ENTRY_INVALID', { index });
    const flags = u16(view, cursor + 8);
    const method = u16(view, cursor + 10);
    const compressedBytes = u32(view, cursor + 20);
    const decompressedBytes = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const diskStart = u16(view, cursor + 34);
    const localHeaderOffset = u32(view, cursor + 42);
    const end = cursor + 46 + nameLength + extraLength + commentLength;

    if (end > bytes.byteLength) reject('FNS_RSMP_TOPOLOGY_CENTRAL_ENTRY_BOUNDS', { index });
    if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) reject('FNS_RSMP_TOPOLOGY_ENCRYPTION_FORBIDDEN', { index });
    if (diskStart !== 0) reject('FNS_RSMP_TOPOLOGY_MULTIDISK_FORBIDDEN', { index });
    if (![0, 8].includes(method)) reject('FNS_RSMP_TOPOLOGY_COMPRESSION_METHOD_FORBIDDEN', { index, method });
    if (compressedBytes === 0xffffffff || decompressedBytes === 0xffffffff || localHeaderOffset === 0xffffffff) {
      reject('FNS_RSMP_TOPOLOGY_ZIP64_FORBIDDEN', { index });
    }
    if (decompressedBytes <= 0 || decompressedBytes > MAX_ENTRY_DECOMPRESSED_BYTES) {
      reject('FNS_RSMP_TOPOLOGY_ENTRY_DECOMPRESSED_SIZE_INVALID', { index, decompressedBytes });
    }
    if (compressedBytes <= 0) reject('FNS_RSMP_TOPOLOGY_ENTRY_COMPRESSED_SIZE_INVALID', { index, compressedBytes });
    const ratio = decompressedBytes / compressedBytes;
    if (!Number.isFinite(ratio) || ratio > MAX_COMPRESSION_RATIO) reject('FNS_RSMP_TOPOLOGY_COMPRESSION_RATIO_INVALID', { index, ratio });

    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decodeArchiveName(nameBytes, (flags & 0x0800) !== 0);
    if (!/\.xml$/i.test(name) || name.endsWith('/')) reject('FNS_RSMP_TOPOLOGY_NON_XML_ENTRY_FORBIDDEN', { index });
    const extraBytes = bytes.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength);
    if (parseExtraFields(extraBytes).some((field) => field.id === 0x0001)) reject('FNS_RSMP_TOPOLOGY_ZIP64_EXTRA_FORBIDDEN', { index });

    if ((flags & 0x0008) !== 0) descriptorEntries += 1;
    methods.add(method);
    totalCompressedBytes += compressedBytes;
    totalDecompressedBytes += decompressedBytes;
    maxCompressedBytes = Math.max(maxCompressedBytes, compressedBytes);
    maxDecompressedBytes = Math.max(maxDecompressedBytes, decompressedBytes);
    maxRatio = Math.max(maxRatio, ratio);
    if (!Number.isSafeInteger(totalCompressedBytes) || !Number.isSafeInteger(totalDecompressedBytes)) reject('FNS_RSMP_TOPOLOGY_TOTAL_SIZE_OVERFLOW');
    if (totalDecompressedBytes > MAX_TOTAL_DECOMPRESSED_BYTES) reject('FNS_RSMP_TOPOLOGY_TOTAL_DECOMPRESSED_SIZE_INVALID');

    entries.push({
      name,
      flags,
      method,
      compressedBytes,
      decompressedBytes,
      localHeaderOffset,
      usesDataDescriptor: (flags & 0x0008) !== 0,
    });
    cursor = end;
  }

  if (cursor !== bytes.byteLength) reject('FNS_RSMP_TOPOLOGY_CENTRAL_DIRECTORY_CARDINALITY');
  return {
    entries,
    summary: {
      totalCompressedBytes,
      totalDecompressedBytes,
      maxCompressedBytes,
      maxDecompressedBytes,
      maxCompressionRatio: Number(maxRatio.toFixed(6)),
      descriptorEntries,
      compressionMethods: [...methods].sort((a, b) => a - b),
    },
  };
}

function parseContentRange(raw, requestedStart, requestedEnd, expectedTotal) {
  const match = String(raw || '').match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
  if (!match) reject('FNS_RSMP_TOPOLOGY_CONTENT_RANGE_INVALID', { raw: raw || null });
  const start = safeInteger(match[1], 'FNS_RSMP_TOPOLOGY_CONTENT_RANGE_START_INVALID');
  const end = safeInteger(match[2], 'FNS_RSMP_TOPOLOGY_CONTENT_RANGE_END_INVALID');
  const total = safeInteger(match[3], 'FNS_RSMP_TOPOLOGY_CONTENT_RANGE_TOTAL_INVALID');
  if (start !== requestedStart || end !== requestedEnd || total !== expectedTotal) {
    reject('FNS_RSMP_TOPOLOGY_CONTENT_RANGE_MISMATCH', { start, end, total, requestedStart, requestedEnd, expectedTotal });
  }
}

async function fetchRange(url, start, end, expectedTotal, expectedEtag) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= expectedTotal) {
    reject('FNS_RSMP_TOPOLOGY_RANGE_INVALID', { start, end, expectedTotal });
  }
  const requestedBytes = end - start + 1;
  if (requestedBytes > MAX_CENTRAL_DIRECTORY_BYTES) reject('FNS_RSMP_TOPOLOGY_RANGE_TOO_LARGE', { requestedBytes });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        range: `bytes=${start}-${end}`,
        accept: 'application/zip,application/octet-stream;q=0.9,*/*;q=0.1',
        'accept-encoding': 'identity',
        'cache-control': 'no-transform',
        'user-agent': 'pc-crop-role-eligibility-fns-rsmp-topology/1.0',
      },
    });
    if (response.status !== 206) reject('FNS_RSMP_TOPOLOGY_RANGE_NOT_SUPPORTED', { status: response.status });
    parseContentRange(response.headers.get('content-range'), start, end, expectedTotal);
    const etag = response.headers.get('etag');
    if (!etag || etag !== expectedEtag) reject('FNS_RSMP_TOPOLOGY_ETAG_MISMATCH', { etag: etag || null });
    const contentType = String(response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (!['application/zip', 'application/octet-stream'].includes(contentType)) reject('FNS_RSMP_TOPOLOGY_CONTENT_TYPE_INVALID', { contentType });
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength !== requestedBytes) reject('FNS_RSMP_TOPOLOGY_RANGE_BODY_SIZE_MISMATCH', { expected: requestedBytes, actual: body.byteLength });
    return body;
  } catch (error) {
    if (controller.signal.aborted) reject('FNS_RSMP_TOPOLOGY_RANGE_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function probeLocalHeader(url, entry, archiveBytes, centralOffset, expectedEtag) {
  const fixed = await fetchRange(url, entry.localHeaderOffset, entry.localHeaderOffset + 29, archiveBytes, expectedEtag);
  const fixedView = new DataView(fixed.buffer, fixed.byteOffset, fixed.byteLength);
  if (u32(fixedView, 0) !== 0x04034b50) reject('FNS_RSMP_TOPOLOGY_LOCAL_HEADER_INVALID');
  const flags = u16(fixedView, 6);
  const method = u16(fixedView, 8);
  const nameLength = u16(fixedView, 26);
  const extraLength = u16(fixedView, 28);
  if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) reject('FNS_RSMP_TOPOLOGY_LOCAL_ENCRYPTION_FORBIDDEN');
  if (method !== entry.method || (flags & (0x0008 | 0x0800)) !== (entry.flags & (0x0008 | 0x0800))) {
    reject('FNS_RSMP_TOPOLOGY_LOCAL_CENTRAL_MISMATCH');
  }
  const variableBytes = nameLength + extraLength;
  if (variableBytes <= 0 || variableBytes > 64 * 1024) reject('FNS_RSMP_TOPOLOGY_LOCAL_HEADER_VARIABLE_SIZE_INVALID');
  const variable = await fetchRange(
    url,
    entry.localHeaderOffset + 30,
    entry.localHeaderOffset + 30 + variableBytes - 1,
    archiveBytes,
    expectedEtag,
  );
  const localName = decodeArchiveName(variable.subarray(0, nameLength), (flags & 0x0800) !== 0);
  if (localName !== entry.name) reject('FNS_RSMP_TOPOLOGY_LOCAL_ENTRY_NAME_MISMATCH');
  if (parseExtraFields(variable.subarray(nameLength)).some((field) => field.id === 0x0001)) reject('FNS_RSMP_TOPOLOGY_LOCAL_ZIP64_EXTRA_FORBIDDEN');
  const dataStart = entry.localHeaderOffset + 30 + variableBytes;
  const dataEndExclusive = dataStart + entry.compressedBytes;
  if (dataStart <= entry.localHeaderOffset || dataEndExclusive > centralOffset || dataEndExclusive > archiveBytes) {
    reject('FNS_RSMP_TOPOLOGY_LOCAL_DATA_BOUNDS');
  }
  return { dataStart, dataEndExclusive };
}

export async function probeFnsRsmpArchiveTopology(authorityInput) {
  const authority = validateFnsRsmpImportContract(authorityInput);
  if (authority.authorized !== true || authority.admissionAuthority !== false || authority.automaticNegativeAuthority !== false) {
    reject('FNS_RSMP_TOPOLOGY_IMPORT_AUTHORITY_INVALID');
  }
  if (authority.nextPhase !== 'STREAMING_ZIP_XML_IMPORT_REQUIRED') reject('FNS_RSMP_TOPOLOGY_PHASE_INVALID');
  if (authority.productionDatabaseMutation !== 0 || authority.registrationTouched !== false || authority.enforcementChanged !== false) {
    reject('FNS_RSMP_TOPOLOGY_BOUNDARY_INVALID');
  }
  if (typeof authority.structureSha256 !== 'string' || !SHA256.test(authority.structureSha256)) reject('FNS_RSMP_TOPOLOGY_STRUCTURE_HASH_INVALID');

  const url = archiveUrl(authority.archiveUrl);
  const archiveBytes = safeInteger(authority.archiveBytes, 'FNS_RSMP_TOPOLOGY_ARCHIVE_SIZE_INVALID');
  if (archiveBytes < 22) reject('FNS_RSMP_TOPOLOGY_ARCHIVE_TOO_SMALL');
  const expectedEtag = String(authority.archiveEtag || '');
  if (!expectedEtag) reject('FNS_RSMP_TOPOLOGY_ETAG_REQUIRED');

  const tailBytes = Math.min(MAX_TAIL_BYTES, archiveBytes);
  const tailStart = archiveBytes - tailBytes;
  const tail = await fetchRange(url, tailStart, archiveBytes - 1, archiveBytes, expectedEtag);
  const eocd = parseEocdTail(tail, tailStart, archiveBytes);
  const central = await fetchRange(
    url,
    eocd.centralOffset,
    eocd.centralOffset + eocd.centralBytes - 1,
    archiveBytes,
    expectedEtag,
  );
  const parsed = parseCentralDirectory(central, eocd.totalEntries);

  for (let index = 1; index < parsed.entries.length; index += 1) {
    if (parsed.entries[index].localHeaderOffset <= parsed.entries[index - 1].localHeaderOffset) {
      reject('FNS_RSMP_TOPOLOGY_LOCAL_HEADER_ORDER_INVALID', { index });
    }
  }
  if (parsed.entries[0].localHeaderOffset !== 0) reject('FNS_RSMP_TOPOLOGY_FIRST_LOCAL_HEADER_OFFSET_INVALID');

  const sampleIndexes = [...new Set([0, Math.floor(parsed.entries.length / 2), parsed.entries.length - 1])];
  const localSamples = [];
  for (const index of sampleIndexes) {
    localSamples.push(await probeLocalHeader(url, parsed.entries[index], archiveBytes, eocd.centralOffset, expectedEtag));
  }

  return Object.freeze({
    schemaVersion: 'role-eligibility-fns-rsmp-archive-topology.v1',
    source: 'FNS_RSMP',
    mode: 'READ_ONLY_EXTERNAL_OBSERVATION',
    archiveUrl: url.toString(),
    archiveBytes,
    archiveEtag: expectedEtag,
    snapshotDate: authority.snapshotDate,
    structureVersion: authority.structureVersion,
    structureSha256: authority.structureSha256,
    rangeTransport: 'HTTP_206_EXACT_RANGE',
    rangeSupported: true,
    zip64: false,
    multiDisk: false,
    encryptedEntries: 0,
    entryCount: parsed.entries.length,
    xmlEntryCount: parsed.entries.length,
    centralDirectoryBytes: eocd.centralBytes,
    dataDescriptorEntries: parsed.summary.descriptorEntries,
    compressionMethods: parsed.summary.compressionMethods,
    totalCompressedEntryBytes: parsed.summary.totalCompressedBytes,
    totalDecompressedEntryBytes: parsed.summary.totalDecompressedBytes,
    maxEntryCompressedBytes: parsed.summary.maxCompressedBytes,
    maxEntryDecompressedBytes: parsed.summary.maxDecompressedBytes,
    maxCompressionRatio: parsed.summary.maxCompressionRatio,
    localHeaderSamplesVerified: localSamples.length,
    streamingStrategy: 'HTTP_RANGE_PER_ENTRY_BOUNDED_INFLATE_XML',
    boundedMemoryImportFeasible: true,
    admissionAuthority: false,
    automaticNegativeAuthority: false,
    absenceSemantics: authority.absenceSemantics,
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
    console.error('usage: node scripts/role-eligibility-fns-rsmp-archive-topology.mjs <fns-rsmp-probe.json> [output.json]');
    process.exit(2);
  }
  try {
    const probe = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
    writeResult(outputPath, await probeFnsRsmpArchiveTopology(probe));
  } catch (error) {
    const code = error instanceof FnsRsmpArchiveTopologyError
      ? error.code
      : error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : error instanceof Error
          ? error.message
          : 'FNS_RSMP_TOPOLOGY_INTERNAL_ERROR';
    writeResult(outputPath, {
      schemaVersion: 'role-eligibility-fns-rsmp-archive-topology.v1',
      source: 'FNS_RSMP',
      mode: 'READ_ONLY_EXTERNAL_OBSERVATION',
      rangeSupported: false,
      boundedMemoryImportFeasible: false,
      admissionAuthority: false,
      automaticNegativeAuthority: false,
      productionDatabaseMutation: 0,
      registrationTouched: false,
      enforcementChanged: false,
      errorCode: code,
    });
    console.error(code);
    process.exit(2);
  }
}
