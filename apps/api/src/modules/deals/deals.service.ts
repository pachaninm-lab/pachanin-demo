import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateDealDto } from './dto/create-deal.dto';
import { evaluateStatusTransition } from '../../../../../packages/domain-core/src';

export type DealStatus =
  | 'DRAFT'
  | 'AWAITING_SIGN'
  | 'SIGNED'
  | 'PREPAYMENT_RESERVED'
  | 'LOADING'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'QUALITY_CHECK'
  | 'ACCEPTED'
  | 'FINAL_PAYMENT'
  | 'SETTLED'
  | 'CLOSED'
  | 'DISPUTE_OPEN'
  | 'EXPERTISE'
  | 'ARBITRATION_DECISION'
  | 'PARTIAL_SETTLEMENT'
  | 'CANCELLATION';

export interface Deal {
  id: string;
  lotId: string;
  status: DealStatus;
  sellerOrgId: string;
  buyerOrgId: string;
  volumeTons: number;
  pricePerTon: number;
  totalRub: number;
  currency: string;
  region: string;
  culture: string;
  paymentTerms?: Record<string, unknown>;
  createdAt: string;
  signedAt?: string;
  updatedAt?: string;
}

export interface TimelineEntry {
  status: string;
  label: string;
  timestamp: string;
  actor?: string;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  AWAITING_SIGN: 'Ожидает подписи',
  SIGNED: 'Подписан',
  PREPAYMENT_RESERVED: 'Предоплата зарезервирована',
  LOADING: 'Погрузка',
  IN_TRANSIT: 'В пути',
  ARRIVED: 'Прибыл',
  QUALITY_CHECK: 'Проверка качества',
  ACCEPTED: 'Принят',
  FINAL_PAYMENT: 'Финальный платёж',
  SETTLED: 'Расчёт завершён',
  CLOSED: 'Закрыт',
  DISPUTE_OPEN: 'Спор открыт',
  EXPERTISE: 'Экспертиза',
  ARBITRATION_DECISION: 'Решение арбитража',
  PARTIAL_SETTLEMENT: 'Частичный расчёт',
  CANCELLATION: 'Отмена',
};

const STATUS_ORDER: DealStatus[] = [
  'DRAFT',
  'AWAITING_SIGN',
  'SIGNED',
  'PREPAYMENT_RESERVED',
  'LOADING',
  'IN_TRANSIT',
  'ARRIVED',
  'QUALITY_CHECK',
  'ACCEPTED',
  'FINAL_PAYMENT',
  'SETTLED',
  'CLOSED',
];

@Injectable()
export class DealsService {
  private readonly store: Deal[] = [];

  constructor() {
    this.store.push(
      {
        id: 'DEAL-001',
        lotId: 'LOT-001',
        status: 'IN_TRANSIT',
        sellerOrgId: 'org-farmer-1',
        buyerOrgId: 'org-buyer-1',
        volumeTons: 500,
        pricePerTon: 12750,
        totalRub: 6375000,
        currency: 'RUB',
        region: 'Тамбовская область',
        culture: 'wheat',
        createdAt: '2026-03-22T10:00:00Z',
        signedAt: '2026-03-25T12:00:00Z',
      },
      {
        id: 'DEAL-002',
        lotId: 'LOT-003',
        status: 'QUALITY_CHECK',
        sellerOrgId: 'org-farmer-1',
        buyerOrgId: 'org-buyer-2',
        volumeTons: 750,
        pricePerTon: 11500,
        totalRub: 8625000,
        currency: 'RUB',
        region: 'Краснодарский край',
        culture: 'corn',
        createdAt: '2026-03-18T10:00:00Z',
        signedAt: '2026-03-20T09:00:00Z',
      },
      {
        id: 'DEAL-003',
        lotId: 'LOT-002',
        status: 'SIGNED',
        sellerOrgId: 'org-farmer-2',
        buyerOrgId: 'org-buyer-1',
        volumeTons: 300,
        pricePerTon: 11000,
        totalRub: 3300000,
        currency: 'RUB',
        region: 'Воронежская область',
        culture: 'barley',
        createdAt: '2026-04-01T10:00:00Z',
      },
    );
  }

  list(user: any): Deal[] {
    const role = user?.role;
    const orgId = user?.orgId;
    if (role === 'FARMER') {
      return this.store.filter((d) => d.sellerOrgId === orgId);
    }
    if (role === 'BUYER') {
      return this.store.filter((d) => d.buyerOrgId === orgId);
    }
    return [...this.store];
  }

