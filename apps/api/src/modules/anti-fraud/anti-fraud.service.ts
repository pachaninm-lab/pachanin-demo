import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface FraudCheckResult {
  flagged: boolean;
  score: number;
  reasons: string[];
  entityId: string;
  entityType: string;
  checkedAt: string;
}

export interface DealContext {
  dealId?: string;
  sellerOrgId?: string;
  buyerOrgId?: string;
  volumeTons?: number;
  totalRub?: number;
  pricePerTon?: number;
  culture?: string;
  actorId?: string;
  actorRole?: string;
  previousStatus?: string;
  newStatus?: string;
}

const PRICE_THRESHOLDS: Record<string, { min: number; max: number }> = {
  wheat: { min: 8_000, max: 35_000 },
  barley: { min: 7_000, max: 30_000 },
  corn: { min: 9_000, max: 40_000 },
  sunflower: { min: 25_000, max: 80_000 },
  default: { min: 5_000, max: 100_000 },
};

const VOLUME_MAX_TONS = 50_000;
const RAPID_TRANSITIONS_WINDOW_MS = 5 * 60 * 1000;
const RAPID_TRANSITIONS_THRESHOLD = 5;

@Injectable()
export class AntiFraudService {
  private readonly logger = new Logger(AntiFraudService.name);
  private readonly recentTransitions = new Map<string, number[]>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  check(entityId: string, context: DealContext & Record<string, unknown>): FraudCheckResult {
    const reasons: string[] = [];
    let score = 0;

    score += this.checkPriceAnomaly(context, reasons);
    score += this.checkVolumeAnomaly(context, reasons);
    score += this.checkSelfDeal(context, reasons);
    score += this.checkRoleAbuse(context, reasons);
    score += this.checkRapidTransitions(entityId, context, reasons);
    score += this.checkDocumentMismatch(context, reasons);

    const flagged = score >= 50;
    if (flagged) {
      this.logger.warn(`Anti-fraud FLAGGED entity=${entityId} score=${score} reasons=${reasons.join('; ')}`);
      this.persistFlag(entityId, context, score, reasons).catch(() => {});
    }

    return {
      flagged,
      score,
      reasons,
      entityId,
      entityType: (context.dealId ? 'deal' : 'unknown'),
      checkedAt: new Date().toISOString(),
    };
  }

  private checkPriceAnomaly(ctx: DealContext, reasons: string[]): number {
    if (!ctx.pricePerTon && ctx.totalRub && ctx.volumeTons && ctx.volumeTons > 0) {
      ctx.pricePerTon = ctx.totalRub / ctx.volumeTons;
    }
    if (!ctx.pricePerTon || !ctx.culture) return 0;
    const crop = ctx.culture.toLowerCase();
    const thresholds = PRICE_THRESHOLDS[crop] ?? PRICE_THRESHOLDS.default;
    if (ctx.pricePerTon < thresholds.min) {
      reasons.push(`Цена ${ctx.pricePerTon} ₽/т ниже минимальной ${thresholds.min} ₽/т для ${ctx.culture}`);
      return 40;
    }
    if (ctx.pricePerTon > thresholds.max) {
      reasons.push(`Цена ${ctx.pricePerTon} ₽/т выше максимальной ${thresholds.max} ₽/т для ${ctx.culture}`);
      return 30;
    }
    return 0;
  }

  private checkVolumeAnomaly(ctx: DealContext, reasons: string[]): number {
    if (!ctx.volumeTons) return 0;
    if (ctx.volumeTons > VOLUME_MAX_TONS) {
      reasons.push(`Объём ${ctx.volumeTons} т превышает допустимый максимум ${VOLUME_MAX_TONS} т`);
      return 35;
    }
    if (ctx.volumeTons <= 0) {
      reasons.push('Объём сделки не может быть нулевым или отрицательным');
      return 80;
    }
    return 0;
  }

  private checkSelfDeal(ctx: DealContext, reasons: string[]): number {
    if (ctx.sellerOrgId && ctx.buyerOrgId && ctx.sellerOrgId === ctx.buyerOrgId) {
      reasons.push('Продавец и покупатель — одна организация (self-deal)');
      return 90;
    }
    return 0;
  }

