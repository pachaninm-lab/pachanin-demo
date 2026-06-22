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
 * `workspace`/`passport` assemble rich runtime view-models and are still served
 * by the runtime adapter; they fail loudly here rather than returning a partial
 * shape, so there is no silent/half-built DB view.
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

  workspace(): any {
    throw new Error('PrismaDealRepository.workspace is not supported — DB-backed deal workspace path is not active.');
  }

  passport(): any {
    throw new Error('PrismaDealRepository.passport is not supported — DB-backed deal passport path is not active.');
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
