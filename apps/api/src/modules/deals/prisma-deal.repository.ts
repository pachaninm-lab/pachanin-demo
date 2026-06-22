import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { DealRepository } from './deal.repository';
import type { CreateDealDto } from './dto/create-deal.dto';
import type { RequestUser } from '../../common/types/request-user';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RuntimeStateMachine } from '../runtime-core/runtime-state-machine';

/**
 * DB-backed deal repository (SQLite/Postgres via Prisma).
 *
 * Selected only under the explicit PLATFORM_V7_DEAL_REPOSITORY=prisma flag.
 * Reads (list/get) and the lifecycle write path (create/transition) are
 * implemented against the database and persist real rows. The transition graph
 * is the same single source of truth as the runtime adapter
 * (`RuntimeStateMachine`), so legality is identical across adapters.
 *
 * `workspace`/`passport` assemble a real aggregate from the persisted entities
 * (deal + documents + shipments + samples + payment + audit timeline) with
 * derived money/completeness/blocker summaries — no fixtures, no partial stub.
 */
@Injectable()
export class PrismaDealRepository implements DealRepository {
  private readonly stateMachine = new RuntimeStateMachine();

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error(
        'PrismaDealRepository requires PrismaService, but it is not available. ' +
          'DB-backed deal path is not active.',
      );
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaDealRepository: PrismaService unavailable — DB-backed deal path not active.');
    }
    return this.prisma;
  }

  async list(): Promise<unknown[]> {
    return this.db.deal.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getById(id: string): Promise<any> {
    const row = await this.db.deal.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Deal ${id} not found.`);
    }
    return row;
  }

  async workspace(id: string): Promise<any> {
    const deal = await this.db.deal.findUnique({ where: { id } });
    if (!deal) {
      throw new NotFoundException(`Deal ${id} not found.`);
    }
    const [documents, shipments, samples, payments, events] = await Promise.all([
      this.db.dealDocument.findMany({ where: { dealId: id }, orderBy: { uploadedAt: 'desc' } }),
      this.db.shipment.findMany({ where: { dealId: id }, orderBy: { createdAt: 'desc' } }),
      this.db.labSample.findMany({ where: { dealId: id }, include: { tests: true }, orderBy: { createdAt: 'desc' } }),
      this.db.payment.findMany({ where: { dealId: id }, orderBy: { createdAt: 'desc' } }),
      this.db.auditEvent.findMany({ where: { dealId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    const payment = payments[0] ?? null;

    const blockers: string[] = [];
    for (const doc of documents) {
      if (doc.bankRequired && doc.bankAcceptance !== 'ACCEPTED') {
        blockers.push(`Документ ${doc.type} не принят банком`);
      }
    }

    const completeness = {
      total: documents.length,
      signed: documents.filter((d) => d.signedAt != null).length,
      bankRequired: documents.filter((d) => d.bankRequired).length,
      bankAccepted: documents.filter((d) => d.bankRequired && d.bankAcceptance === 'ACCEPTED').length,
      // Document side is complete when every bank-required document is accepted.
      isComplete: documents.length > 0 && documents.every((d) => !d.bankRequired || d.bankAcceptance === 'ACCEPTED'),
    };
    for (const ship of shipments) {
      for (const reason of parseJsonArray(ship.blockers)) {
        blockers.push(`Рейс ${ship.id}: ${reason}`);
      }
    }
    if (payment && payment.status !== 'RELEASED' && (payment.holdAmountRub ?? 0) > 0) {
      blockers.push(`Удержание ${payment.holdAmountRub} ₽ до закрытия условий`);
    }

    const moneyImpact = {
      amountRub: payment?.amountRub ?? deal.totalRub ?? null,
      status: payment?.status ?? 'NONE',
      reservedAt: payment?.reservedAt ?? null,
      releasedAt: payment?.releasedAt ?? null,
      holdAmountRub: payment?.holdAmountRub ?? 0,
      callbackState: payment?.callbackState ?? 'NONE',
    };

    return {
      ...deal,
      documents,
      shipments,
      samples,
      payment,
      moneyImpact,
      completeness,
      blockers,
      owner: deal.owner,
      nextAction: deal.nextAction,
      slaAt: deal.slaAt,
      timeline: { dealId: id, events },
      source: 'db',
    };
  }

  async passport(id: string): Promise<any> {
    const deal = await this.db.deal.findUnique({ where: { id } });
    if (!deal) {
      throw new NotFoundException(`Deal ${id} not found.`);
    }
    const [documentCount, shipmentCount, payment] = await Promise.all([
      this.db.dealDocument.count({ where: { dealId: id } }),
      this.db.shipment.count({ where: { dealId: id } }),
      this.db.payment.findFirst({ where: { dealId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      id: deal.id,
      lotId: deal.lotId,
      status: deal.status,
      parties: { sellerOrgId: deal.sellerOrgId, buyerOrgId: deal.buyerOrgId },
      culture: deal.culture,
      region: deal.region,
      volumeTons: deal.volumeTons,
      pricePerTon: deal.pricePerTon,
      totalRub: deal.totalRub,
      currency: deal.currency,
      owner: deal.owner,
      nextAction: deal.nextAction,
      signedAt: deal.signedAt,
      closedAt: deal.closedAt,
      createdAt: deal.createdAt,
      counts: { documents: documentCount, shipments: shipmentCount },
      payment: payment
        ? { status: payment.status, amountRub: payment.amountRub, holdAmountRub: payment.holdAmountRub ?? 0 }
        : null,
      source: 'db',
    };
  }

  async timeline(id: string): Promise<any> {
    const events = await this.db.auditEvent.findMany({
      where: { dealId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { dealId: id, events };
  }

  async create(dto: CreateDealDto, user: RequestUser): Promise<any> {
    const id = await this.nextDealId();
    const now = new Date();
    const paymentTerms = (dto.paymentTerms ?? {}) as Record<string, unknown>;
    return this.db.deal.create({
      data: {
        id,
        lotId: dto.lotId,
        status: 'DRAFT',
        sellerOrgId: user?.orgId || 'demo-org',
        buyerOrgId: dto.buyerOrgId || 'demo-buyer-org',
        currency: 'RUB',
        fundingChoice: (paymentTerms.fundingChoice as string) ?? 'OWN_FUNDS',
        owner: 'Коммерция',
        nextAction: 'Заполнить параметры сделки',
        slaAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        meta: JSON.stringify({ ...paymentTerms, winnerBidId: dto.winnerBidId }),
      },
    });
  }

  async transition(id: string, nextState: string, _user: RequestUser, _comment?: string): Promise<any> {
    const deal = await this.db.deal.findUnique({ where: { id } });
    if (!deal) {
      throw new NotFoundException(`Deal ${id} not found.`);
    }
    this.stateMachine.assertDealTransition(deal.status, nextState);

    const now = new Date();
    return this.db.deal.update({
      where: { id },
      data: {
        status: nextState,
        ...(nextState === 'SIGNED' && !deal.signedAt ? { signedAt: now } : {}),
        ...(nextState === 'CLOSED' && !deal.closedAt ? { closedAt: now } : {}),
      },
    });
  }

  /** Next sequential `DEAL-NNN` id, derived from the max existing suffix. */
  private async nextDealId(): Promise<string> {
    const rows = await this.db.deal.findMany({
      where: { id: { startsWith: 'DEAL-' } },
      select: { id: true },
    });
    const maxNum = rows.reduce((max, row) => {
      const n = Number.parseInt(row.id.slice('DEAL-'.length), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    return `DEAL-${String(maxNum + 1).padStart(3, '0')}`;
  }
}

/** Parse a stored JSON-array string (e.g. shipment blockers) defensively. */
function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}
