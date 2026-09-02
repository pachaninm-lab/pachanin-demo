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
  timeoutMs: number;
  acceptedContentTypes: readonly string[];
};

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

async function readBoundedBody(response: Response, maxBytes: number, source: EligibilitySource): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`${source}_RESPONSE_TOO_LARGE`);
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`${profile.source}_TIMEOUT`), profile.timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        accept: profile.acceptedContentTypes.join(', '),
        'user-agent': 'Prozrachnaya-Cena-Role-Eligibility/1.0',
      },
    });
    if (!response.ok) throw new Error(`${profile.source}_HTTP_${response.status}`);
    validateContentType(response, profile);
    const body = await readBoundedBody(response, profile.maxResponseBytes, profile.source);
    return {
      body,
      contentType: String(response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase(),
      checkedAt: new Date(),
    };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${profile.source}_TIMEOUT`);
    throw error;
  } finally {
    clearTimeout(timer);
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
