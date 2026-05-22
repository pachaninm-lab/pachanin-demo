import { Injectable, Optional } from '@nestjs/common';
import { CreateDealDto } from './dto/create-deal.dto';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { ActionExecutorService } from '../../common/action-executor/action-executor.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../../common/types/request-user';

@Injectable()
export class DealsService {
  constructor(
    private readonly runtime: RuntimeCoreService,
    private readonly executor: ActionExecutorService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async list(user: RequestUser) {
    if (this.prisma) {
      try {
        const rows = await this.prisma.deal.findMany({ orderBy: { createdAt: 'desc' } });
        if (rows.length > 0) return rows;
      } catch {
        // fall through to in-memory
      }
    }
    return this.runtime.listDeals(user);
  }

  async getOne(id: string, user: RequestUser) {
    let deal: any;
    if (this.prisma) {
      try {
        const row = await this.prisma.deal.findUnique({ where: { id } });
        if (row) deal = row;
      } catch {
        // fall through
      }
    }
    if (!deal) deal = this.runtime.getDeal(id);
    this.executor.assertObjectScope(user, 'deal.view', {
      objectType: 'deal',
      objectId: id,
      ownerOrgId: deal.sellerOrgId,
      counterpartyOrgId: deal.buyerOrgId,
    });
    return deal;
  }

  workspace(id: string, user: RequestUser) {
    this.executor.assertPermission(user, 'deal.view');
    const ws = this.runtime.dealWorkspace(id);
    this.executor.assertObjectScope(user, 'deal.view', {
      objectType: 'deal',
      objectId: id,
      ownerOrgId: ws.sellerOrgId,
      counterpartyOrgId: ws.buyerOrgId,
    });
    return ws;
  }

  passport(id: string, user: RequestUser) {
    return this.runtime.dealPassport(id);
  }

  timeline(id: string, user: RequestUser) {
    return this.runtime.dealTimeline(id);
  }

  async create(dto: CreateDealDto, user: RequestUser) {
    const { result } = await this.executor.execute({
      user,
      action: 'deal.create',
      scope: { objectType: 'deal', objectId: 'new', ownerOrgId: user.orgId },
      fn: () => this.runtime.createDeal(dto, user),
    });
    return result;
  }

  async transition(
    id: string,
    dto: { nextState: string; comment?: string },
    user: RequestUser,
  ) {
    const deal = this.runtime.getDeal(id);

    // Determine state gates based on target state
    const gates: import('../../common/action-executor/action-executor.service').StateGates = {
      dealStatus: deal.status,
    };

    // Release actions require documents + no dispute + reserve confirmed
    if (dto.nextState === 'SETTLED' || dto.nextState === 'FINAL_PAYMENT') {
      const ws = this.runtime.dealWorkspace(id);
      gates.documentsComplete = ws.completeness?.isComplete ?? false;
      gates.disputeOpen = deal.status === 'DISPUTE_OPEN';
      gates.reserveConfirmed =
        ws.payment?.status !== 'PENDING' && ws.payment?.status !== 'RESERVE_PENDING';
    }

    const { result, auditId } = await this.executor.execute({
      user,
      action: 'deal.transition',
      scope: {
        objectType: 'deal',
        objectId: id,
        ownerOrgId: deal.sellerOrgId,
        counterpartyOrgId: deal.buyerOrgId,
      },
      gates,
      fn: () => this.runtime.transitionDeal(id, dto.nextState, user, dto.comment),
    });

    return { ...result, auditId };
  }
}
