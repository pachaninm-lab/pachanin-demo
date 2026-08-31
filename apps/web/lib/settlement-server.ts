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

function unavailableWorksheet(dealId: string): Worksheet {
  return {
    dealId,
    source: 'unavailable',
    lines: [],
    totals: { releaseCandidate: 0, reserveAmount: 0, uncontestedAmount: 0, disputedAmount: 0, platformRevenue: 0 },
    blockers: ['settlement service unavailable'],
    readiness: { canRelease: false, canPartialRelease: false }
  };
}

export async function getSettlementWorksheet(dealId: string): Promise<Worksheet> {
  try {
    const response = await fetch(serverApiUrl(`/settlement-runtime/deals/${dealId}`), { cache: 'no-store', headers: await serverAuthHeaders() });
    if (!response.ok) throw new Error(`settlement worksheet ${response.status}`);
    return response.json();
  } catch {
    return unavailableWorksheet(dealId);
  }
}

export async function getSettlementPortfolio(): Promise<Portfolio> {
  try {
    const response = await fetch(serverApiUrl('/settlement-runtime/portfolio'), { cache: 'no-store', headers: await serverAuthHeaders() });
    if (!response.ok) throw new Error(`settlement portfolio ${response.status}`);
    return response.json();
  } catch {
    return {
      meta: { source: 'unavailable' },
      totals: {
        deals: 0,
        gmv: 0,
        reserveAmount: 0,
        releaseCandidate: 0,
        uncontestedAmount: 0,
        disputedAmount: 0,
        platformRevenue: 0,
        operationalDeductions: 0,
        readyDeals: 0,
        partialReleaseDeals: 0,
        blockedDeals: 0,
      },
      items: [],
    };
  }
}
