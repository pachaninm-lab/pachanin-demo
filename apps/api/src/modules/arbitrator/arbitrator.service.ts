import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActionExecutorService } from '../../common/action-executor/action-executor.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { AuditService } from '../audit/audit.service';
import { LedgerV2Service } from '../ledger/ledger-v2.service';

type DisputeOutcome = 'BUYER_WINS' | 'SELLER_WINS' | 'SPLIT' | 'CANCELLED';

@Injectable()
export class ArbitratorService {
  private readonly logger = new Logger(ArbitratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: ActionExecutorService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerV2Service,
  ) {}

  private assertArbitratorRole(user: RequestUser): void {
    if (user.role !== Role.ARBITRATOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Arbitrator cockpit requires ARBITRATOR or ADMIN role');
    }
  }

  async getAssignedDisputes(user: RequestUser) {
    this.assertArbitratorRole(user);
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { arbitratorId: user.id },
          { status: 'OPEN', arbitratorId: null }, // unassigned pool
        ],
      },
      include: { evidence: true, moneyHold: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignSelf(disputeId: string, user: RequestUser) {
    this.assertArbitratorRole(user);
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException(`Dispute ${disputeId} not found`);
    if (dispute.arbitratorId && dispute.arbitratorId !== user.id) {
      throw new ForbiddenException('Dispute already assigned to another arbitrator');
    }
    const before = dispute;
    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { arbitratorId: user.id, status: 'ARBITRATION', updatedAt: new Date() },
    });
    await this.audit.log({
      action: 'dispute:arbitrator_assign',
      actorUserId: user.id,
      actorRole: user.role,
      dealId: dispute.dealId,
      objectType: 'Dispute',
      objectId: disputeId,
      beforeState: before,
      afterState: updated,
      outcome: 'SUCCESS',
    });
    return updated;
  }

  async getDisputeCase(disputeId: string, user: RequestUser) {
    this.assertArbitratorRole(user);
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { evidence: true, moneyHold: true, auditEvents: { take: 20, orderBy: { createdAt: 'desc' } } },
    });
    if (!dispute) throw new NotFoundException(`Dispute ${disputeId} not found`);
    if (dispute.arbitratorId && dispute.arbitratorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Access denied to this dispute');
    }
    return dispute;
  }

  async addNote(disputeId: string, note: string, user: RequestUser) {
    this.assertArbitratorRole(user);
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException(`Dispute ${disputeId} not found`);
    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { arbitratorNotes: note, updatedAt: new Date() },
    });
    await this.audit.log({
      action: 'dispute:arbitrator_note',
      actorUserId: user.id,
      actorRole: user.role,
      objectType: 'Dispute',
      objectId: disputeId,
      outcome: 'SUCCESS',
    });
    return updated;
  }

  async resolve(
    disputeId: string,
    resolution: { outcome: DisputeOutcome; splitPct?: number; reason: string },
    user: RequestUser,
  ) {
    this.assertArbitratorRole(user);

    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { moneyHold: true },
    });
    if (!dispute) throw new NotFoundException(`Dispute ${disputeId} not found`);
    if (dispute.status === 'RESOLVED') throw new BadRequestException('Dispute already resolved');
    if (dispute.arbitratorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only the assigned arbitrator can resolve');
    }

    // Execute money resolution — integer kopecks only, bigint arithmetic
    const holdAmount = BigInt(dispute.moneyHold?.amountKopecks ?? 0);
    if (holdAmount > 0n && dispute.dealId) {
      if (resolution.outcome === 'BUYER_WINS') {
        await this.ledger.refundFromDispute(dispute.dealId, disputeId, dispute.initiatorOrgId, holdAmount);
      } else if (resolution.outcome === 'SELLER_WINS') {
        await this.ledger.release(dispute.dealId, dispute.respondentOrgId ?? '', holdAmount, 0, `dispute-resolve:${disputeId}`);
      } else if (resolution.outcome === 'SPLIT' && resolution.splitPct !== undefined) {
        // Round half up, deterministically, in integer space
        const buyerShare = (holdAmount * BigInt(Math.trunc(resolution.splitPct)) + 50n) / 100n;
        const sellerShare = holdAmount - buyerShare;
        if (buyerShare > 0n) await this.ledger.refundFromDispute(dispute.dealId, disputeId, dispute.initiatorOrgId, buyerShare);
        if (sellerShare > 0n) await this.ledger.release(dispute.dealId, dispute.respondentOrgId ?? '', sellerShare, 0, `dispute-split:${disputeId}`);
      }
    }

    const before = dispute;
    const resolved = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED',
        outcome: resolution.outcome,
        outcomeSplitPct: resolution.splitPct,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'dispute:resolved',
      actorUserId: user.id,
      actorRole: user.role,
      dealId: dispute.dealId,
      objectType: 'Dispute',
      objectId: disputeId,
      beforeState: before,
      afterState: resolved,
      outcome: 'SUCCESS',
      reason: `${resolution.outcome}: ${resolution.reason}`,
    });

    this.logger.log(`Dispute ${disputeId} resolved: ${resolution.outcome} by ${user.id}`);
    return resolved;
  }
}
