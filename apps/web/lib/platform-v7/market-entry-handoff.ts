import type { MarketLotDraft, MarketRfqDraft } from './market-entry-conversion';

export const MARKET_LOT_HANDOFF_KEY = 'platform-v7.market-entry.lot-draft.v1';
export const MARKET_RFQ_HANDOFF_KEY = 'platform-v7.market-entry.rfq-draft.v1';

export interface MarketHandoffStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveMarketLotHandoff(storage: MarketHandoffStorageLike | null | undefined, draft: MarketLotDraft): void {
  try {
    storage?.setItem(MARKET_LOT_HANDOFF_KEY, JSON.stringify(draft));
  } catch {
    return;
  }
}

export function saveMarketRfqHandoff(storage: MarketHandoffStorageLike | null | undefined, draft: MarketRfqDraft): void {
  try {
    storage?.setItem(MARKET_RFQ_HANDOFF_KEY, JSON.stringify(draft));
  } catch {
    return;
  }
}

export function readMarketLotHandoff(storage: MarketHandoffStorageLike | null | undefined): MarketLotDraft | null {
  return readJson(storage, MARKET_LOT_HANDOFF_KEY, isMarketLotDraft);
}

export function readMarketRfqHandoff(storage: MarketHandoffStorageLike | null | undefined): MarketRfqDraft | null {
  return readJson(storage, MARKET_RFQ_HANDOFF_KEY, isMarketRfqDraft);
}

export function clearMarketLotHandoff(storage: MarketHandoffStorageLike | null | undefined): void {
  try { storage?.removeItem(MARKET_LOT_HANDOFF_KEY); } catch { return; }
}

function readJson<T>(storage: MarketHandoffStorageLike | null | undefined, key: string, guard: (value: unknown) => value is T): T | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isMarketLotDraft(value: unknown): value is MarketLotDraft {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MarketLotDraft>;
  return typeof item.sourceIntentId === 'string' && typeof item.grain === 'string' && typeof item.volumeTons === 'number' && typeof item.pricePerTon === 'number' && item.basis === 'EXW' && item.docsReady === false;
}

function isMarketRfqDraft(value: unknown): value is MarketRfqDraft {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MarketRfqDraft>;
  return typeof item.sourceIntentId === 'string' && typeof item.crop === 'string' && typeof item.volumeTons === 'number' && typeof item.targetPricePerTon === 'number' && typeof item.deliveredPricePerTon === 'number' && item.status === 'draft';
}