  private checkRoleAbuse(ctx: DealContext, reasons: string[]): number {
    if (!ctx.actorRole || !ctx.newStatus) return 0;
    const role = ctx.actorRole.toUpperCase();
    const next = ctx.newStatus.toUpperCase();
    const abusiveTransitions: Record<string, string[]> = {
      DRIVER: ['SETTLED', 'FINAL_PAYMENT', 'PAYMENT_RELEASED', 'CONTRACT_SIGNED'],
      LAB: ['SETTLED', 'FINAL_PAYMENT', 'PAYMENT_RELEASED'],
      ELEVATOR: ['PAYMENT_RELEASED', 'CONTRACT_SIGNED'],
      LOGISTICIAN: ['PAYMENT_RELEASED', 'SETTLED'],
    };
    if (abusiveTransitions[role]?.includes(next)) {
      reasons.push(`Роль ${role} не может инициировать переход в состояние ${next}`);
      return 70;
    }
    return 0;
  }

  private checkRapidTransitions(entityId: string, ctx: DealContext, reasons: string[]): number {
    if (!ctx.newStatus) return 0;
    const now = Date.now();
    const times = this.recentTransitions.get(entityId) ?? [];
    const recent = times.filter((t) => now - t < RAPID_TRANSITIONS_WINDOW_MS);
    recent.push(now);
    this.recentTransitions.set(entityId, recent);
    if (recent.length >= RAPID_TRANSITIONS_THRESHOLD) {
      reasons.push(`${recent.length} переходов состояния за последние 5 минут — подозрительная активность`);
      return 45;
    }
    return 0;
  }

  private checkDocumentMismatch(ctx: DealContext, reasons: string[]): number {
    const prev = ctx.previousStatus?.toUpperCase();
    const next = ctx.newStatus?.toUpperCase();
    if (next === 'CONTRACT_SIGNED' && prev !== 'CONTRACT_GENERATED') {
      reasons.push(`Переход в CONTRACT_SIGNED без предшествующего CONTRACT_GENERATED (было: ${prev})`);
      return 60;
    }
    if (next === 'PAYMENT_RELEASED' && prev !== 'QUALITY_ACCEPTED' && prev !== 'DELIVERED') {
      reasons.push(`Попытка освободить оплату до принятия качества (было: ${prev})`);
      return 55;
    }
    return 0;
  }

  async checkOffPlatformSettlement(params: {
    dealId: string;
    buyerOrgId: string;
    sellerOrgId: string;
    indicator: 'external_payment_mentioned' | 'deal_cancelled_after_delivery' | 'reputation_drop_post_cancel' | 'counterparty_comment_flag';
    evidence?: string;
    actorId?: string;
  }): Promise<FraudCheckResult> {
    const reasons: string[] = [];
    let score = 0;

    switch (params.indicator) {
      case 'external_payment_mentioned':
        score = 85;
        reasons.push('Упоминание внеплатформенного расчёта в сообщениях/комментариях к сделке');
        break;
      case 'deal_cancelled_after_delivery':
        score = 75;
        reasons.push('Сделка отменена после факта доставки — признак внеплатформенного расчёта');
        break;
      case 'reputation_drop_post_cancel':
        score = 40;
        reasons.push('Резкое снижение активности после отмены серии сделок — возможный обход платформы');
        break;
      case 'counterparty_comment_flag':
        score = 55;
        reasons.push(`Контрагент сообщил о попытке обхода платформы: ${params.evidence ?? 'без деталей'}`);
        break;
    }

    const flagged = score >= 50;
    if (flagged) {
      await this.persistFlag(params.dealId, {
        dealId: params.dealId,
        sellerOrgId: params.sellerOrgId,
        buyerOrgId: params.buyerOrgId,
        actorId: params.actorId,
        actorRole: 'SYSTEM',
      }, score, reasons);
    }

    return {
      flagged,
      score,
      reasons,
      entityId: params.dealId,
      entityType: 'off_platform_bypass',
      checkedAt: new Date().toISOString(),
    };
  }

  private async persistFlag(entityId: string, ctx: DealContext, score: number, reasons: string[]): Promise<void> {
    if (!this.prisma) return;
    await this.prisma.auditEvent.create({
      data: {
        id: `af-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'ANTI_FRAUD_FLAG',
        actorUserId: ctx.actorId ?? 'system',
        actorRole: ctx.actorRole ?? 'SYSTEM',
        dealId: ctx.dealId,
        entityType: 'anti_fraud',
        entityId,
        outcome: 'FLAGGED',
        reason: JSON.stringify({ score, reasons }),
        hash: '',
      },
    }).catch(() => {});
  }
}
