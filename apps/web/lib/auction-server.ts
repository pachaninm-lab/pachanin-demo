import { serverApiUrl, serverAuthHeaders } from './server-api';

export type AccessibleAuctionLot = {
  id: string;
  title: string;
  culture: string;
  grade: string | null;
  volumeTons: number;
  startPriceRubPerTon: number;
  stepPriceRubPerTon: number;
  region: string;
  address: string | null;
  status: string;
  auctionEndsAt: string;
  updatedAt: string | null;
};

export type CanonicalAuctionWorkspace = {
  lotId: string;
  title: string;
  lotStatus: string;
  originMode: {
    id: string;
    title: string;
    description: string;
    nextStep: string | null;
  };
  readiness: {
    score: number;
    band: string;
    blockers: string[];
    readyForLive: boolean;
    bestBid: number | null;
    nextAction: string;
  };
  timer: {
    auctionEndsAt: string | null;
    minutesToEnd: number;
    shouldAutoExtend: boolean;
    autoExtendMinutes: number;
  };
  bestBid: null | {
    id: string;
    amount: number;
    buyerName: string;
    buyerOrgId: string | null;
    status: string | null;
  };
  bidCount: number;
  executionBridge: {
    dealCreated: boolean;
    dealId: string | null;
    nextRequiredMilestones: string[];
  };
};

type ReadResult<T> = {
  source: string;
  available: boolean;
  data: T | null;
  error: string | null;
};

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return requiredString(value) ?? undefined;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.map(requiredString);
  return normalized.every((item): item is string => Boolean(item)) ? normalized : null;
}

function parseAccessibleLot(value: unknown): AccessibleAuctionLot | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = requiredString(row.id);
  const title = requiredString(row.title);
  const culture = requiredString(row.culture);
  const grade = optionalString(row.grade);
  const volumeTons = finiteNumber(row.volumeTons);
  const startPriceRubPerTon = finiteNumber(row.startPrice);
  const stepPriceRubPerTon = finiteNumber(row.stepPrice);
  const region = requiredString(row.region);
  const address = optionalString(row.address);
  const status = requiredString(row.status);
  const auctionEndsAt = requiredString(row.auctionEndsAt);
  const updatedAt = optionalString(row.updatedAt);

  if (
    !id || !title || !culture || grade === undefined || volumeTons === null
    || startPriceRubPerTon === null || stepPriceRubPerTon === null || !region
    || address === undefined || !status || !auctionEndsAt || updatedAt === undefined
  ) return null;

  return {
    id,
    title,
    culture,
    grade,
    volumeTons,
    startPriceRubPerTon,
    stepPriceRubPerTon,
    region,
    address,
    status,
    auctionEndsAt,
    updatedAt,
  };
}

