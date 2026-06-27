import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ReputationScore {
  orgId: string;
  score: number;
  tier: 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D' | 'UNRATED';
  components: {
    dealHistory: number;
    disputeRate: number;
    paymentPunctuality: number;
    kycStatus: number;
    amlStatus: number;
    age: number;
  };
  dealsCompleted: number;
  dealsTotal: number;
  disputeCount: number;
  averageDealRub: number;
  lastUpdated: string;
  recommendation: string;
}

@Injectable()
export class BusinessReputationService {
  private readonly logger = new Logger(BusinessReputationService.name);
  private readonly scoreCache = new Map<string, { score: ReputationScore; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async getScore(orgId: string): Promise<ReputationScore> {
    const cached = this.scoreCache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) return cached.score;

    const score = await this.computeScore(orgId);
    this.scoreCache.set(orgId, { score, expiresAt: Date.now() + BusinessReputationService.CACHE_TTL_MS });
    return score;
  }

  async getScoreBatch(orgIds: string[]): Promise<Record<string, ReputationScore>> {
    const results: Record<string, ReputationScore> = {};
    await Promise.all(orgIds.map(async (id) => { results[id] = await this.getScore(id); }));
    return results;
  }

  invalidate(orgId: string): void {
    this.scoreCache.delete(orgId);
  }

  private async computeScore(orgId: string): Promise<ReputationScore> {
    let dealsTotal = 0;
    let dealsCompleted = 0;
    let disputeCount = 0;
    let totalRub = 0;
    let kycOk = false;
    let amlClear = false;
    let orgAgeMonths = 0;

    if (this.prisma) {
      try {
        const [sellerDeals, buyerDeals, org] = await Promise.all([
          this.prisma.deal.findMany({ where: { sellerOrgId: orgId }, select: { status: true, totalRub: true } }),
          this.prisma.deal.findMany({ where: { buyerOrgId: orgId }, select: { status: true, totalRub: true } }),
          this.prisma.organization.findUnique({ where: { id: orgId }, select: { kycStatus: true, amlStatus: true, createdAt: true } }).catch(() => null),
        ]);
        const disputes = await this.prisma.dispute.count({ where: { OR: [{ dealId: { in: [...sellerDeals, ...buyerDeals].map((d: any) => d.id ?? '') } }] } }).catch(() => 0);

        const allDeals = [...sellerDeals, ...buyerDeals];
        dealsTotal = allDeals.length;
        dealsCompleted = allDeals.filter((d: any) => d.status === 'CLOSED' || d.status === 'SETTLED').length;
        disputeCount = disputes;
        totalRub = allDeals.reduce((s: number, d: any) => s + (d.totalRub ?? 0), 0);
        kycOk = org?.kycStatus === 'VERIFIED';
        amlClear = org?.amlStatus === 'CLEAR';
        orgAgeMonths = org ? Math.floor((Date.now() - new Date(org.createdAt).getTime()) / (30 * 86_400_000)) : 0;
      } catch (err) {
        this.logger.debug(`Score compute DB error for ${orgId}: ${(err as Error).message}`);
      }
    } else {
      dealsTotal = 12;
      dealsCompleted = 10;
      disputeCount = 1;
      totalRub = 5_000_000;
      kycOk = true;
      amlClear = true;
      orgAgeMonths = 24;
    }

    const disputeRate = dealsTotal > 0 ? disputeCount / dealsTotal : 0;
    const successRate = dealsTotal > 0 ? dealsCompleted / dealsTotal : 0;

    const dealHistoryScore = Math.min(100, dealsCompleted * 5 + (dealsTotal > 5 ? 20 : 0));
    const disputeScore = Math.max(0, 100 - disputeRate * 300);
    const paymentScore = successRate * 100;
    const kycScore = kycOk ? 100 : 30;
    const amlScore = amlClear ? 100 : 0;
    const ageScore = Math.min(100, orgAgeMonths * 4);

    const totalScore = Math.round(
      dealHistoryScore * 0.25 +
      disputeScore * 0.25 +
      paymentScore * 0.20 +
      kycScore * 0.15 +
      amlScore * 0.10 +
      ageScore * 0.05,
    );

    const tier = this.scoreTier(totalScore);

    return {
      orgId,
      score: totalScore,
      tier,
      components: {
        dealHistory: Math.round(dealHistoryScore),
        disputeRate: Math.round(disputeScore),
        paymentPunctuality: Math.round(paymentScore),
        kycStatus: kycScore,
        amlStatus: amlScore,
        age: Math.round(ageScore),
      },
      dealsCompleted,
      dealsTotal,
      disputeCount,
      averageDealRub: dealsTotal > 0 ? Math.round(totalRub / dealsTotal) : 0,
      lastUpdated: new Date().toISOString(),
      recommendation: this.scoreRecommendation(tier),
    };
  }

  private scoreTier(score: number): ReputationScore['tier'] {
    if (score >= 90) return 'AAA';
    if (score >= 80) return 'AA';
    if (score >= 70) return 'A';
    if (score >= 55) return 'B';
    if (score >= 35) return 'C';
    if (score > 0) return 'D';
    return 'UNRATED';
  }

  private scoreRecommendation(tier: ReputationScore['tier']): string {
    const map: Record<string, string> = {
      AAA: 'Надёжный контрагент. Рекомендуется без ограничений.',
      AA: 'Высокая надёжность. Сделки до 50 млн ₽ без дополнительных проверок.',
      A: 'Хорошая репутация. Стандартные условия сделки.',
      B: 'Приемлемая репутация. Рекомендуется усиленная проверка документов.',
      C: 'Повышенный риск. Требуется дополнительный KYC и поручительство.',
      D: 'Высокий риск. Сделки не рекомендуются без залога.',
      UNRATED: 'Нет данных для оценки. Пройдите верификацию.',
    };
    return map[tier] ?? '';
  }
}
