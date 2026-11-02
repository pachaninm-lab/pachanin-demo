import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type GektaPublicLegalDocument = Readonly<{
  slug: string; title: string; description: string; summary: string;
  sections: readonly Readonly<{ heading: string; paragraphs: readonly string[] }>[];
}>;
export type GektaLegalEvidence = Readonly<{
  schemaVersion: 'gekta.legal-evidence.v1';
  version: string;
  surfaceLocale: 'ru' | 'en' | 'zh';
  documentLocale: 'ru';
  sourceSurface: 'GEKTA_REGISTRATION' | 'GEKTA_ANONYMOUS_NOTICE';
  profile: Readonly<{ id: string; effectiveFrom: string; contentHash: string }>;
  terms: Readonly<{ purpose: 'SERVICE_TERMS' | 'TERMS_NOTICE'; source: string; version: string; contentHash: string; document: GektaPublicLegalDocument }>;
  privacy: Readonly<{ purpose: 'PERSONAL_DATA' | 'PRIVACY_NOTICE'; source: string; version: string; contentHash: string; document: GektaPublicLegalDocument }>;
}>;

export const GEKTA_CONSENT_SNAPSHOT_TTL_MS = 15 * 60_000;
const SNAPSHOT_SCHEMA = 'gekta.registration-consent-snapshot.v1';
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

/** Closed JSON values, stable across the existing API and web runtimes. */
export function canonicalLegalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalLegalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalLegalJson(entry)}`).join(',')}}`;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Legal evidence must contain only JSON values');
  return serialized;
}

export function legalContentHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalLegalJson(value), 'utf8').digest('hex')}`;
}

export function renderedLegalDocumentHash(version: string, profileHash: string, document: GektaPublicLegalDocument): string {
  return legalContentHash({ version, documentLocale: 'ru', profileHash, document });
}

function keys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...expected].sort().join('|'));
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
function documentValid(value: unknown, slug: string): value is GektaPublicLegalDocument {
  if (!keys(value, ['slug', 'title', 'description', 'summary', 'sections']) || value.slug !== slug
    || !text(value.title, 500) || !text(value.description, 2_000) || !text(value.summary, 5_000)
    || !Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 50) return false;
  return value.sections.every(section => keys(section, ['heading', 'paragraphs']) && text(section.heading, 500)
    && Array.isArray(section.paragraphs) && section.paragraphs.length > 0 && section.paragraphs.length <= 50
    && section.paragraphs.every(paragraph => text(paragraph, 20_000)));
}

export function isGektaLegalEvidence(value: unknown): value is GektaLegalEvidence {
  if (!keys(value, ['schemaVersion', 'version', 'surfaceLocale', 'documentLocale', 'sourceSurface', 'profile', 'terms', 'privacy'])
    || value.schemaVersion !== 'gekta.legal-evidence.v1' || !text(value.version, 32)
    || !/^\d{4}-\d{2}-\d{2}(?:\.\d+)?$/u.test(value.version)
    || !['ru', 'en', 'zh'].includes(String(value.surfaceLocale)) || value.documentLocale !== 'ru'
    || !['GEKTA_REGISTRATION', 'GEKTA_ANONYMOUS_NOTICE'].includes(String(value.sourceSurface))) return false;
  const profile = value.profile;
  if (!keys(profile, ['id', 'effectiveFrom', 'contentHash']) || !text(profile.id, 128)
    || !text(profile.effectiveFrom, 64) || !HASH_PATTERN.test(String(profile.contentHash))) return false;
  const registration = value.sourceSurface === 'GEKTA_REGISTRATION';
  for (const [name, slug, purpose] of [
    ['terms', 'usloviya-ispolzovaniya-gekta', registration ? 'SERVICE_TERMS' : 'TERMS_NOTICE'],
    ['privacy', registration ? 'politika-obrabotki-personalnyh-dannyh' : 'politika-konfidencialnosti', registration ? 'PERSONAL_DATA' : 'PRIVACY_NOTICE'],
  ]) {
    const doc = value[name];
    if (!keys(doc, ['purpose', 'source', 'version', 'contentHash', 'document']) || doc.purpose !== purpose
      || doc.source !== `/legal/${slug}` || doc.version !== value.version || !documentValid(doc.document, slug)
      || doc.contentHash !== renderedLegalDocumentHash(value.version, String(profile.contentHash), doc.document)) return false;
  }
  return Buffer.byteLength(canonicalLegalJson(value), 'utf8') <= 64 * 1024;
}

function signature(body: string, key: string): string {
  return createHmac('sha256', key).update(`${SNAPSHOT_SCHEMA}:${body}`).digest('base64url');
}

/** A short-lived commitment to the actual form's documents, not an auth credential. */
export function sealGektaConsentSnapshot(evidence: GektaLegalEvidence, key: string, now: Date = new Date()): string | null {
  if (key.length < 32 || !isGektaLegalEvidence(evidence) || evidence.sourceSurface !== 'GEKTA_REGISTRATION') return null;
  const issuedAt = now.getTime();
  if (!Number.isSafeInteger(issuedAt)) return null;
  const payload = { schemaVersion: SNAPSHOT_SCHEMA, issuedAt, expiresAt: issuedAt + GEKTA_CONSENT_SNAPSHOT_TTL_MS,
    nonce: randomBytes(16).toString('base64url'), evidenceHash: legalContentHash(evidence) };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${signature(body, key)}`;
}

export function verifyGektaConsentSnapshot(
  token: unknown, evidence: unknown, key: string, now: Date = new Date(),
): Readonly<{ issuedAt: number; evidenceHash: string }> | null {
  if (!Number.isSafeInteger(now.getTime()) || key.length < 32 || typeof token !== 'string' || token.length > 4_096
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u.test(token)) return null;
  const [body, rawSignature] = token.split('.');
  const expected = Buffer.from(signature(body, key));
  const supplied = Buffer.from(rawSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!keys(payload, ['schemaVersion', 'issuedAt', 'expiresAt', 'nonce', 'evidenceHash']) || payload.schemaVersion !== SNAPSHOT_SCHEMA
      || !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt)
      || typeof payload.issuedAt !== 'number' || typeof payload.expiresAt !== 'number'
      || payload.expiresAt !== payload.issuedAt + GEKTA_CONSENT_SNAPSHOT_TTL_MS
      || payload.issuedAt > now.getTime() || now.getTime() >= payload.expiresAt
      || typeof payload.nonce !== 'string' || !/^[A-Za-z0-9_-]{22}$/u.test(payload.nonce)
      || !isGektaLegalEvidence(evidence) || evidence.sourceSurface !== 'GEKTA_REGISTRATION'
      || payload.evidenceHash !== legalContentHash(evidence)) return null;
    return { issuedAt: payload.issuedAt, evidenceHash: payload.evidenceHash };
  } catch { return null; }
}
