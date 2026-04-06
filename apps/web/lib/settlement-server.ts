import { getRuntimeSnapshot } from './runtime-server';
import { serverApiUrl, serverAuthHeaders } from './server-api';

type SettlementLine = { code?: string; title?: string; line?: string; value?: number; amount?: number; tone?: string; comment?: string };

type Worksheet = {
  dealId: string;
  source?: string;
  lines: SettlementLine[];
  totals: Record<string, number>;
  economics?: Record<string, number>;
  readiness?: Record<string, boolean>;
  blockers?: string[];
  docs?: { missing?: string[]; blocked?: string[] };
  paymentPath?: string[];
  feeMeta?: Record<string, number | string>;
};

type Portfolio = {
  meta?: { source?: string; role?: string };
  totals: Record<string, number>;
  items: Array<{
    dealId: string;
    releaseCandidate: number;
    uncontestedAmount: number;
    reserveAmount: number;
    disputedAmount: number;
    platformRevenue: number;
    economics?: Record<string, number>;
    readiness?: Record<string, boolean>;
    blockers?: string[];
    paymentPath?: string[];
    docs?: { missing?: string[]; blocked?: string[] };
  }>;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function fallbackWorksheetFromSnapshot(dealId: string): Worksheet {
  return {
    dealId,
    source: 'fallback-runtime-snapshot',
    lines: [],
    totals: { releaseCandidate: 0, reserveAmount: 0, uncontestedAmount: 0, disputedAmount: 0, platformRevenue: 0 },
    blockers: ['runtime worksheet unavailable'],
    readiness: { canRelease: false, canPartialRelease: false }
  };
}

export async function getSettlementWorksheet(dealId: string): Promise<Worksheet> {
  try {
    const response = await fetch(serverApiUrl(`/settlement-runtime/deals/${dealId}`), { cache: 'no-store', headers: serverAuthHeaders() });
    if (!response.ok) throw new Error(`settlement worksheet ${response.status}`);
    return response.json();
  } catch {
    return fallbackWorksheetFromSnapshot(dealId);
  }
}

export async function getSettlementPortfolio(): Promise<Portfolio> {
  try {
    const response = await fetch(serverApiUrl('/settlement-runtime/portfolio'), { cache: 'no-store', headers: serverAuthHeaders() });
    if (!response.ok) throw new Error(`settlement portfolio ${response.status}`);
    return response.json();
  } catch {
    const snapshot = await getRuntimeSnapshot();
    const items = (snapshot as any).deals.map((deal: any) => {
      const settlementLines: any[] = deal.settlementLines || [];
      const releaseCandidate = round2(settlementLines.reduce((sum: number, line: any) => sum + Number(line.value || 0), 0) || deal.volume * 1000);
      const disputeOpen = deal.disputeOpen ?? (deal.status === 'DISPUTE_OPEN');
      const qualityDelta = deal.qualityDelta ?? 0;
      const margin = deal.margin ?? 0;
      const price = deal.price ?? 12000;
      const disputedAmount = disputeOpen ? Math.max(0, Math.abs(qualityDelta) * Math.max(1, deal.volume * 0.15)) : 0;
      const uncontestedAmount = round2(Math.max(0, releaseCandidate - disputedAmount));
      const platformRevenue = Math.max(0, Math.abs(margin) * 0.12);
      const documentsStatus = deal.documentsStatus ?? 'GREEN';
      const moneyStatus = deal.moneyStatus ?? '';
      const labStatus = deal.labStatus ?? deal.status ?? '';
      const logisticsStatus = deal.logisticsStatus ?? '';
      return {
        dealId: deal.id,
        releaseCandidate,
        uncontestedAmount,
        reserveAmount: Math.max(0, releaseCandidate * 0.05),
        disputedAmount,
        platformRevenue,
        economics: {
          gmv: round2(price * deal.volume),
          logisticsAmount: Math.max(0, Math.abs(margin) * 0.45),
          idleAmount: logisticsStatus.includes('ALERT') ? 12000 : 0,
          qualityDelta,
          platformFeeAmount: platformRevenue,
          netAfterCharges: releaseCandidate
        },
        readiness: {
          docsReady: documentsStatus === 'GREEN',
          bankReady: !moneyStatus.includes('PENDING'),
          labReady: !labStatus.includes('PENDING'),
          hasOpenDispute: disputeOpen,
          canPartialRelease: documentsStatus === 'GREEN',
          canRelease: documentsStatus === 'GREEN' && !disputeOpen && !moneyStatus.includes('PENDING')
        },
        blockers: [...((deal.blockers || deal.blocker ? [deal.blocker].filter(Boolean) : []) as string[]).slice(0, 4)],
        paymentPath: ['reserve', disputeOpen ? 'partial_release' : 'final_release'],
        docs: { missing: documentsStatus === 'GREEN' ? [] : ['contract / TTN / weigh ticket'], blocked: [] }
      };
    });
    const totals = items.reduce((acc, item) => {
      acc.deals += 1;
      acc.gmv += item.economics?.gmv || 0;
      acc.reserveAmount += item.reserveAmount || 0;
      acc.releaseCandidate += item.releaseCandidate || 0;
      acc.uncontestedAmount += item.uncontestedAmount || 0;
      acc.disputedAmount += item.disputedAmount || 0;
      acc.platformRevenue += item.platformRevenue || 0;
      acc.operationalDeductions += (item.economics?.logisticsAmount || 0) + (item.economics?.idleAmount || 0);
      if (item.readiness?.canRelease) acc.readyDeals += 1;
      if (item.readiness?.canPartialRelease && !item.readiness?.canRelease) acc.partialReleaseDeals += 1;
      if (item.blockers?.length) acc.blockedDeals += 1;
      return acc;
    }, { deals: 0, gmv: 0, reserveAmount: 0, releaseCandidate: 0, uncontestedAmount: 0, disputedAmount: 0, platformRevenue: 0, operationalDeductions: 0, readyDeals: 0, partialReleaseDeals: 0, blockedDeals: 0 });
    return { meta: { source: 'fallback-runtime-snapshot' }, totals, items };
  }
}
