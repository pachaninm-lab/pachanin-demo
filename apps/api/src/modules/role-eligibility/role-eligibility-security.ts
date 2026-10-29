import { createHash } from 'node:crypto';
import type { EligibilitySource, SourceManifestEntry } from './role-eligibility.types';

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sourceManifestHash(entries: SourceManifestEntry[]): string {
  const canonical = [...entries]
    .sort((left, right) => {
      const a = `${left.source}\u001f${left.generation}\u001f${left.evidenceId}`;
      const b = `${right.source}\u001f${right.generation}\u001f${right.evidenceId}`;
      return a.localeCompare(b);
    })
    .map((entry) => ({
      source: entry.source,
      generation: entry.generation,
      evidenceId: entry.evidenceId,
      evidenceHash: entry.evidenceHash,
      sourcePublishedAt: entry.sourcePublishedAt,
      parserVersion: entry.parserVersion,
    }));
  return sha256(stableJson(canonical));
}

export type SourceHttpProfile = {
  source: EligibilitySource;
  allowedHosts: readonly string[];
  maxResponseBytes: number;
  /** DNS + TCP + TLS + first response headers safety ceiling. */
  connectTimeoutMs?: number;
  /** Maximum idle time while waiting for each response body chunk. */
  readTimeoutMs?: number;
  /** Backward-compatible total-ish timeout used when split values are omitted. */
  timeoutMs?: number;
  acceptedContentTypes: readonly string[];
};

function positiveTimeout(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) >= 100 && Number(value) <= 120_000
    ? Math.trunc(Number(value))
    : fallback;
}

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

function validateFixedOfficialUrl(input: string, profile: SourceHttpProfile): URL {
  const url = new URL(input);
  if (url.protocol !== 'https:') throw new Error(`${profile.source}_HTTPS_REQUIRED`);
  if (url.username || url.password) throw new Error(`${profile.source}_URL_CREDENTIALS_FORBIDDEN`);
  if (url.port && url.port !== '443') throw new Error(`${profile.source}_NONSTANDARD_PORT_FORBIDDEN`);
  const host = normalizeHost(url.hostname);
  const allowed = profile.allowedHosts.map(normalizeHost);
  if (!allowed.includes(host)) throw new Error(`${profile.source}_HOST_NOT_ALLOWLISTED`);
  return url;
}

function validateContentType(response: Response, profile: SourceHttpProfile): void {
  const contentType = String(response.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (!contentType || !profile.acceptedContentTypes.map((value) => value.toLowerCase()).includes(contentType)) {
    throw new Error(`${profile.source}_CONTENT_TYPE_CHANGED`);
  }
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
  source: EligibilitySource,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${source}_READ_TIMEOUT`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
  source: EligibilitySource,
  readTimeoutMs: number,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`${source}_RESPONSE_TOO_LARGE`);
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await readWithTimeout(reader, readTimeoutMs, source);
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel(`${source}_RESPONSE_TOO_LARGE`).catch(() => undefined);
        throw new Error(`${source}_RESPONSE_TOO_LARGE`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function fetchOfficialSource(
  fixedUrl: string,
  profile: SourceHttpProfile,
): Promise<{ body: Uint8Array; contentType: string; checkedAt: Date }> {
  const url = validateFixedOfficialUrl(fixedUrl, profile);
  const legacy = positiveTimeout(profile.timeoutMs, 20_000);
  const connectTimeoutMs = positiveTimeout(profile.connectTimeoutMs, legacy);
  const readTimeoutMs = positiveTimeout(profile.readTimeoutMs, legacy);
  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(`${profile.source}_CONNECT_TIMEOUT`), connectTimeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          accept: profile.acceptedContentTypes.join(', '),
          'user-agent': 'Prozrachnaya-Cena-Role-Eligibility/1.0',
        },
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`${profile.source}_CONNECT_TIMEOUT`);
      throw error;
    } finally {
      clearTimeout(connectTimer);
    }
    if (!response.ok) throw new Error(`${profile.source}_HTTP_${response.status}`);
    validateContentType(response, profile);
    const body = await readBoundedBody(response, profile.maxResponseBytes, profile.source, readTimeoutMs);
    return {
      body,
      contentType: String(response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase(),
      checkedAt: new Date(),
    };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${profile.source}_CONNECT_TIMEOUT`);
    throw error;
  } finally {
    clearTimeout(connectTimer);
  }
}

