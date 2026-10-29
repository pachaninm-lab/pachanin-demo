import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActionExecutorService } from '../../common/action-executor/action-executor.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { AuditService } from '../audit/audit.service';
import { LedgerV2Service } from '../ledger/ledger-v2.service';
import { DISPUTE_OUTCOMES, DisputeOutcomeValue } from './dto/resolve-dispute.dto';

type DisputeOutcome = DisputeOutcomeValue;

/**
 * Разбор решения арбитра до того, как что-либо сдвинется.
 *
 * Граница проверяет форму полей, а это — их связь и повторная проверка формы.
 * Вызывающий в обход границы не должен уметь провести раздел на доле, которой
 * нет, на отрицательной доле или на доле больше ста процентов: замер показал,
 * что каждый из этих входов двигал реальные деньги.
 */
function parseResolution(resolution: {
  outcome: DisputeOutcome;
  splitPct?: number;
  reason: string;
}): { outcome: DisputeOutcome; splitPct?: number } {
  const outcome = resolution?.outcome;
  if (!DISPUTE_OUTCOMES.includes(outcome as DisputeOutcomeValue)) {
    throw new BadRequestException(
      `Исход спора должен быть одним из: ${DISPUTE_OUTCOMES.join(', ')}.`,
    );
  }
  if (typeof resolution?.reason !== 'string' || resolution.reason.trim().length === 0) {
    // Основание попадает в аудит денежного решения. Объект превращался там в
    // «[object Object]», то есть запись оставалась, а причина решения терялась.
    throw new BadRequestException('Основание решения должно быть непустой строкой.');
  }

  const splitPct = resolution?.splitPct;
  if (outcome !== 'SPLIT') {
    if (splitPct !== undefined) {
      // Доля вне раздела всё равно писалась в outcomeSplitPct и противоречила
      // самой выплате: покупателю ушло сто процентов, а в записи стояла доля.
      throw new BadRequestException('Доля покупателя допустима только при исходе SPLIT.');
    }
    return { outcome };
  }

  if (splitPct === undefined) {
    // Раздел без доли — это не раздел: деньги не двигались, спор помечался
    // RESOLVED, и удержание оставалось запертым без возможности вернуться.
    throw new BadRequestException('Раздел требует указания доли покупателя.');
  }
  if (typeof splitPct !== 'number' || !Number.isInteger(splitPct)) {
    throw new BadRequestException('Доля покупателя должна быть целым числом процентов.');
  }
  if (splitPct < 0 || splitPct > 100) {
    throw new BadRequestException('Доля покупателя должна быть в пределах от 0 до 100 процентов.');
  }
  return { outcome, splitPct };
}

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
    const decision = parseResolution(resolution);

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
      if (decision.outcome === 'BUYER_WINS') {
        await this.ledger.refundFromDispute(dispute.dealId, disputeId, dispute.initiatorOrgId, holdAmount);
      } else if (decision.outcome === 'SELLER_WINS') {
        await this.ledger.release(dispute.dealId, dispute.respondentOrgId ?? '', holdAmount, 0, `dispute-resolve:${disputeId}`);
      } else if (decision.outcome === 'SPLIT') {
        // Round half up, deterministically, in integer space. The share is
        // already a whole 0..100 by here, so no truncation is applied: silently
        // rounding a money split is the defect this path was carrying.
        const buyerShare = (holdAmount * BigInt(decision.splitPct as number) + 50n) / 100n;
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
        outcome: decision.outcome,
        outcomeSplitPct: decision.splitPct ?? null,
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
      reason: `${decision.outcome}: ${resolution.reason}`,
    });

    this.logger.log(`Dispute ${disputeId} resolved: ${decision.outcome} by ${user.id}`);
    return resolved;
  }
}