function parseAuctionWorkspace(value: unknown): CanonicalAuctionWorkspace | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const origin = row.originMode as Record<string, unknown> | null;
  const readiness = row.readiness as Record<string, unknown> | null;
  const timer = row.timer as Record<string, unknown> | null;
  const bridge = row.executionBridge as Record<string, unknown> | null;
  const rawBestBid = row.bestBid;

  if (!origin || !readiness || !timer || !bridge) return null;

  const lotId = requiredString(row.lotId);
  const title = requiredString(row.title);
  const lotStatus = requiredString(row.lotStatus);
  const originId = requiredString(origin.id);
  const originTitle = requiredString(origin.title);
  const originDescription = requiredString(origin.description);
  const originNextStep = optionalString(origin.nextStep);
  const score = finiteNumber(readiness.score);
  const band = requiredString(readiness.band);
  const blockers = stringArray(readiness.blockers);
  const readyForLive = typeof readiness.readyForLive === 'boolean' ? readiness.readyForLive : null;
  const readinessBestBid = readiness.bestBid === null ? null : finiteNumber(readiness.bestBid);
  const nextAction = requiredString(readiness.nextAction);
  const auctionEndsAt = optionalString(timer.auctionEndsAt);
  const minutesToEnd = finiteNumber(timer.minutesToEnd);
  const shouldAutoExtend = typeof timer.shouldAutoExtend === 'boolean' ? timer.shouldAutoExtend : null;
  const autoExtendMinutes = finiteNumber(timer.autoExtendMinutes);
  const bidCount = finiteNumber(row.bidCount);
  const dealCreated = typeof bridge.dealCreated === 'boolean' ? bridge.dealCreated : null;
  const dealId = optionalString(bridge.dealId);
  const nextRequiredMilestones = stringArray(bridge.nextRequiredMilestones);

  if (
    !lotId || !title || !lotStatus || !originId || !originTitle || !originDescription
    || originNextStep === undefined || score === null || !band || blockers === null
    || readyForLive === null || (readiness.bestBid !== null && readinessBestBid === null)
    || !nextAction || auctionEndsAt === undefined || minutesToEnd === null
    || shouldAutoExtend === null || autoExtendMinutes === null || bidCount === null
    || dealCreated === null || dealId === undefined || nextRequiredMilestones === null
    || !Number.isInteger(bidCount) || bidCount < 0
  ) return null;

  let bestBid: CanonicalAuctionWorkspace['bestBid'] = null;
  if (rawBestBid !== null && rawBestBid !== undefined) {
    if (typeof rawBestBid !== 'object') return null;
    const bid = rawBestBid as Record<string, unknown>;
    const id = requiredString(bid.id);
    const amount = finiteNumber(bid.amount);
    const buyerName = requiredString(bid.buyerName);
    const buyerOrgId = optionalString(bid.buyerOrgId);
    const status = optionalString(bid.status);
    if (!id || amount === null || !buyerName || buyerOrgId === undefined || status === undefined) return null;
    bestBid = { id, amount, buyerName, buyerOrgId, status };
  }

  if (dealCreated && !dealId) return null;

  return {
    lotId,
    title,
    lotStatus,
    originMode: { id: originId, title: originTitle, description: originDescription, nextStep: originNextStep },
    readiness: { score, band, blockers, readyForLive, bestBid: readinessBestBid, nextAction },
    timer: { auctionEndsAt, minutesToEnd, shouldAutoExtend, autoExtendMinutes },
    bestBid,
    bidCount,
    executionBridge: { dealCreated, dealId, nextRequiredMilestones },
  };
}

export async function getAccessibleAuctionLotsCanonical(): Promise<ReadResult<AccessibleAuctionLot[]>> {
  try {
    const response = await fetch(serverApiUrl('/lots/my'), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!response.ok) throw new Error(`auction lots ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('auction lots invalid envelope');
    const items = payload.map(parseAccessibleLot);
    if (items.some((item) => item === null)) throw new Error('auction lots invalid item');
    return {
      source: 'canonical.lots.my',
      available: true,
      data: items as AccessibleAuctionLot[],
      error: null,
    };
  } catch (error) {
    return {
      source: 'unavailable.lots.my',
      available: false,
      data: null,
      error: error instanceof Error ? error.message : 'auction lots unavailable',
    };
  }
}

export async function getAuctionWorkspaceCanonical(lotId: string): Promise<ReadResult<CanonicalAuctionWorkspace>> {
  try {
    const safeLotId = encodeURIComponent(lotId);
    const response = await fetch(serverApiUrl(`/auctions/lots/${safeLotId}/workspace`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!response.ok) throw new Error(`auction workspace ${response.status}`);
    const parsed = parseAuctionWorkspace(await response.json());
    if (!parsed) throw new Error('auction workspace invalid envelope');
    return { source: 'canonical.auctions.workspace', available: true, data: parsed, error: null };
  } catch (error) {
    return {
      source: 'unavailable.auctions.workspace',
      available: false,
      data: null,
      error: error instanceof Error ? error.message : 'auction workspace unavailable',
    };
  }
}

export async function getTradingOriginModesCanonical() {
  try {
    const response = await fetch(serverApiUrl('/auctions/origin-modes'), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!response.ok) throw new Error(`origin modes ${response.status}`);
    const data: unknown = await response.json();
    return {
      source: 'canonical.auctions.origin-modes',
      available: true,
      items: Array.isArray(data) ? data : [],
      error: null as string | null,
    };
  } catch (error) {
    return {
      source: 'unavailable.auctions.origin-modes',
      available: false,
      items: [] as unknown[],
      error: error instanceof Error ? error.message : 'origin modes unavailable',
    };
  }
}
