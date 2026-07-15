import { serverApiUrl, serverAuthHeaders } from './server-api';

export type AuctionAuthorityProof = {
  source: 'POSTGRESQL';
  scope: 'AUCTION';
  tenantId: string;
  actorId: string;
  observedAt: string;
  version: number;
};

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

export type AuctionReadResult<T> = {
  source: string;
  available: boolean;
  authority: AuctionAuthorityProof | null;
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

function validIsoDate(value: string | null): boolean {
  return value === null || Number.isFinite(Date.parse(value));
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.map(requiredString);
  return normalized.every((item): item is string => Boolean(item)) ? normalized : null;
}

function parseAuthorityProof(value: unknown): AuctionAuthorityProof | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const source = requiredString(row.source)?.toUpperCase();
  const scope = requiredString(row.scope)?.toUpperCase();
  const tenantId = requiredString(row.tenantId);
  const actorId = requiredString(row.actorId);
  const observedAt = requiredString(row.observedAt);
  const version = finiteNumber(row.version);

  if (
    source !== 'POSTGRESQL' || scope !== 'AUCTION' || !tenantId || !actorId || !observedAt
    || !validIsoDate(observedAt) || version === null || !Number.isInteger(version) || version < 1
  ) return null;

  return { source: 'POSTGRESQL', scope: 'AUCTION', tenantId, actorId, observedAt, version };
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
    !id || !title || !culture || grade === undefined || volumeTons === null || volumeTons <= 0
    || startPriceRubPerTon === null || startPriceRubPerTon < 0
    || stepPriceRubPerTon === null || stepPriceRubPerTon <= 0 || !region
    || address === undefined || !status || !auctionEndsAt || !validIsoDate(auctionEndsAt)
    || updatedAt === undefined || !validIsoDate(updatedAt)
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
    || originNextStep === undefined || score === null || !Number.isInteger(score) || score < 0 || score > 100
    || !band || blockers === null || readyForLive === null
    || (readiness.bestBid !== null && (readinessBestBid === null || readinessBestBid < 0))
    || !nextAction || auctionEndsAt === undefined || !validIsoDate(auctionEndsAt)
    || minutesToEnd === null || shouldAutoExtend === null || autoExtendMinutes === null
    || !Number.isInteger(autoExtendMinutes) || autoExtendMinutes < 0
    || bidCount === null || !Number.isInteger(bidCount) || bidCount < 0
    || dealCreated === null || dealId === undefined || nextRequiredMilestones === null
    || (readyForLive && blockers.length > 0)
    || dealCreated !== Boolean(dealId)
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
    if (!id || amount === null || amount < 0 || !buyerName || buyerOrgId === undefined || status === undefined) return null;
    bestBid = { id, amount, buyerName, buyerOrgId, status };
  }

  if ((bidCount === 0) !== (bestBid === null)) return null;
  if (bestBid && readinessBestBid !== null && bestBid.amount !== readinessBestBid) return null;

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

function unavailable<T>(source: string, error: unknown): AuctionReadResult<T> {
  return {
    source,
    available: false,
    authority: null,
    data: null,
    error: error instanceof Error ? error.message : String(error || 'auction authority unavailable'),
  };
}

export async function getAccessibleAuctionLotsCanonical(): Promise<AuctionReadResult<AccessibleAuctionLot[]>> {
  try {
    const response = await fetch(serverApiUrl('/lots/my'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!response.ok) throw new Error(`auction lots ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') throw new Error('auction lots invalid envelope');
    const envelope = payload as Record<string, unknown>;
    const authority = parseAuthorityProof(envelope.authority);
    if (!authority) throw new Error('auction lots missing PostgreSQL authority proof');
    if (!Array.isArray(envelope.items)) throw new Error('auction lots invalid items');
    const items = envelope.items.map(parseAccessibleLot);
    if (items.some((item) => item === null)) throw new Error('auction lots invalid item');
    return {
      source: 'postgresql.auction.lots',
      available: true,
      authority,
      data: items as AccessibleAuctionLot[],
      error: null,
    };
  } catch (error) {
    return unavailable('unavailable.auction.lots', error);
  }
}

export async function getAuctionWorkspaceCanonical(lotId: string): Promise<AuctionReadResult<CanonicalAuctionWorkspace>> {
  try {
    const safeLotId = encodeURIComponent(lotId);
    const response = await fetch(serverApiUrl(`/auctions/lots/${safeLotId}/workspace`), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!response.ok) throw new Error(`auction workspace ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') throw new Error('auction workspace invalid envelope');
    const envelope = payload as Record<string, unknown>;
    const authority = parseAuthorityProof(envelope.authority);
    if (!authority) throw new Error('auction workspace missing PostgreSQL authority proof');
    const workspace = parseAuctionWorkspace(envelope.workspace);
    if (!workspace) throw new Error('auction workspace invalid payload');
    return { source: 'postgresql.auction.workspace', available: true, authority, data: workspace, error: null };
  } catch (error) {
    return unavailable('unavailable.auction.workspace', error);
  }
}

export async function getTradingOriginModesCanonical(): Promise<AuctionReadResult<unknown[]>> {
  try {
    const response = await fetch(serverApiUrl('/auctions/origin-modes'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!response.ok) throw new Error(`origin modes ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') throw new Error('origin modes invalid envelope');
    const envelope = payload as Record<string, unknown>;
    const authority = parseAuthorityProof(envelope.authority);
    if (!authority) throw new Error('origin modes missing PostgreSQL authority proof');
    if (!Array.isArray(envelope.items)) throw new Error('origin modes invalid items');
    return { source: 'postgresql.auction.origin-modes', available: true, authority, data: envelope.items, error: null };
  } catch (error) {
    return unavailable('unavailable.auction.origin-modes', error);
  }
}