export function decodeUtf8Strict(bytes: Uint8Array, source: EligibilitySource): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${source}_INVALID_UTF8`);
  }
}

export function assertXmlSafe(xml: string, source: EligibilitySource): void {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml) || /SYSTEM\s+["']/i.test(xml) || /PUBLIC\s+["']/i.test(xml)) {
    throw new Error(`${source}_XML_EXTERNAL_ENTITY_FORBIDDEN`);
  }
}

export function assertJsonDepth(value: unknown, maxDepth = 24, maxKeys = 50_000): void {
  let keys = 0;
  const visit = (entry: unknown, depth: number): void => {
    if (depth > maxDepth) throw new Error('JSON_DEPTH_LIMIT');
    if (entry === null || typeof entry !== 'object') return;
    if (Array.isArray(entry)) {
      for (const child of entry) visit(child, depth + 1);
      return;
    }
    for (const child of Object.values(entry as Record<string, unknown>)) {
      keys += 1;
      if (keys > maxKeys) throw new Error('JSON_KEY_LIMIT');
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
}

export function assertCsvBounds(text: string, maxRows: number, maxColumns: number, maxCellChars: number): void {
  const rows = text.split(/\r?\n/);
  if (rows.length > maxRows + 1) throw new Error('CSV_ROW_LIMIT');
  for (const row of rows) {
    if (!row) continue;
    const columns = row.split(';');
    if (columns.length > maxColumns) throw new Error('CSV_COLUMN_LIMIT');
    if (columns.some((cell) => cell.length > maxCellChars)) throw new Error('CSV_CELL_LIMIT');
  }
}

export type ZipSafetyLimits = {
  maxEntries: number;
  maxCompressedBytes: number;
  maxDecompressedBytes: number;
  maxEntryDecompressedBytes: number;
  maxCompressionRatio: number;
};

export type ZipEntryMetadata = {
  name: string;
  compressedBytes: number;
  decompressedBytes: number;
  compressionMethod: number;
};

const DEFAULT_ZIP_LIMITS: Readonly<ZipSafetyLimits> = Object.freeze({
  maxEntries: 2_000,
  maxCompressedBytes: 64 * 1024 * 1024,
  maxDecompressedBytes: 256 * 1024 * 1024,
  maxEntryDecompressedBytes: 64 * 1024 * 1024,
  maxCompressionRatio: 200,
});

function u16(view: DataView, offset: number): number { return view.getUint16(offset, true); }
function u32(view: DataView, offset: number): number { return view.getUint32(offset, true); }

function safeArchiveName(bytes: Uint8Array): string {
  const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\\/g, '/');
  if (!name || name.includes('\0') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) throw new Error('ZIP_ENTRY_PATH_INVALID');
  const segments = name.split('/');
  if (segments.some((part) => part === '..')) throw new Error('ZIP_ENTRY_PATH_TRAVERSAL');
  return name;
}

/**
 * Validates ZIP central-directory metadata before any extraction. ZIP64,
 * encryption, multi-disk archives and unknown compression methods are rejected
 * fail-closed so callers never have to expand attacker-controlled content in
 * order to decide whether it is safe.
 */
export function inspectZipArchive(
  bytes: Uint8Array,
  limits: Partial<ZipSafetyLimits> = {},
): ZipEntryMetadata[] {
  const cfg: ZipSafetyLimits = { ...DEFAULT_ZIP_LIMITS, ...limits };
  if (bytes.byteLength > cfg.maxCompressedBytes) throw new Error('ZIP_COMPRESSED_SIZE_LIMIT');
  if (bytes.byteLength < 22) throw new Error('ZIP_TRUNCATED');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lowerBound = Math.max(0, bytes.byteLength - (65_535 + 22));
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= lowerBound; offset -= 1) {
    if (u32(view, offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('ZIP_EOCD_MISSING');
  const diskNumber = u16(view, eocd + 4);
  const centralDisk = u16(view, eocd + 6);
  const entriesOnDisk = u16(view, eocd + 8);
  const totalEntries = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);
  const commentLength = u16(view, eocd + 20);
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) throw new Error('ZIP_MULTIDISK_FORBIDDEN');
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('ZIP64_UNSUPPORTED');
  if (totalEntries > cfg.maxEntries) throw new Error('ZIP_ENTRY_LIMIT');
  if (eocd + 22 + commentLength !== bytes.byteLength) throw new Error('ZIP_TRAILING_OR_TRUNCATED_DATA');
  if (centralOffset + centralSize > eocd || centralOffset + centralSize > bytes.byteLength) throw new Error('ZIP_CENTRAL_DIRECTORY_BOUNDS');

  const entries: ZipEntryMetadata[] = [];
  let cursor = centralOffset;
  let totalDecompressed = 0;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > centralOffset + centralSize || u32(view, cursor) !== 0x02014b50) throw new Error('ZIP_CENTRAL_ENTRY_INVALID');
    const flags = u16(view, cursor + 8);
    const method = u16(view, cursor + 10);
    const compressedBytes = u32(view, cursor + 20);
    const decompressedBytes = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const entryCommentLength = u16(view, cursor + 32);
    const diskStart = u16(view, cursor + 34);
    if ((flags & 0x0001) !== 0) throw new Error('ZIP_ENCRYPTION_FORBIDDEN');
    if (diskStart !== 0) throw new Error('ZIP_MULTIDISK_FORBIDDEN');
    if (![0, 8].includes(method)) throw new Error('ZIP_COMPRESSION_METHOD_FORBIDDEN');
    if (compressedBytes === 0xffffffff || decompressedBytes === 0xffffffff) throw new Error('ZIP64_UNSUPPORTED');
    if (decompressedBytes > cfg.maxEntryDecompressedBytes) throw new Error('ZIP_ENTRY_DECOMPRESSED_SIZE_LIMIT');
    const ratio = compressedBytes === 0 ? (decompressedBytes === 0 ? 1 : Number.POSITIVE_INFINITY) : decompressedBytes / compressedBytes;
    if (decompressedBytes >= 1024 * 1024 && ratio > cfg.maxCompressionRatio) throw new Error('ZIP_COMPRESSION_RATIO_LIMIT');
    totalDecompressed += decompressedBytes;
    if (totalDecompressed > cfg.maxDecompressedBytes) throw new Error('ZIP_DECOMPRESSED_SIZE_LIMIT');
    const entryEnd = cursor + 46 + nameLength + extraLength + entryCommentLength;
    if (entryEnd > centralOffset + centralSize) throw new Error('ZIP_CENTRAL_ENTRY_BOUNDS');
    const name = safeArchiveName(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.push({ name, compressedBytes, decompressedBytes, compressionMethod: method });
    cursor = entryEnd;
  }
  if (cursor !== centralOffset + centralSize) throw new Error('ZIP_CENTRAL_DIRECTORY_CARDINALITY');
  return entries;
}

export function assertXlsxBounds(
  bytes: Uint8Array,
  limits: Partial<ZipSafetyLimits> & { maxWorksheets?: number; maxSharedStringsBytes?: number } = {},
): ZipEntryMetadata[] {
  const entries = inspectZipArchive(bytes, limits);
  const names = new Set(entries.map((entry) => entry.name));
  if (!names.has('[Content_Types].xml') || !names.has('_rels/.rels') || !names.has('xl/workbook.xml')) {
    throw new Error('XLSX_REQUIRED_STRUCTURE_MISSING');
  }
  const worksheets = entries.filter((entry) => /^xl\/worksheets\/sheet[^/]*\.xml$/i.test(entry.name));
  if (worksheets.length > (limits.maxWorksheets ?? 128)) throw new Error('XLSX_WORKSHEET_LIMIT');
  const sharedStrings = entries.find((entry) => entry.name.toLowerCase() === 'xl/sharedstrings.xml');
  if (sharedStrings && sharedStrings.decompressedBytes > (limits.maxSharedStringsBytes ?? 64 * 1024 * 1024)) {
    throw new Error('XLSX_SHARED_STRINGS_SIZE_LIMIT');
  }
  if (entries.some((entry) => entry.name.toLowerCase().startsWith('xl/externallinks/'))) {
    throw new Error('XLSX_EXTERNAL_LINKS_FORBIDDEN');
  }
  return entries;
}

export async function withParserTimeout<T>(source: EligibilitySource, timeoutMs: number, task: () => Promise<T> | T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${source}_PARSER_TIMEOUT`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function sanitizeReasonCode(error: unknown, source?: EligibilitySource): string {
  const raw = error instanceof Error ? error.message : String(error || 'UNKNOWN');
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9_:-]/g, '_').slice(0, 120);
  return source && !normalized.startsWith(`${source}_`) ? `${source}_${normalized}`.slice(0, 120) : normalized;
}
