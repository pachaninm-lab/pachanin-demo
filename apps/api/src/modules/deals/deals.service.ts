import { Inject, Injectable, Optional } from '@nestjs/common';
import { CreateDealDto } from './dto/create-deal.dto';
import { DEAL_REPOSITORY, type DealRepository } from './deal.repository';
import { ActionExecutorService } from '../../common/action-executor/action-executor.service';
import { RequestUser } from '../../common/types/request-user';
import { DealEventService } from './deal-event.service';

const STATE_TO_EVENT: Record<string, string> = {
  PUBLISHED: 'PUBLISHED',
  OFFER_SENT: 'OFFER_SENT',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  COUNTER_OFFER: 'COUNTER_OFFER',
  CONTRACT_GENERATED: 'CONTRACT_GENERATED',
  CONTRACT_SIGNED: 'CONTRACT_SIGNED',
  PAYMENT_RESERVED: 'PAYMENT_RESERVED',
  LOGISTICS_ASSIGNED: 'LOGISTICS_ASSIGNED',
  SHIPMENT_STARTED: 'SHIPMENT_STARTED',
  DELIVERED: 'DELIVERED',
  QUALITY_ACCEPTED: 'QUALITY_ACCEPTED',
  QUALITY_DISPUTED: 'QUALITY_DISPUTED',
  PAYMENT_RELEASED: 'PAYMENT_RELEASED',
  DISPUTE_OPENED: 'DISPUTE_OPENED',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
};

@Injectable()
export class DealsService {
  constructor(
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    private readonly executor: ActionExecutorService,
    @Optional() private readonly dealEvents?: DealEventService,
  ) {}

  async list(user: RequestUser) {
    return this.deals.list(user);
  }

  async getOne(id: string, user: RequestUser) {
    const deal = await this.deals.getById(id);
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
    const ws = this.deals.workspace(id);
    this.executor.assertObjectScope(user, 'deal.view', {
      objectType: 'deal',
      objectId: id,
      ownerOrgId: ws.sellerOrgId,
      counterpartyOrgId: ws.buyerOrgId,
    });
    return ws;
  }

  passport(id: string, user: RequestUser) {
    return this.deals.passport(id);
  }

  timeline(id: string, user: RequestUser) {
    return this.deals.timeline(id);
  }

  async create(dto: CreateDealDto, user: RequestUser) {
    const { result } = await this.executor.execute({
      user,
      action: 'deal.create',
      scope: { objectType: 'deal', objectId: 'new', ownerOrgId: user.orgId },
      fn: () => this.deals.create(dto, user),
    });
    const dealId = (result as any)?.id;
    if (dealId && this.dealEvents) {
      this.dealEvents.emit({ dealId, eventType: 'CREATED', actorId: user.id, actorRole: user.role, payload: { culture: dto.culture } }).catch(() => {});
    }
    return result;
  }

  async transition(
    id: string,
    dto: { nextState: string; comment?: string },
    user: RequestUser,
  ) {
    const deal = await this.deals.getById(id);

    // Determine state gates based on target state
    const gates: import('../../common/action-executor/action-executor.service').StateGates = {
      dealStatus: deal.status,
    };

    // Release actions require documents + no dispute + reserve confirmed
    if (dto.nextState === 'SETTLED' || dto.nextState === 'FINAL_PAYMENT') {
      const ws = this.deals.workspace(id);
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
      fn: () => this.deals.transition(id, dto.nextState, user, dto.comment),
    });

    const eventType = STATE_TO_EVENT[dto.nextState?.toUpperCase()];
    if (eventType && this.dealEvents) {
      this.dealEvents.emit({
        dealId: id,
        eventType: eventType as any,
        actorId: user.id,
        actorRole: user.role,
        payload: { nextState: dto.nextState, comment: dto.comment },
      }).catch(() => {});
    }

    return { ...result, auditId };
  }
}