  getOne(id: string, user: any): Deal {
    return this.findOrThrow(id);
  }

  workspace(id: string, user: any) {
    const deal = this.findOrThrow(id);
    const timelineEntries = this.buildTimeline(deal);
    return {
      ...deal,
      timeline: timelineEntries,
      documents: [],
      payments: [],
      nextAction: this.resolveNextAction(deal.status),
      blockers: [],
    };
  }

  passport(id: string, user: any) {
    const deal = this.findOrThrow(id);
    return {
      id: deal.id,
      status: deal.status,
      statusLabel: STATUS_LABELS[deal.status] ?? deal.status,
      parties: {
        seller: { orgId: deal.sellerOrgId },
        buyer: { orgId: deal.buyerOrgId },
      },
      metrics: {
        volumeTons: deal.volumeTons,
        pricePerTon: deal.pricePerTon,
        totalRub: deal.totalRub,
        currency: deal.currency,
      },
      dates: {
        createdAt: deal.createdAt,
        signedAt: deal.signedAt ?? null,
        updatedAt: deal.updatedAt ?? null,
      },
      lot: {
        id: deal.lotId,
        culture: deal.culture,
        region: deal.region,
      },
    };
  }

  timeline(id: string, user: any): TimelineEntry[] {
    const deal = this.findOrThrow(id);
    return this.buildTimeline(deal);
  }

  create(dto: CreateDealDto, user: any): Deal {
    const deal: Deal = {
      id: `DEAL-${Date.now()}`,
      lotId: dto.lotId,
      status: 'DRAFT',
      sellerOrgId: user?.orgId || 'demo-org',
      buyerOrgId: dto.buyerOrgId || user?.orgId || 'demo-buyer-org',
      volumeTons: 0,
      pricePerTon: 0,
      totalRub: 0,
      currency: 'RUB',
      region: '',
      culture: '',
      paymentTerms: dto.paymentTerms,
      createdAt: new Date().toISOString(),
    };
    this.store.push(deal);
    return deal;
  }

  transition(id: string, dto: { nextState: string; comment?: string }, user: any): Deal {
    const deal = this.findOrThrow(id);
    const result = evaluateStatusTransition({
      lane: 'deal',
      from: deal.status,
      to: dto.nextState,
      docsReady: true,
      evidenceReady: true,
    });
    if (!result.allowed) {
      throw new BadRequestException(
        `Переход ${deal.status} → ${dto.nextState} не разрешён: ${result.reasonCodes.join(', ')}`,
      );
    }
    deal.status = dto.nextState as DealStatus;
    deal.updatedAt = new Date().toISOString();
    if (dto.nextState === 'SIGNED' && !deal.signedAt) {
      deal.signedAt = deal.updatedAt;
    }
    return deal;
  }

  private findOrThrow(id: string): Deal {
    const deal = this.store.find((d) => d.id === id);
    if (!deal) throw new NotFoundException(`Сделка ${id} не найдена`);
    return deal;
  }

  private buildTimeline(deal: Deal): TimelineEntry[] {
    const currentIdx = STATUS_ORDER.indexOf(deal.status as DealStatus);
    const reached = currentIdx === -1 ? STATUS_ORDER : STATUS_ORDER.slice(0, currentIdx + 1);
    return reached.map((status, idx) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      timestamp: new Date(new Date(deal.createdAt).getTime() + idx * 86_400_000).toISOString(),
      actor: 'system',
    }));
  }

  private resolveNextAction(status: DealStatus): string {
    const actions: Partial<Record<DealStatus, string>> = {
      DRAFT: 'Отправить на подписание',
      AWAITING_SIGN: 'Ожидание подписи сторон',
      SIGNED: 'Зарезервировать предоплату',
      PREPAYMENT_RESERVED: 'Начать погрузку',
      LOADING: 'Подтвердить отправку',
      IN_TRANSIT: 'Подтвердить прибытие',
      ARRIVED: 'Передать на проверку качества',
      QUALITY_CHECK: 'Принять товар',
      ACCEPTED: 'Провести финальный платёж',
      FINAL_PAYMENT: 'Завершить расчёт',
      SETTLED: 'Закрыть сделку',
      CLOSED: 'Сделка закрыта',
    };
    return actions[status] ?? 'Следующий шаг по сделке';
  }
}
