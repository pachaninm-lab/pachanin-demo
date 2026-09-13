import { serverApiUrl } from './server-api';

export type PublicMarketLot = Readonly<{
  publicRef: string;
  culture: string;
  grade: string | null;
  volumeTons: string;
  startPriceKopecksPerTon: string;
  region: string;
  auctionEndsAt: string;
  status: 'BIDDING';
  verificationStatus: 'DECLARED';
  tradePermission: 'PUBLIC_ALLOWED';
  independentVerification: null;
  disclosureCode: 'SELLER_DECLARED_NOT_INDEPENDENTLY_VERIFIED';
  version: string;
}>;

export type PublicMarketReadResult = Readonly<{
  available: boolean;
  authority: null | Readonly<{
    source: 'POSTGRESQL';
    scope: 'PUBLIC_MARKET';
    projection: 'ANONYMIZED_PUBLIC_MARKET';
    sellerIdentity: 'REDACTED';
    observedAt: string;
    version: string;
  }>;
  items: readonly PublicMarketLot[];
  error: string | null;
}>;

const PUBLIC_REF = /^market-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL = /^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,6})?$/;
const INTEGER = /^(?:0|[1-9][0-9]{0,18})$/;
const POSITIVE_INTEGER = /^[1-9][0-9]{0,18}$/;

export async function getPublicMarketLots(): Promise<PublicMarketReadResult> {
  try {
    const response = await fetch(serverApiUrl('/market/lots'), {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`public market ${response.status}`);

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('public market invalid envelope');
    }
    const envelope = payload as Record<string, unknown>;
    const authority = parseAuthority(envelope.authority);
    if (!authority || !Array.isArray(envelope.items)) {
      throw new Error('public market authority unavailable');
    }
    const items = envelope.items.map(parseLot);
    if (items.some((item) => item === null)) {
      throw new Error('public market invalid item');
    }

    return Object.freeze({
      available: true,
      authority,
      items: Object.freeze(items as PublicMarketLot[]),
      error: null,
    });
  } catch (error) {
    return Object.freeze({
      available: false,
      authority: null,
      items: Object.freeze([]),
      error: error instanceof Error ? error.message : 'public market unavailable',
    });
  }
}

function parseAuthority(value: unknown): PublicMarketReadResult['authority'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const observedAt = text(row.observedAt, 80);
  const version = text(row.version, 80);
  if (
    row.source !== 'POSTGRESQL'
    || row.scope !== 'PUBLIC_MARKET'
    || row.projection !== 'ANONYMIZED_PUBLIC_MARKET'
    || row.sellerIdentity !== 'REDACTED'
    || !observedAt || !validIso(observedAt)
    || !version || !/^(?:0|[1-9][0-9]{0,18})$/.test(version)
  ) return null;

  return Object.freeze({
    source: 'POSTGRESQL',
    scope: 'PUBLIC_MARKET',
    projection: 'ANONYMIZED_PUBLIC_MARKET',
    sellerIdentity: 'REDACTED',
    observedAt,
    version,
  });
}

function parseLot(value: unknown): PublicMarketLot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const publicRef = text(row.publicRef, 80);
  const culture = text(row.culture, 200);
  const grade = row.grade === null ? null : text(row.grade, 200);
  const volumeTons = text(row.volumeTons, 64);
  const price = text(row.startPriceKopecksPerTon, 64);
  const region = text(row.region, 500);
  const auctionEndsAt = text(row.auctionEndsAt, 80);
  const version = text(row.version, 64);

  if (
    !publicRef || !PUBLIC_REF.test(publicRef)
    || !culture
    || (row.grade !== null && !grade)
    || !volumeTons || !DECIMAL.test(volumeTons) || Number(volumeTons) <= 0
    || !price || !INTEGER.test(price)
    || !region
    || !auctionEndsAt || !validIso(auctionEndsAt)
    || row.status !== 'BIDDING'
    || row.verificationStatus !== 'DECLARED'
    || row.tradePermission !== 'PUBLIC_ALLOWED'
    || row.independentVerification !== null
    || row.disclosureCode !== 'SELLER_DECLARED_NOT_INDEPENDENTLY_VERIFIED'
    || !version || !POSITIVE_INTEGER.test(version)
  ) return null;

  return Object.freeze({
    publicRef,
    culture,
    grade,
    volumeTons,
    startPriceKopecksPerTon: price,
    region,
    auctionEndsAt,
    status: 'BIDDING',
    verificationStatus: 'DECLARED',
    tradePermission: 'PUBLIC_ALLOWED',
    independentVerification: null,
    disclosureCode: 'SELLER_DECLARED_NOT_INDEPENDENTLY_VERIFIED',
    version,
  });
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/u.test(normalized)) return null;
  return normalized;
}

function validIso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
