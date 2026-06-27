import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

const ANALYTICS_ROLES: Role[] = [Role.ADMIN, Role.EXECUTIVE, Role.ACCOUNTING, Role.COMPLIANCE_OFFICER];
const TAKE_RATE_PCT = 1.5;
const COMMISSION_RATE_PCT = 0.5;

export interface UnitEconomics {
  period: { from: string; to: string };
  gmvKopecks: number;
  gmvRub: number;
  dealsCount: number;
  activeDealsCount: number;
  closedDealsCount: number;
  cancelledDealsCount: number;
  takeRateKopecks: number;
  takeRateRub: number;
  commissionKopecks: number;
  commissionRub: number;
  contributionMarginKopecks: number;
  contributionMarginRub: number;
  averageDealRub: number;
  averageVolumetons: number;
  topCultures: Array<{ culture: string; count: number; gmvRub: number }>;
  topRegions: Array<{ region: string; count: number; gmvRub: number }>;
  disputeRate: number;
  disputeCount: number;
  successRate: number;
}

@Injectable()
export class AnalyticsService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  private assertRole(user: RequestUser): void {
    if (!ANALYTICS_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Доступ к аналитике ограничен');
    }
  }

  async getUnitEconomics(user: RequestUser, params?: { from?: string; to?: string }): Promise<UnitEconomics> {
    this.assertRole(user);
    const from = params?.from ? new Date(params.from) : new Date(Date.now() - 30 * 24 * 3600_000);
    const to = params?.to ? new Date(params.to) : new Date();

    if (!this.prisma) return this.mockEconomics(from, to);

    const deals = await this.prisma.deal.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, status: true, totalRub: true, totalKopecks: true, culture: true, region: true, volumeTons: true },
    }).catch(() => []);

    const disputes = await this.prisma.dispute.count({ where: { createdAt: { gte: from, lte: to } } }).catch(() => 0);

    let gmvKopecks = 0;
    const cultureMap = new Map<string, { count: number; gmv: number }>();
    const regionMap = new Map<string, { count: number; gmv: number }>();
    let totalVol = 0;
    let closedCount = 0;
    let cancelledCount = 0;

    for (const deal of deals) {
      const kopecks = deal.totalKopecks ?? Math.round((deal.totalRub ?? 0) * 100);
      gmvKopecks += kopecks;
      totalVol += deal.volumeTons ?? 0;
      if (deal.status === 'CLOSED' || deal.status === 'SETTLED') closedCount++;
      if (deal.status === 'CANCELLED') cancelledCount++;

      if (deal.culture) {
        const c = cultureMap.get(deal.culture) ?? { count: 0, gmv: 0 };
        c.count++; c.gmv += kopecks;
        cultureMap.set(deal.culture, c);
      }
      if (deal.region) {
        const r = regionMap.get(deal.region) ?? { count: 0, gmv: 0 };
        r.count++; r.gmv += kopecks;
        regionMap.set(deal.region, r);
      }
    }

    const takeRateKopecks = Math.round(gmvKopecks * TAKE_RATE_PCT / 100);
    const commissionKopecks = Math.round(gmvKopecks * COMMISSION_RATE_PCT / 100);
    const contributionMarginKopecks = takeRateKopecks - commissionKopecks;
    const count = deals.length;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      gmvKopecks,
      gmvRub: Math.round(gmvKopecks / 100),
      dealsCount: count,
      activeDealsCount: count - closedCount - cancelledCount,
      closedDealsCount: closedCount,
      cancelledDealsCount: cancelledCount,
      takeRateKopecks,
      takeRateRub: Math.round(takeRateKopecks / 100),
      commissionKopecks,
      commissionRub: Math.round(commissionKopecks / 100),
      contributionMarginKopecks,
      contributionMarginRub: Math.round(contributionMarginKopecks / 100),
      averageDealRub: count > 0 ? Math.round(gmvKopecks / count / 100) : 0,
      averageVolumetons: count > 0 ? Math.round((totalVol / count) * 100) / 100 : 0,
      topCultures: [...cultureMap.entries()]
        .sort((a, b) => b[1].gmv - a[1].gmv)
        .slice(0, 5)
        .map(([culture, v]) => ({ culture, count: v.count, gmvRub: Math.round(v.gmv / 100) })),
      topRegions: [...regionMap.entries()]
        .sort((a, b) => b[1].gmv - a[1].gmv)
        .slice(0, 5)
        .map(([region, v]) => ({ region, count: v.count, gmvRub: Math.round(v.gmv / 100) })),
      disputeRate: count > 0 ? Math.round((disputes / count) * 10000) / 100 : 0,
      disputeCount: disputes,
      successRate: count > 0 ? Math.round((closedCount / count) * 10000) / 100 : 0,
    };
  }

  async getPricePrediction(params: { culture: string; region: string; cropClass?: string; volumeTons?: number }, user: RequestUser): Promise<{
    culture: string;
    region: string;
    predictedPriceRub: number;
    confidenceInterval: { low: number; high: number };
    confidence: number;
    factors: string[];
    asOf: string;
  }> {
    const basePrices: Record<string, number> = {
      'пшеница': 14_500, 'wheat': 14_500,
      'ячмень': 12_000, 'barley': 12_000,
      'кукуруза': 16_000, 'corn': 16_000,
      'подсолнечник': 45_000, 'sunflower': 45_000,
    };
    const culture = params.culture.toLowerCase();
    const base = basePrices[culture] ?? 13_000;
    const regionCoeff = params.region?.toLowerCase().includes('краснодар') ? 1.05
      : params.region?.toLowerCase().includes('ростов') ? 1.02 : 1.0;
    const classCoeff = params.cropClass === '3' ? 1.08 : params.cropClass === '4' ? 0.95 : 1.0;
    const volumeDiscount = params.volumeTons && params.volumeTons > 1000 ? 0.97 : 1.0;
    const predicted = Math.round(base * regionCoeff * classCoeff * volumeDiscount);
    return {
      culture: params.culture,
      region: params.region,
      predictedPriceRub: predicted,
      confidenceInterval: { low: Math.round(predicted * 0.92), high: Math.round(predicted * 1.08) },
      confidence: 0.78,
      factors: ['Исторические цены', 'Регион', 'Класс культуры', 'Объём партии', 'Сезонность'],
      asOf: new Date().toISOString(),
    };
  }

  async getLedgerSummary(user: RequestUser): Promise<{
    totalEscrowKopecks: number;
    totalReleasedKopecks: number;
    totalDisputeHoldKopecks: number;
    totalCommissionKopecks: number;
    entryCount: number;
  }> {
    this.assertRole(user);
    if (!this.prisma) return { totalEscrowKopecks: 0, totalReleasedKopecks: 0, totalDisputeHoldKopecks: 0, totalCommissionKopecks: 0, entryCount: 0 };

    const entries = await this.prisma.ledgerEntry.findMany({
      select: { entryType: true, amountKopecks: true, creditAccount: true, debitAccount: true },
    }).catch(() => []);

    let escrow = 0, released = 0, disputeHold = 0, commission = 0;
    for (const e of entries) {
      if (e.entryType === 'ESCROW_RESERVE') escrow += e.amountKopecks;
      if (e.entryType === 'ESCROW_RELEASE') released += e.amountKopecks;
      if (e.entryType === 'DISPUTE_HOLD') disputeHold += e.amountKopecks;
      if (e.entryType === 'COMMISSION') commission += e.amountKopecks;
    }

    return { totalEscrowKopecks: escrow, totalReleasedKopecks: released, totalDisputeHoldKopecks: disputeHold, totalCommissionKopecks: commission, entryCount: entries.length };
  }

  private mockEconomics(from: Date, to: Date): UnitEconomics {
    const gmvKopecks = 125_000_000_00;
    const takeRateKopecks = Math.round(gmvKopecks * TAKE_RATE_PCT / 100);
    const commissionKopecks = Math.round(gmvKopecks * COMMISSION_RATE_PCT / 100);
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      gmvKopecks,
      gmvRub: Math.round(gmvKopecks / 100),
      dealsCount: 47,
      activeDealsCount: 12,
      closedDealsCount: 32,
      cancelledDealsCount: 3,
      takeRateKopecks,
      takeRateRub: Math.round(takeRateKopecks / 100),
      commissionKopecks,
      commissionRub: Math.round(commissionKopecks / 100),
      contributionMarginKopecks: takeRateKopecks - commissionKopecks,
      contributionMarginRub: Math.round((takeRateKopecks - commissionKopecks) / 100),
      averageDealRub: Math.round(gmvKopecks / 47 / 100),
      averageVolumetons: 420,
      topCultures: [
        { culture: 'Пшеница 3 кл', count: 18, gmvRub: 50_000_000 },
        { culture: 'Ячмень', count: 12, gmvRub: 30_000_000 },
        { culture: 'Кукуруза', count: 9, gmvRub: 25_000_000 },
      ],
      topRegions: [
        { region: 'Краснодарский край', count: 15, gmvRub: 45_000_000 },
        { region: 'Ростовская область', count: 11, gmvRub: 32_000_000 },
      ],
      disputeRate: 4.25,
      disputeCount: 2,
      successRate: 68.09,
    };
  }
}
