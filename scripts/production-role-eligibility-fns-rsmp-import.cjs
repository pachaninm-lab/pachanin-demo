#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const { inflateRawSync } = require('node:zlib');

const SOURCE = 'FNS_RSMP';
const PASSPORT = 'https://www.nalog.gov.ru/opendata/7707329152-rsmp/';
const EXPECTED_XSD_SHA256 = '1d90729f30a3b6119f20db6ca34664034950ecacf86f9fae925ab60ce3cf3845';
const DATA_PATH = /^\/opendata\/7707329152-rsmp\/data-(\d{8})-structure-(\d{8})\.zip$/;
const STRUCTURE_PATH = /^\/opendata\/7707329152-rsmp\/structure-(\d{8})\.xsd$/;
const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 20_000;
const MAX_RATIO = 250;
const TAIL_BYTES = 66_000;
const IMPORT_CONCURRENCY = 2;
const METADATA_TIMEOUTS_MS = Object.freeze([30_000, 90_000, 300_000]);
const RANGE_TIMEOUTS_MS = Object.freeze([60_000, 180_000, 300_000]);
const RETRIABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);
const PARSER_VERSION = 'fns-rsmp-positive-membership-v1';
const ABSENCE_SEMANTICS = 'ABSENCE_IS_NOT_NEGATIVE_LEGAL_ENTITY_EVIDENCE';

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function u16(b, o) { return b.readUInt16LE(o); }
function u32(b, o) { return b.readUInt32LE(o); }
function safeName(bytes) {
  const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\\/g, '/');
  if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some((x) => x === '..')) throw new Error('FNS_RSMP_ZIP_PATH_INVALID');
  if (!/\.xml$/i.test(name)) throw new Error('FNS_RSMP_NON_XML_ENTRY_FORBIDDEN');
  return name;
}
function parseDateToken(token) {
  const m = String(token).match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) throw new Error('FNS_RSMP_RELEASE_DATE_INVALID');
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error('FNS_RSMP_RELEASE_DATE_INVALID');
  return d;
}
function validateOfficialUrl(raw, host, pattern, code) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.hostname !== host || u.username || u.password || u.port || u.search || u.hash || !pattern.test(u.pathname)) throw new Error(code);
  return u;
}
function retryReason(error) {
  if (error && error.code === 'FNS_RSMP_TRANSPORT_TIMEOUT') return 'TIMEOUT';
  const message = error instanceof Error ? error.message : String(error || '');
  const status = message.match(/^FNS_RSMP_HTTP_(\d{3})$/)?.[1];
  if (status && RETRIABLE_HTTP_STATUS.has(Number(status))) return `HTTP_${status}`;
  if (error instanceof TypeError) return 'NETWORK';
  return null;
}
function exhaustedTransportError(stage, reason, attempts) {
  const error = new Error(`FNS_RSMP_TRANSPORT_${stage}_${reason}_EXHAUSTED_AFTER_${attempts}_ATTEMPTS`);
  error.code = 'FNS_RSMP_TRANSPORT_RETRY_EXHAUSTED';
  return error;
}
async function boundedAttempt(url, opts, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: opts.method || 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'user-agent': 'pc-crop-role-eligibility-fns-rsmp-import/1.0',
        'accept-encoding': 'identity',
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`FNS_RSMP_HTTP_${res.status}`);
    if (opts.method === 'HEAD') return { res, body: Buffer.alloc(0) };
    const ab = await res.arrayBuffer();
    const body = Buffer.from(ab);
    if (body.length > (opts.maxBytes || MAX_ENTRY_BYTES)) throw new Error('FNS_RSMP_RESPONSE_TOO_LARGE');
    return { res, body };
  } catch (error) {
    if (controller.signal.aborted) {
      const timeout = new Error('FNS_RSMP_TRANSPORT_TIMEOUT');
      timeout.code = 'FNS_RSMP_TRANSPORT_TIMEOUT';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function bounded(url, opts = {}) {
  const stage = String(opts.stage || 'UNSPECIFIED').replace(/[^A-Z0-9_]/g, '_');
  const timeouts = Array.isArray(opts.timeoutsMs) && opts.timeoutsMs.length
    ? opts.timeoutsMs
    : opts.timeoutMs
      ? [opts.timeoutMs]
      : METADATA_TIMEOUTS_MS;
  if (timeouts.some((value) => !Number.isSafeInteger(value) || value <= 0 || value > 300_000)) throw new Error('FNS_RSMP_TIMEOUT_BUDGET_INVALID');
  const fetchImpl = opts.fetchImpl || fetch;
  for (let attempt = 0; attempt < timeouts.length; attempt += 1) {
    try {
      return await boundedAttempt(url, opts, timeouts[attempt], fetchImpl);
    } catch (error) {
      const reason = retryReason(error);
      if (!reason) throw error;
      if (attempt === timeouts.length - 1) throw exhaustedTransportError(stage, reason, timeouts.length);
      process.stderr.write(`FNS_RSMP_TRANSPORT_RETRY stage=${stage} reason=${reason} attempt=${attempt + 1}/${timeouts.length} timeout_ms=${timeouts[attempt]}\n`);
    }
  }
  throw new Error('FNS_RSMP_TRANSPORT_UNREACHABLE');
}
async function discoverContract() {
  const { res, body } = await bounded(PASSPORT, { stage: 'PASSPORT', maxBytes: 2 * 1024 * 1024, timeoutsMs: METADATA_TIMEOUTS_MS });
  if (res.status !== 200) throw new Error('FNS_RSMP_PASSPORT_UNAVAILABLE');
  const html = new TextDecoder('utf-8', { fatal: false }).decode(body);
  const urls = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => {
    try { return new URL(m[1].replace(/&amp;/g, '&'), PASSPORT).toString(); } catch { return null; }
  }).filter(Boolean);
  const dataUrl = urls.find((x) => /https:\/\/file\.nalog\.ru\/opendata\/7707329152-rsmp\/data-\d{8}-structure-\d{8}\.zip$/i.test(x));
  const xsdUrl = urls.find((x) => /https:\/\/file\.nalog\.ru\/opendata\/7707329152-rsmp\/structure-\d{8}\.xsd$/i.test(x));
  if (!dataUrl || !xsdUrl) throw new Error('FNS_RSMP_PASSPORT_LINKS_UNRESOLVED');
  const data = validateOfficialUrl(dataUrl, 'file.nalog.ru', DATA_PATH, 'FNS_RSMP_DATA_URL_INVALID');
  const xsd = validateOfficialUrl(xsdUrl, 'file.nalog.ru', STRUCTURE_PATH, 'FNS_RSMP_XSD_URL_INVALID');
  const dataMatch = data.pathname.match(DATA_PATH);
  const xsdMatch = xsd.pathname.match(STRUCTURE_PATH);
  if (!dataMatch || !xsdMatch || dataMatch[2] !== xsdMatch[1]) throw new Error('FNS_RSMP_STRUCTURE_VERSION_MISMATCH');
  const xsdFetch = await bounded(xsd.toString(), { stage: 'XSD', maxBytes: 1024 * 1024, timeoutsMs: METADATA_TIMEOUTS_MS });
  if (sha256(xsdFetch.body) !== EXPECTED_XSD_SHA256) throw new Error('FNS_RSMP_XSD_FINGERPRINT_UNAUTHORIZED');
  const head = await bounded(data.toString(), { stage: 'ARCHIVE_HEAD', method: 'HEAD', timeoutsMs: METADATA_TIMEOUTS_MS });
  const bytes = Number(head.res.headers.get('content-length') || 0);
  const etag = head.res.headers.get('etag');
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_ARCHIVE_BYTES || !etag) throw new Error('FNS_RSMP_ARCHIVE_METADATA_INVALID');
  const snapshotDate = parseDateToken(dataMatch[1]);
  const freshUntil = new Date(snapshotDate.getTime() + 35 * 24 * 60 * 60 * 1000);
  if (freshUntil <= new Date()) throw new Error('FNS_RSMP_SNAPSHOT_STALE');
  return { archiveUrl: data.toString(), archiveBytes: bytes, etag, snapshotDate, freshUntil };
}
async function range(url, start, end, etag) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) throw new Error('FNS_RSMP_RANGE_INVALID');
  const { res, body } = await bounded(url, {
    stage: 'ARCHIVE_RANGE',
    timeoutsMs: RANGE_TIMEOUTS_MS,
    maxBytes: Math.max(MAX_ENTRY_BYTES + 4096, end - start + 1),
    headers: { Range: `bytes=${start}-${end}`, 'If-Match': etag },
  });
  if (res.status !== 206) throw new Error('FNS_RSMP_RANGE_NOT_HONORED');
  const cr = res.headers.get('content-range');
  if (!cr || !cr.startsWith(`bytes ${start}-${end}/`)) throw new Error('FNS_RSMP_CONTENT_RANGE_MISMATCH');
  if (res.headers.get('etag') !== etag) throw new Error('FNS_RSMP_ETAG_DRIFT');
  if (body.length !== end - start + 1) throw new Error('FNS_RSMP_RANGE_LENGTH_MISMATCH');
  return body;
}
function parseCentralDirectory(tail, archiveBytes) {
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (u32(tail, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('FNS_RSMP_EOCD_MISSING');
  const disk = u16(tail, eocd + 4);
  const centralDisk = u16(tail, eocd + 6);
  const onDisk = u16(tail, eocd + 8);
  const total = u16(tail, eocd + 10);
  const centralSize = u32(tail, eocd + 12);
  const centralOffset = u32(tail, eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || onDisk !== total) throw new Error('FNS_RSMP_MULTIDISK_FORBIDDEN');
  if (total === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('FNS_RSMP_ZIP64_UNSUPPORTED');
  if (total <= 0 || total > MAX_ENTRIES || centralOffset + centralSize >= archiveBytes) throw new Error('FNS_RSMP_CENTRAL_DIRECTORY_INVALID');
  return { total, centralSize, centralOffset };
}
function parseEntries(cd, expectedTotal) {
  const entries = [];
  let p = 0;
  while (p < cd.length) {
    if (p + 46 > cd.length || u32(cd, p) !== 0x02014b50) throw new Error('FNS_RSMP_CENTRAL_ENTRY_INVALID');
    const flags = u16(cd, p + 8);
    const method = u16(cd, p + 10);
    const crc = u32(cd, p + 16);
    const compressed = u32(cd, p + 20);
    const decompressed = u32(cd, p + 24);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    const disk = u16(cd, p + 34);
    const localOffset = u32(cd, p + 42);
    if ((flags & 1) !== 0 || disk !== 0 || ![0, 8].includes(method) || compressed === 0xffffffff || decompressed === 0xffffffff) throw new Error('FNS_RSMP_ZIP_ENTRY_UNSUPPORTED');
    if (decompressed > MAX_ENTRY_BYTES) throw new Error('FNS_RSMP_ENTRY_TOO_LARGE');
    const ratio = compressed === 0 ? (decompressed === 0 ? 1 : Infinity) : decompressed / compressed;
    if (decompressed >= 1024 * 1024 && ratio > MAX_RATIO) throw new Error('FNS_RSMP_COMPRESSION_RATIO_LIMIT');
    const end = p + 46 + nameLen + extraLen + commentLen;
    if (end > cd.length) throw new Error('FNS_RSMP_CENTRAL_ENTRY_BOUNDS');
    const name = safeName(cd.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, flags, method, crc, compressed, decompressed, localOffset });
    p = end;
  }
  if (entries.length !== expectedTotal) throw new Error('FNS_RSMP_ENTRY_COUNT_MISMATCH');
  return entries;
}
let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      return c >>> 0;
    });
  }
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
async function readEntry(contract, entry) {
  const headerEnd = Math.min(contract.archiveBytes - 1, entry.localOffset + 4095);
  const header = await range(contract.archiveUrl, entry.localOffset, headerEnd, contract.etag);
  if (header.length < 30 || u32(header, 0) !== 0x04034b50) throw new Error('FNS_RSMP_LOCAL_HEADER_INVALID');
  const nameLen = u16(header, 26);
  const extraLen = u16(header, 28);
  if (30 + nameLen + extraLen > header.length) throw new Error('FNS_RSMP_LOCAL_HEADER_BOUNDS');
  const dataStart = entry.localOffset + 30 + nameLen + extraLen;
  const localName = safeName(header.subarray(30, 30 + nameLen));
  if (localName !== entry.name) throw new Error('FNS_RSMP_LOCAL_NAME_MISMATCH');
  const compressed = entry.compressed === 0
    ? Buffer.alloc(0)
    : await range(contract.archiveUrl, dataStart, dataStart + entry.compressed - 1, contract.etag);
  const xmlBytes = entry.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: MAX_ENTRY_BYTES });
  if (xmlBytes.length !== entry.decompressed || crc32(xmlBytes) !== entry.crc) throw new Error('FNS_RSMP_ENTRY_INTEGRITY_MISMATCH');
  return new TextDecoder('utf-8', { fatal: true }).decode(xmlBytes);
}
function extractMembership(xml, wanted) {
  if (/<!DOCTYPE|<!ENTITY|SYSTEM\s+["']|PUBLIC\s+["']/i.test(xml)) throw new Error('FNS_RSMP_XML_EXTERNAL_ENTITY_FORBIDDEN');
  const found = new Map();
  const re = /<[^>]*\s+(ИННЮЛ|ИННФЛ)=["'](\d{10}|\d{12})["'][^>]*>/giu;
  for (const m of xml.matchAll(re)) {
    const inn = m[2];
    if (!wanted.has(inn)) continue;
    const tag = m[0];
    const ogrn = tag.match(/\s+(?:ОГРН|ОГРНИП)=["'](\d{13}|\d{15})["']/u)?.[1] || null;
    found.set(inn, { inn, ogrn, subjectType: m[1] === 'ИННЮЛ' ? 'LEGAL_ENTITY' : 'INDIVIDUAL_ENTREPRENEUR' });
  }
  return found;
}
function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}

async function selfTest() {
  const sample = '<Файл><Документ><ОргВклМСП ИННЮЛ="1234567890" ОГРН="1234567890123"/></Документ></Файл>';
  const got = extractMembership(sample, new Set(['1234567890']));
  if (!got.has('1234567890') || got.get('1234567890').subjectType !== 'LEGAL_ENTITY' || got.get('1234567890').ogrn !== '1234567890123') throw new Error('SELFTEST_MEMBERSHIP');
  if (extractMembership(sample, new Set(['0000000000'])).size !== 0) throw new Error('SELFTEST_ABSENCE');
  const payload = { membership: true, source: SOURCE, supplementaryOnly: true, admissionAuthority: false, automaticNegativeAuthority: false };
  if (sha256(stableJson(payload)).length !== 64) throw new Error('SELFTEST_HASH');
  if (!/^(?:\d{10}|\d{12})$/.test('1234567890') || /^(?:\d{10}|\d{12})$/.test('1234567890123')) throw new Error('SELFTEST_INN_FORMAT');

  let transientCalls = 0;
  const transient = await bounded(PASSPORT, {
    stage: 'SELFTEST_NETWORK',
    maxBytes: 16,
    timeoutsMs: [25, 25],
    fetchImpl: async () => {
      transientCalls += 1;
      if (transientCalls === 1) throw new TypeError('fetch failed');
      return new Response('ok', { status: 200 });
    },
  });
  if (transientCalls !== 2 || transient.body.toString('utf8') !== 'ok') throw new Error('SELFTEST_TRANSPORT_RETRY');

  let timeoutCalls = 0;
  try {
    await bounded(PASSPORT, {
      stage: 'SELFTEST_TIMEOUT',
      timeoutsMs: [25, 25],
      fetchImpl: async () => {
        timeoutCalls += 1;
        const error = new Error('synthetic timeout');
        error.code = 'FNS_RSMP_TRANSPORT_TIMEOUT';
        throw error;
      },
    });
    throw new Error('SELFTEST_TIMEOUT_EXPECTED_FAILURE');
  } catch (error) {
    if (timeoutCalls !== 2 || !/FNS_RSMP_TRANSPORT_SELFTEST_TIMEOUT_TIMEOUT_EXHAUSTED_AFTER_2_ATTEMPTS/.test(error.message)) throw new Error('SELFTEST_TIMEOUT_FAIL_CLOSED');
  }

  let policyCalls = 0;
  try {
    await bounded(PASSPORT, {
      stage: 'SELFTEST_POLICY',
      timeoutsMs: [25, 25],
      fetchImpl: async () => {
        policyCalls += 1;
        return new Response('', { status: 404 });
      },
    });
    throw new Error('SELFTEST_POLICY_EXPECTED_FAILURE');
  } catch (error) {
    if (policyCalls !== 1 || error.message !== 'FNS_RSMP_HTTP_404') throw new Error('SELFTEST_NON_RETRIABLE_POLICY');
  }

  process.stdout.write('FNS_RSMP_IMPORT_SELFTEST=PASS\n');
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  const report = {
    schemaVersion: 'role-eligibility-fns-rsmp-shadow-import.v1',
    source: SOURCE,
    shadowMode: true,
    enforcement: false,
    admissionAuthority: false,
    automaticNegativeAuthority: false,
    absenceSemantics: ABSENCE_SEMANTICS,
    registrationTouched: false,
    productionDatabaseMutation: 0,
    candidates: 0,
    uniqueSubjects: 0,
    entriesScanned: 0,
    matchedSubjects: 0,
    evidenceInserted: 0,
  };
  try {
    const contract = await discoverContract();
    const checks = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT ON (application_id, application_version, requested_role)
        id AS check_id, inn, ogrn
      FROM eligibility.organization_checks
      ORDER BY application_id, application_version, requested_role, created_at DESC, id DESC
    `);
    report.candidates = checks.length;
    const byInn = new Map();
    for (const row of checks) {
      const inn = String(row.inn || '');
      if (!/^(?:\d{10}|\d{12})$/.test(inn)) continue;
      const arr = byInn.get(inn) || [];
      arr.push({ checkId: row.check_id, ogrn: row.ogrn || null });
      byInn.set(inn, arr);
    }
    report.uniqueSubjects = byInn.size;
    if (byInn.size === 0) {
      process.stdout.write(`${JSON.stringify(report)}\n`);
      return;
    }

    const tailStart = Math.max(0, contract.archiveBytes - TAIL_BYTES);
    const tail = await range(contract.archiveUrl, tailStart, contract.archiveBytes - 1, contract.etag);
    const meta = parseCentralDirectory(tail, contract.archiveBytes);
    const cd = await range(contract.archiveUrl, meta.centralOffset, meta.centralOffset + meta.centralSize - 1, contract.etag);
    const entries = parseEntries(cd, meta.total);
    const matched = new Map();

    for (let offset = 0; offset < entries.length; offset += IMPORT_CONCURRENCY) {
      const batch = entries.slice(offset, offset + IMPORT_CONCURRENCY);
      const xmls = await Promise.all(batch.map(async (entry) => ({ entry, xml: await readEntry(contract, entry) })));
      report.entriesScanned += xmls.length;
      for (const { entry, xml } of xmls) {
        for (const [inn, value] of extractMembership(xml, byInn)) {
          if (!matched.has(inn)) matched.set(inn, { ...value, entry: entry.name });
        }
      }
      if (matched.size === byInn.size) break;
    }

    report.matchedSubjects = matched.size;
    const generation = `fns-rsmp:${contract.snapshotDate.toISOString().slice(0, 10)}:${sha256(contract.etag).slice(0, 16)}`;
    const now = new Date();
    for (const [inn, match] of matched) {
      for (const check of byInn.get(inn) || []) {
        const payload = {
          membership: true,
          source: SOURCE,
          subjectType: match.subjectType,
          supplementaryOnly: true,
          admissionAuthority: false,
          automaticNegativeAuthority: false,
          absenceSemantics: ABSENCE_SEMANTICS,
        };
        const payloadHash = sha256(stableJson(payload));
        const sourceRecordId = `rsmp_${sha256(`${match.entry}\u001f${inn}`).slice(0, 40)}`;
        const evidenceId = `ele_${sha256(`${check.checkId}\u001f${generation}\u001f${sourceRecordId}\u001f${payloadHash}`).slice(0, 36)}`;
        const inserted = await prisma.$executeRawUnsafe(`
          INSERT INTO eligibility.evidence(
            id,check_id,source_type,source_name,source_record_id,registry_generation,subject_inn,subject_ogrn,
            evidence_type,normalized_payload,source_published_at,source_checked_at,valid_from,valid_until,fresh_until,
            parser_version,payload_sha256,confidence_class,created_at
          ) VALUES ($1,$2,'FNS_RSMP','ФНС России — Единый реестр субъектов МСП',$3,$4,$5,$6,
            'SME_REGISTER_POSITIVE_MEMBERSHIP',$7::jsonb,$8,$9,NULL,NULL,$10,$11,$12,'HIGH',clock_timestamp())
          ON CONFLICT (check_id,source_type,source_record_id,registry_generation,payload_sha256) DO NOTHING
        `, evidenceId, check.checkId, sourceRecordId, generation, inn, match.ogrn || check.ogrn, JSON.stringify(payload), contract.snapshotDate, now, contract.freshUntil, PARSER_VERSION, payloadHash);
        report.evidenceInserted += Number(inserted || 0);
        const auditId = `ela_${sha256(`${evidenceId}\u001fFNS_RSMP`).slice(0, 36)}`;
        await prisma.$executeRawUnsafe(`
          INSERT INTO eligibility.audit_events(id,event_type,check_id,correlation_id,payload,created_at)
          VALUES ($1,'ROLE_ELIGIBILITY_EVIDENCE_CREATED',$2,$3,$4::jsonb,clock_timestamp())
          ON CONFLICT (id) DO NOTHING
        `, auditId, check.checkId, `fns-rsmp-shadow:${generation}`, JSON.stringify({
          source: SOURCE,
          evidenceType: 'SME_REGISTER_POSITIVE_MEMBERSHIP',
          supplementaryOnly: true,
          admissionAuthority: false,
          automaticNegativeAuthority: false,
        }));
      }
    }
    report.productionDatabaseMutation = report.evidenceInserted;
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`FNS_RSMP_SHADOW_IMPORT_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`);
  process.exitCode = 1;
});
