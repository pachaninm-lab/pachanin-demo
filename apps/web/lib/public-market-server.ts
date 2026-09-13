import { serverApiUrl } from './server-api';

export type PublicMarketTeaserLot = Readonly<{
  lotId: string;
  culture: string;
  grade: string | null;
  volumeTons: string;
  region: string;
  startPriceKopecksPerTon: string;
  auctionEndsAt: string;
  verificationLevel: 'VERIFIED';
}>;

export type PublicMarketTeaserSnapshot = Readonly<{
  state: 'ready' | 'unavailable';
  items: PublicMarketTeaserLot[];
}>;

const SAFE_DECIMAL = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,6})?$/;
const SAFE_MONEY = /^(?:0|[1-9]\d{0,18})$/;

export async function getPublicMarketTeaser(): Promise<PublicMarketTeaserSnapshot> {
  try {
    const response = await fetch(serverApiUrl('/lots/market'), {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return { state: 'unavailable', items: [] };

    const payload = await response.json() as unknown;
    const parsed = parseSnapshot(payload);
    return parsed ? { state: 'ready', items: parsed } : { state: 'unavailable', items: [] };
  } catch {
    return { state: 'unavailable', items: [] };
  }
}

function parseSnapshot(value: unknown): PublicMarketTeaserLot[] | null {
  if (!isRecord(value)) return null;
  if (value.source !== 'POSTGRESQL' || value.visibility !== 'ANONYMIZED' || !Array.isArray(value.items)) return null;
  if (value.items.length > 24) return null;

  const items: PublicMarketTeaserLot[] = [];
  for (const candidate of value.items) {
    const parsed = parseLot(candidate);
    if (!parsed) return null;
    items.push(parsed);
  }
  return items;
}

function parseLot(value: unknown): PublicMarketTeaserLot | null {
  if (!isRecord(value)) return null;
  const lotId = boundedText(value.lotId, 240);
  const culture = boundedText(value.culture, 80);
  const region = boundedText(value.region, 120);
  const grade = value.grade === null ? null : boundedText(value.grade, 80);
  const volumeTons = typeof value.volumeTons === 'string' && SAFE_DECIMAL.test(value.volumeTons) ? value.volumeTons : null;
  const startPriceKopecksPerTon = typeof value.startPriceKopecksPerTon === 'string' && SAFE_MONEY.test(value.startPriceKopecksPerTon)
    ? value.startPriceKopecksPerTon
    : null;
  const auctionEndsAt = isoDateText(value.auctionEndsAt);

  if (!lotId || !culture || !region || grade === '' || !volumeTons || !startPriceKopecksPerTon || !auctionEndsAt) return null;
  if (value.verificationLevel !== 'VERIFIED') return null;

  return {
    lotId,
    culture,
    grade,
    volumeTons,
    region,
    startPriceKopecksPerTon,
    auctionEndsAt,
    verificationLevel: 'VERIFIED',
  };
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/u.test(normalized)) return null;
  return normalized;
}

function isoDateText(value: unknown): string | null {
  if (typeof value !== 'string' || !value.includes('T')) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
