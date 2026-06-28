import { IntegrationAdapter, HealthStatus } from '../adapter.interface';

export type CreditRating = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'UNRATED';

export interface BkiCreditReport {
  inn: string;
  organizationName: string;
  creditScore: number;
  rating: CreditRating;
  openLoans: number;
  totalDebtKopecks: number;
  overdueDebtKopecks: number;
  maxCreditLimitKopecks: number;
  utilizationPct: number;
  checkedAt: string;
  bureau: 'NBKI' | 'EQUIFAX' | 'OKB';
  flags: string[];
}

export interface BkiConsentRequest {
  subjectInn: string;
  consentDocumentId: string;
  requesterId: string;
}

export class MockBkiAdapter implements IntegrationAdapter {
  readonly name = 'BKI_NBKI';
  readonly version = '3.1.0';
  readonly mode = 'mock' as const;

  private readonly riskProfiles: Record<string, { score: number; rating: CreditRating; flags: string[] }> = {
    default: { score: 720, rating: 'B+', flags: [] },
    high: { score: 550, rating: 'C', flags: ['overdue_90d', 'high_utilization'] },
    low: { score: 850, rating: 'A+', flags: [] },
  };

  async execute(request: {
    action: 'getCreditReport' | 'verifyConsent' | 'getMultipleReports';
    [key: string]: unknown;
  }): Promise<unknown> {
    switch (request.action) {
      case 'getCreditReport':
        return this.getCreditReport(request.inn as string, request.organizationName as string);
      case 'verifyConsent':
        return this.verifyConsent(request as unknown as BkiConsentRequest);
      case 'getMultipleReports':
        return Promise.all((request.inns as string[]).map(inn => this.getCreditReport(inn)));
      default:
        throw new Error(`Unknown BKI action: ${(request as { action: string }).action}`);
    }
  }

  async getCreditReport(inn: string, organizationName?: string): Promise<BkiCreditReport> {
    const seed = inn.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const profileKey = seed % 10 < 2 ? 'high' : seed % 10 > 7 ? 'low' : 'default';
    const profile = this.riskProfiles[profileKey];

    return {
      inn,
      organizationName: organizationName ?? `Организация ИНН ${inn}`,
      creditScore: profile.score + (seed % 20) - 10,
      rating: profile.rating,
      openLoans: seed % 5,
      totalDebtKopecks: (seed % 100) * 1_000_000,
      overdueDebtKopecks: profile.flags.includes('overdue_90d') ? (seed % 10) * 100_000 : 0,
      maxCreditLimitKopecks: profile.score * 10_000,
      utilizationPct: profile.flags.includes('high_utilization') ? 85 : 30 + (seed % 30),
      checkedAt: new Date().toISOString(),
      bureau: 'NBKI',
      flags: profile.flags,
    };
  }

  async verifyConsent(req: BkiConsentRequest): Promise<{ consentValid: boolean; consentDocumentId: string }> {
    return {
      consentValid: true,
      consentDocumentId: req.consentDocumentId,
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'ok', lastCheckedAt: new Date().toISOString(), detail: 'НБКИ mock adapter — sandbox mode' };
  }
}
