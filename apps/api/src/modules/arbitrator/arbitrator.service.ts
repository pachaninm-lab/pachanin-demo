import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestUser, Role } from '../../common/types/request-user';
import { DisputeCommandService } from '../disputes/dispute-command.service';
import { DisputeQueryService } from '../disputes/dispute-query.service';

type DisputeOutcome = 'BUYER_WINS' | 'SELLER_WINS' | 'SPLIT' | 'CANCELLED';

/**
 * Arbitrator cockpit facade.
 *
 * This class owns no persistence, ledger mutation or audit side effect. Every
 * command is delegated to the canonical PostgreSQL dispute authority.
 */
@Injectable()
export class ArbitratorService {
  constructor(
    private readonly queries: DisputeQueryService,
    private readonly commands: DisputeCommandService,
  ) {}

  private assertArbitratorRole(user: RequestUser): void {
    if (user.role !== Role.ARBITRATOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Arbitrator cockpit requires ARBITRATOR or ADMIN role');
    }
  }

  async getAssignedDisputes(user: RequestUser) {
    this.assertArbitratorRole(user);
    return this.queries.listForArbitrator(user);
  }

  async assignSelf(disputeId: string, user: RequestUser) {
    this.assertArbitratorRole(user);
    return this.commands.assignArbitrator(
      disputeId,
      `dispute-assign:${disputeId}:${user.id}`,
      user,
    );
  }

  async getDisputeCase(disputeId: string, user: RequestUser) {
    this.assertArbitratorRole(user);
    return this.queries.get(disputeId, user);
  }

  async addNote(disputeId: string, note: string, user: RequestUser) {
    this.assertArbitratorRole(user);
    return this.commands.addNote(
      disputeId,
      note,
      `dispute-note:${disputeId}:${randomUUID()}`,
      user,
    );
  }

  async resolve(
    disputeId: string,
    resolution: { outcome: DisputeOutcome; splitPct?: number; reason: string; idempotencyKey?: string },
    user: RequestUser,
  ) {
    this.assertArbitratorRole(user);
    return this.commands.resolve(disputeId, {
      outcome: resolution.outcome,
      splitBuyerPct: resolution.outcome === 'SPLIT' ? resolution.splitPct ?? 50 : null,
      reason: resolution.reason,
      idempotencyKey: resolution.idempotencyKey ?? `dispute-resolve:${disputeId}:${randomUUID()}`,
    }, user);
  }
}
