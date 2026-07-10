import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DecideDisputeDto } from './dto/decide-dispute.dto';

export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'EXPERTISE'
  | 'DECISION'
  | 'PARTIAL_OUTCOME'
  | 'RESOLVED'
  | 'CLOSED';

export type DisputeOutcome =
  | 'BUYER_WIN'
  | 'SELLER_WIN'
  | 'SPLIT'
  | 'NO_CLAIM'
  | 'CANCELLED';

export interface DisputeEvidence {
  id: string;
  type: 'photo' | 'document' | 'gps' | 'weight' | 'lab' | 'statement';
  url?: string;
  description?: string;
  source: string;
  uploadedAt: string;
  uploadedBy?: string;
  trusted: boolean;
}

export interface MoneyHold {
  amountRub: number;
  amountKopecks: number;
  reason: string;
  heldAt: string;
  releasedAt?: string;
  releaseReason?: string;
}

export interface Dispute {
  id: string;
  dealId: string;
  shipmentId?: string;
  status: DisputeStatus;
  type: string;
  claimAmountRub?: number;
  claimAmountKopecks?: number;
  description: string;
  initiatorOrgId: string;
  respondentOrgId?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  evidence: DisputeEvidence[];
  owner?: string;
  slaMinutes?: number;
  outcome?: DisputeOutcome;
  decisionNote?: string;
  moneyHold?: MoneyHold;
  bankBasisDocumentId?: string;
  slaDeadline?: string;
}

export interface MoneyInstruction {
  action: 'REFUND_BUYER_PENDING' | 'RETURN_TO_ESCROW' | 'SPLIT_PENDING' | 'NO_MONEY_ACTION';
  amountRub: number;
  amountKopecks: number;
  sellerShareRub?: number;
  sellerShareKopecks?: number;
  buyerRefundRub?: number;
  buyerRefundKopecks?: number;
  note?: string;
  bankBasisDocumentId?: string;
  bankCallbackRequired: boolean;
}

type DisputeCommandHooks = Readonly<{
  failAfterLedger?: boolean;
  failAfterFirstResolutionEntry?: boolean;
}>;

type NotesEnvelope = {
  openCommandId?: string;
  openIdempotencyKey?: string;
  resolutionCommandId?: string;
  resolutionIdempotencyKey?: string;
  decisionNote?: string;
  notes?: Array<{ actorId: string; note: string; at: string }>;
};

const INITIATE_ROLES = new Set<Role>([
  Role.BUYER,
  Role.FARMER,
  Role.LAB,
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
]);
const TRIAGE_ROLES = new Set<Role>([Role.SUPPORT_MANAGER, Role.ADMIN]);
const RESOLUTION_ROLES = new Set<Role>([Role.ARBITRATOR, Role.ADMIN]);
const TRUSTED_EVIDENCE_ROLES = new Set<Role>([
  Role.LAB,
  Role.SURVEYOR,
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
]);
const TERMINAL_STATUSES = new Set<DisputeStatus>(['RESOLVED', 'CLOSED']);

@Injectable()
export class DisputesService {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<Dispute[]> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.dispute.findMany({
        include: { evidence: true, moneyHold: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      });
      return rows.map(mapDispute);
    });
  }

  async getAssignedDisputes(user: RequestUser): Promise<Dispute[]> {
    this.assertArbitrator(user);
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.dispute.findMany({
        where: user.role === Role.ADMIN ? undefined : { arbitratorId: user.id },
        include: { evidence: true, moneyHold: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      });
      return rows.map(mapDispute);
    });
  }

  async getOne(id: string, user: RequestUser): Promise<Dispute> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const row = await tx.dispute.findUnique({
        where: { id: requiredId(id, 'disputeId') },
        include: { evidence: true, moneyHold: true },
      });
      if (!row) throw new NotFoundException('Dispute is not available in the authenticated scope.');
      return mapDispute(row);
    });
  }

  async create(
    dto: CreateDisputeDto,
    user: RequestUser,
    hooks: DisputeCommandHooks = {},
  ): Promise<Dispute> {
    if (!INITIATE_ROLES.has(user.role)) {
      throw new ForbiddenException(`Role ${user.role} cannot create disputes.`);
    }
    if (dto.claimAmountRub !== undefined) {
      throw new BadRequestException({
        code: 'KOPECKS_REQUIRED',
        message: 'Use claimAmountKopecks as an integer amount.',
      });
    }
    const dealId = requiredId(dto.dealId, 'dealId');
    const amountKopecks = dto.claimAmountKopecks ?? 0;
    if (!Number.isSafeInteger(amountKopecks) || amountKopecks < 0) {
      throw new BadRequestException({ code: 'INVALID_CLAIM_AMOUNT_KOPECKS' });
    }
    const disputeId = deterministicId('dispute', dealId, dto.idempotencyKey);

    return this.executeSerializable(user, async (tx, context) => {
      const existing = await tx.dispute.findUnique({
        where: { id: disputeId },
        include: { evidence: true, moneyHold: true },
      });
      if (existing) {
        const notes = parseNotes(existing.arbitratorNotes);
        if (
          notes.openIdempotencyKey !== dto.idempotencyKey
          || notes.openCommandId !== dto.commandId
          || existing.dealId !== dealId
        ) {
          throw new ConflictException('Dispute idempotency key is already bound to another command.');
        }
        return mapDispute(existing);
      }

      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        select: {
          id: true,
          tenantId: true,
          buyerOrgId: true,
          sellerOrgId: true,
          status: true,
        },
      });
      if (!deal || deal.tenantId !== context.tenantId) {
        throw new NotFoundException('Deal is not available in the authenticated scope.');
      }
      if (['CANCELLED', 'CLOSED'].includes(deal.status)) {
        throw new ConflictException(`Dispute cannot be opened for deal status ${deal.status}.`);
      }

      const respondentOrgId = context.orgId === deal.buyerOrgId
        ? deal.sellerOrgId
        : deal.buyerOrgId;
      if (amountKopecks > 0) {
        const available = await escrowBalance(tx, dealId);
        if (amountKopecks > available) {
          throw new ConflictException({
            code: 'INSUFFICIENT_CONFIRMED_ESCROW',
            availableKopecks: available,
            requestedKopecks: amountKopecks,
          });
        }
      }

      const now = new Date();
      const slaMinutes = amountKopecks > 50_000_000 ? 60 : 240;
      await tx.dispute.create({
        data: {
          id: disputeId,
          dealId,
          shipmentId: dto.shipmentId,
          type: dto.reason.trim(),
          status: 'OPEN',
          description: (dto.detail || dto.reason).trim(),
          initiatorOrgId: context.orgId,
          respondentOrgId,
          claimAmountKopecks: amountKopecks || null,
          claimAmountRub: amountKopecks ? amountKopecks / 100 : null,
          severity: amountKopecks > 50_000_000 ? 'HIGH' : 'MEDIUM',
          slaMinutes,
          arbitratorNotes: JSON.stringify({
            openCommandId: dto.commandId,
            openIdempotencyKey: dto.idempotencyKey,
            notes: [],
          } satisfies NotesEnvelope),
        },
      });

      if (amountKopecks > 0) {
        await tx.disputeMoneyHold.create({
          data: {
            id: `hold:${disputeId}`,
            disputeId,
            amountKopecks,
            amountRub: amountKopecks / 100,
            reason: `Dispute hold: ${dto.reason.trim()}`,
            heldAt: now,
          },
        });
        await tx.ledgerEntry.create({
          data: {
            id: `ledger:${disputeId}:hold`,
            dealId,
            entryType: 'DISPUTE_HOLD',
            debitAccount: `escrow:${dealId}`,
            creditAccount: `dispute:${disputeId}`,
            amountKopecks,
            reference: disputeId,
            idempotencyKey: `dispute-hold:${disputeId}`,
            description: 'Confirmed escrow moved into dispute hold.',
            createdByUserId: context.userId,
          },
        });
      }
      if (hooks.failAfterLedger) this.assertTestHook('failAfterLedger');

      await appendAudit(tx, {
        dealId,
        disputeId,
        actorUserId: context.userId,
        actorRole: context.role,
        tenantId: context.tenantId,
        orgId: context.orgId,
        action: 'dispute.open',
        objectId: disputeId,
        afterState: {
          status: 'OPEN',
          claimAmountKopecks: amountKopecks,
          respondentOrgId,
        },
        correlationId: dto.commandId,
        idempotencyKey: dto.idempotencyKey,
      });
      await tx.outboxEntry.create({
        data: {
          id: `outbox:${disputeId}:opened`,
          type: 'dispute.opened',
          dealId,
          status: 'PENDING',
          idempotencyKey: `dispute-opened:${disputeId}`,
          correlationId: dto.commandId,
          payload: {
            disputeId,
            dealId,
            claimAmountKopecks: amountKopecks,
            initiatorOrgId: context.orgId,
            respondentOrgId,
          },
        },
      });

      const created = await tx.dispute.findUnique({
        where: { id: disputeId },
        include: { evidence: true, moneyHold: true },
      });
      if (!created) throw new ConflictException('Created dispute disappeared inside the transaction.');
      return mapDispute(created);
    });
  }

  async triage(id: string, user: RequestUser): Promise<Dispute> {
    if (!TRIAGE_ROLES.has(user.role)) {
      throw new ForbiddenException('Only support or admin can triage disputes.');
    }
    const disputeId = requiredId(id, 'disputeId');
    return this.executeSerializable(user, async (tx, context) => {
      const locked = await lockDispute(tx, disputeId);
      if (!locked) throw new NotFoundException('Dispute is not available in the authenticated scope.');
      if (locked.status !== 'OPEN') {
        throw new ConflictException(`Dispute ${disputeId} has status ${locked.status}, expected OPEN.`);
      }
      const notes = appendNote(parseNotes(locked.arbitratorNotes), context.userId, 'Triage completed.');
      await tx.dispute.update({
        where: { id: disputeId },
        data: { status: 'UNDER_REVIEW', arbitratorNotes: JSON.stringify(notes) },
      });
      return this.load(tx, disputeId);
    });
  }

  async assignSelf(id: string, user: RequestUser): Promise<Dispute> {
    this.assertArbitrator(user);
    const disputeId = requiredId(id, 'disputeId');
    return this.executeSerializable(user, async (tx, context) => {
      const locked = await lockDispute(tx, disputeId);
      if (!locked) throw new NotFoundException('Dispute is not available in the authenticated scope.');
      if (TERMINAL_STATUSES.has(locked.status as DisputeStatus)) {
        throw new ConflictException('Resolved dispute cannot be assigned.');
      }
      if (locked.arbitratorId && locked.arbitratorId !== context.userId && user.role !== Role.ADMIN) {
        throw new ConflictException('Dispute is already assigned to another arbitrator.');
      }
      if (locked.arbitratorId === context.userId) return this.load(tx, disputeId);
      const notes = appendNote(parseNotes(locked.arbitratorNotes), context.userId, 'Arbitrator assigned.');
      const result = await tx.dispute.updateMany({
        where: {
          id: disputeId,
          arbitratorId: null,
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
        data: {
          arbitratorId: context.userId,
          status: 'UNDER_REVIEW',
          arbitratorNotes: JSON.stringify(notes),
        },
      });
      if (result.count !== 1) {
        throw new ConflictException('Arbitrator assignment lost a concurrency race.');
      }
      return this.load(tx, disputeId);
    });
  }

  async addNote(id: string, note: string, user: RequestUser): Promise<Dispute> {
    this.assertArbitrator(user);
    const normalized = String(note ?? '').trim();
    if (!normalized || normalized.length > 4_000) {
      throw new BadRequestException('Arbitrator note must contain 1–4000 characters.');
    }
    const disputeId = requiredId(id, 'disputeId');
    return this.executeSerializable(user, async (tx, context) => {
      const locked = await lockDispute(tx, disputeId);
      if (!locked) throw new NotFoundException('Dispute is not available in the authenticated scope.');
      this.assertAssignedArbitrator(locked.arbitratorId, user);
      const notes = appendNote(parseNotes(locked.arbitratorNotes), context.userId, normalized);
      await tx.dispute.update({
        where: { id: disputeId },
        data: { arbitratorNotes: JSON.stringify(notes) },
      });
      return this.load(tx, disputeId);
    });
  }

  async addEvidence(
    id: string,
    evidence: Omit<DisputeEvidence, 'id' | 'uploadedAt'>,
    user: RequestUser,
  ): Promise<Dispute> {
    const disputeId = requiredId(id, 'disputeId');
    return this.executeSerializable(user, async (tx, context) => {
      const locked = await lockDispute(tx, disputeId);
      if (!locked) throw new NotFoundException('Dispute is not available in the authenticated scope.');
      if (TERMINAL_STATUSES.has(locked.status as DisputeStatus)) {
        throw new ConflictException('Cannot add evidence to a resolved dispute.');
      }
      await tx.disputeEvidence.create({
        data: {
          id: `evidence:${randomUUID()}`,
          disputeId,
          type: String(evidence.type),
          description: String(evidence.description || evidence.source || 'Evidence').slice(0, 4_000),
          trusted: TRUSTED_EVIDENCE_ROLES.has(user.role),
          submittedBy: context.userId,
        },
      });
      return this.load(tx, disputeId);
    });
  }

  async decision(
    id: string,
    dto: DecideDisputeDto,
    user: RequestUser,
    hooks: DisputeCommandHooks = {},
  ): Promise<Dispute & { moneyInstruction: MoneyInstruction }> {
    return this.resolve(id, dto, user, hooks);
  }

  async resolve(
    id: string,
    dto: DecideDisputeDto,
    user: RequestUser,
    hooks: DisputeCommandHooks = {},
  ): Promise<Dispute & { moneyInstruction: MoneyInstruction }> {
    this.assertArbitrator(user);
    const disputeId = requiredId(id, 'disputeId');
    const outcome = normalizeOutcome(dto.outcome);
    const splitPct = outcome === 'SPLIT' ? dto.splitPct : undefined;
    if (outcome === 'SPLIT' && (!Number.isInteger(splitPct) || splitPct! < 0 || splitPct! > 100)) {
      throw new BadRequestException('SPLIT requires integer splitPct between 0 and 100.');
    }
    if (outcome !== 'SPLIT' && dto.splitPct !== undefined) {
      throw new BadRequestException('splitPct is allowed only for SPLIT outcome.');
    }

    return this.executeSerializable(user, async (tx, context) => {
      const locked = await lockDispute(tx, disputeId);
      if (!locked) throw new NotFoundException('Dispute is not available in the authenticated scope.');
      const notes = parseNotes(locked.arbitratorNotes);
      if (locked.status === 'RESOLVED') {
        if (
          notes.resolutionIdempotencyKey === dto.idempotencyKey
          && notes.resolutionCommandId === dto.commandId
        ) {
          const replay = await this.load(tx, disputeId);
          return { ...replay, moneyInstruction: buildInstruction(replay, dto.note) };
        }
        throw new ConflictException('Dispute is already resolved by another command.');
      }
      if (locked.status === 'CLOSED') throw new ConflictException('Closed dispute cannot be resolved.');
      this.assertAssignedArbitrator(locked.arbitratorId, user);

      const hold = await lockHold(tx, disputeId);
      const holdAmount = hold?.amountKopecks ?? 0;
      if (hold?.releasedAt) throw new ConflictException('Dispute hold is already released.');
      const buyerShare = buyerShareKopecks(holdAmount, outcome, splitPct);
      const sellerShare = holdAmount - buyerShare;
      const deal = await tx.deal.findUnique({
        where: { id: locked.dealId },
        select: { id: true, buyerOrgId: true, sellerOrgId: true },
      });
      if (!deal) throw new ConflictException('Dispute deal is unavailable.');

      if (sellerShare > 0) {
        await tx.ledgerEntry.create({
          data: {
            id: `ledger:${disputeId}:seller`,
            dealId: locked.dealId,
            entryType: 'DISPUTE_RETURN_TO_ESCROW',
            debitAccount: `dispute:${disputeId}`,
            creditAccount: `escrow:${locked.dealId}`,
            amountKopecks: sellerShare,
            reference: disputeId,
            idempotencyKey: `dispute-resolution:${disputeId}:seller`,
            description: 'Arbitration decision returned seller share to escrow.',
            createdByUserId: context.userId,
          },
        });
      }
      if (hooks.failAfterFirstResolutionEntry) this.assertTestHook('failAfterFirstResolutionEntry');
      if (buyerShare > 0) {
        await tx.ledgerEntry.create({
          data: {
            id: `ledger:${disputeId}:buyer`,
            dealId: locked.dealId,
            entryType: 'DISPUTE_REFUND_PENDING',
            debitAccount: `dispute:${disputeId}`,
            creditAccount: `refund_pending:${locked.dealId}:${deal.buyerOrgId}`,
            amountKopecks: buyerShare,
            reference: disputeId,
            idempotencyKey: `dispute-resolution:${disputeId}:buyer`,
            description: 'Arbitration decision created a bank-confirmation-dependent buyer refund.',
            createdByUserId: context.userId,
          },
        });
      }
      if (sellerShare + buyerShare !== holdAmount) {
        throw new ConflictException('Resolution entries do not conserve held kopecks.');
      }

      const resolvedAt = new Date();
      const updatedNotes: NotesEnvelope = {
        ...notes,
        resolutionCommandId: dto.commandId,
        resolutionIdempotencyKey: dto.idempotencyKey,
        decisionNote: dto.note,
      };
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'RESOLVED',
          outcome,
          outcomeSplitPct: splitPct,
          resolvedAt,
          arbitratorNotes: JSON.stringify(updatedNotes),
        },
      });
      if (hold) {
        await tx.disputeMoneyHold.update({
          where: { disputeId },
          data: {
            releasedAt: resolvedAt,
            releaseReason: `${outcome}:${dto.commandId}`,
          },
        });
      }

      await appendAudit(tx, {
        dealId: locked.dealId,
        disputeId,
        actorUserId: context.userId,
        actorRole: context.role,
        tenantId: context.tenantId,
        orgId: context.orgId,
        action: 'dispute.resolve',
        objectId: disputeId,
        afterState: {
          status: 'RESOLVED',
          outcome,
          holdAmountKopecks: holdAmount,
          sellerShareKopecks: sellerShare,
          buyerRefundKopecks: buyerShare,
        },
        correlationId: dto.commandId,
        idempotencyKey: dto.idempotencyKey,
      });
      await tx.outboxEntry.create({
        data: {
          id: `outbox:${disputeId}:resolved`,
          type: buyerShare > 0 ? 'bank.dispute_refund.requested' : 'dispute.resolved',
          dealId: locked.dealId,
          status: 'PENDING',
          idempotencyKey: `dispute-resolved:${disputeId}`,
          correlationId: dto.commandId,
          payload: {
            disputeId,
            dealId: locked.dealId,
            outcome,
            buyerRefundKopecks: buyerShare,
            sellerShareKopecks: sellerShare,
            bankCallbackRequired: buyerShare > 0,
            buyerOrgId: deal.buyerOrgId,
          },
        },
      });

      const resolved = await this.load(tx, disputeId);
      return { ...resolved, moneyInstruction: buildInstruction(resolved, dto.note) };
    });
  }

  private async load(tx: Prisma.TransactionClient, disputeId: string): Promise<Dispute> {
    const row = await tx.dispute.findUnique({
      where: { id: disputeId },
      include: { evidence: true, moneyHold: true },
    });
    if (!row) throw new NotFoundException('Dispute is not available in the authenticated scope.');
    return mapDispute(row);
  }

  private assertArbitrator(user: RequestUser): void {
    if (!RESOLUTION_ROLES.has(user.role)) {
      throw new ForbiddenException('Only an assigned arbitrator or admin can perform this action.');
    }
  }

  private assertAssignedArbitrator(arbitratorId: string | null, user: RequestUser): void {
    if (user.role === Role.ADMIN) return;
    if (!arbitratorId || arbitratorId !== user.id) {
      throw new ForbiddenException('Dispute is not assigned to the authenticated arbitrator.');
    }
  }

  private assertTestHook(name: string): never {
    if (String(process.env.NODE_ENV).toLowerCase() !== 'test') {
      throw new Error('Test failure hooks are forbidden outside test mode.');
    }
    throw new Error(`forced-dispute-rollback:${name}`);
  }

  private async executeSerializable<T>(
    user: RequestUser,
    work: (tx: Prisma.TransactionClient, context: {
      userId: string;
      orgId: string;
      tenantId: string;
      role: string;
      sessionId: string;
    }) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.rls.withTrustedContext(user, work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20_000,
      });
    } catch (error) {
      if (isSerializationFailure(error)) {
        throw new ConflictException('Dispute command lost a serializable concurrency race.');
      }
      throw error;
    }
  }
}

async function escrowBalance(tx: Prisma.TransactionClient, dealId: string): Promise<number> {
  const escrow = `escrow:${dealId}`;
  const [credits, debits] = await Promise.all([
    tx.ledgerEntry.aggregate({
      where: { dealId, creditAccount: escrow },
      _sum: { amountKopecks: true },
    }),
    tx.ledgerEntry.aggregate({
      where: { dealId, debitAccount: escrow },
      _sum: { amountKopecks: true },
    }),
  ]);
  return (credits._sum.amountKopecks ?? 0) - (debits._sum.amountKopecks ?? 0);
}

async function lockDispute(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{
    id: string;
    dealId: string;
    status: string;
    arbitratorId: string | null;
    arbitratorNotes: string | null;
  }>>(Prisma.sql`
    SELECT id, "dealId", status, "arbitratorId", "arbitratorNotes"
    FROM public.disputes
    WHERE id = ${id}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

async function lockHold(tx: Prisma.TransactionClient, disputeId: string) {
  const rows = await tx.$queryRaw<Array<{
    disputeId: string;
    amountKopecks: number | null;
    releasedAt: Date | null;
  }>>(Prisma.sql`
    SELECT "disputeId", "amountKopecks", "releasedAt"
    FROM public.dispute_money_holds
    WHERE "disputeId" = ${disputeId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

async function appendAudit(
  tx: Prisma.TransactionClient,
  input: {
    dealId: string;
    disputeId: string;
    actorUserId: string;
    actorRole: string;
    tenantId: string;
    orgId: string;
    action: string;
    objectId: string;
    afterState: Prisma.InputJsonObject;
    correlationId: string;
    idempotencyKey: string;
  },
): Promise<void> {
  const previous = await tx.auditEvent.findFirst({
    where: { dealId: input.dealId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { hash: true },
  });
  const id = `audit:${randomUUID()}`;
  const hash = sha256Json({ id, ...input, prevHash: previous?.hash ?? null });
  await tx.auditEvent.create({
    data: {
      id,
      action: input.action,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      tenantId: input.tenantId,
      orgId: input.orgId,
      dealId: input.dealId,
      disputeId: input.disputeId,
      objectType: 'dispute',
      objectId: input.objectId,
      afterState: input.afterState,
      outcome: 'SUCCESS',
      correlationId: input.correlationId,
      metadata: { idempotencyKey: input.idempotencyKey },
      hash,
      prevHash: previous?.hash,
    },
  });
}

function mapDispute(row: any): Dispute {
  const claimAmountKopecks = row.claimAmountKopecks ?? (
    typeof row.claimAmountRub === 'number' ? Math.round(row.claimAmountRub * 100) : undefined
  );
  const notes = parseNotes(row.arbitratorNotes);
  const slaMinutes = row.slaMinutes ?? undefined;
  return {
    id: row.id,
    dealId: row.dealId,
    shipmentId: row.shipmentId ?? undefined,
    status: row.status as DisputeStatus,
    type: row.type,
    claimAmountRub: claimAmountKopecks === undefined ? undefined : claimAmountKopecks / 100,
    claimAmountKopecks,
    description: row.description,
    initiatorOrgId: row.initiatorOrgId,
    respondentOrgId: row.respondentOrgId ?? undefined,
    severity: row.severity,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
    evidence: (row.evidence ?? []).map((item: any) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      source: item.submittedBy,
      uploadedAt: item.submittedAt.toISOString(),
      uploadedBy: item.submittedBy,
      trusted: item.trusted,
    })),
    owner: row.arbitratorId ?? undefined,
    slaMinutes,
    slaDeadline: slaMinutes
      ? new Date(row.createdAt.getTime() + slaMinutes * 60_000).toISOString()
      : undefined,
    outcome: row.outcome as DisputeOutcome | undefined,
    decisionNote: notes.decisionNote,
    moneyHold: row.moneyHold
      ? {
          amountRub: (row.moneyHold.amountKopecks ?? Math.round((row.moneyHold.amountRub ?? 0) * 100)) / 100,
          amountKopecks: row.moneyHold.amountKopecks ?? Math.round((row.moneyHold.amountRub ?? 0) * 100),
          reason: row.moneyHold.reason,
          heldAt: row.moneyHold.heldAt.toISOString(),
          releasedAt: row.moneyHold.releasedAt?.toISOString(),
          releaseReason: row.moneyHold.releaseReason ?? undefined,
        }
      : undefined,
    bankBasisDocumentId: `BANK-BASIS-${row.id}`,
  };
}

function buildInstruction(dispute: Dispute, note?: string): MoneyInstruction {
  const amount = dispute.moneyHold?.amountKopecks ?? dispute.claimAmountKopecks ?? 0;
  const buyer = buyerShareKopecks(amount, dispute.outcome ?? 'NO_CLAIM', undefinedIfNotSplit(dispute));
  const seller = amount - buyer;
  const action = buyer > 0 && seller > 0
    ? 'SPLIT_PENDING'
    : buyer > 0
      ? 'REFUND_BUYER_PENDING'
      : seller > 0
        ? 'RETURN_TO_ESCROW'
        : 'NO_MONEY_ACTION';
  return {
    action,
    amountRub: amount / 100,
    amountKopecks: amount,
    sellerShareRub: seller / 100,
    sellerShareKopecks: seller,
    buyerRefundRub: buyer / 100,
    buyerRefundKopecks: buyer,
    note: note ?? dispute.decisionNote,
    bankBasisDocumentId: dispute.bankBasisDocumentId,
    bankCallbackRequired: buyer > 0,
  };
}

function undefinedIfNotSplit(dispute: Dispute): number | undefined {
  if (dispute.outcome !== 'SPLIT') return undefined;
  const notes = parseNotes((dispute as any).arbitratorNotes);
  return (dispute as any).outcomeSplitPct ?? notes.resolutionIdempotencyKey ? undefined : undefined;
}

function buyerShareKopecks(
  amount: number,
  outcome: DisputeOutcome,
  splitPct?: number,
): number {
  if (outcome === 'BUYER_WIN' || outcome === 'CANCELLED') return amount;
  if (outcome === 'SELLER_WIN' || outcome === 'NO_CLAIM') return 0;
  const pct = splitPct ?? 50;
  return Number((BigInt(amount) * BigInt(pct)) / 100n);
}

function normalizeOutcome(value: string): DisputeOutcome {
  if (value === 'BUYER_WINS') return 'BUYER_WIN';
  if (value === 'SELLER_WINS') return 'SELLER_WIN';
  if (['BUYER_WIN', 'SELLER_WIN', 'SPLIT', 'NO_CLAIM', 'CANCELLED'].includes(value)) {
    return value as DisputeOutcome;
  }
  throw new BadRequestException(`Unsupported dispute outcome: ${value}`);
}

function parseNotes(value: string | null | undefined): NotesEnvelope {
  if (!value) return { notes: [] };
  try {
    const parsed = JSON.parse(value) as NotesEnvelope;
    return { ...parsed, notes: Array.isArray(parsed.notes) ? parsed.notes : [] };
  } catch {
    return { notes: [{ actorId: 'legacy', note: value, at: new Date(0).toISOString() }] };
  }
}

function appendNote(envelope: NotesEnvelope, actorId: string, note: string): NotesEnvelope {
  return {
    ...envelope,
    notes: [...(envelope.notes ?? []), { actorId, note, at: new Date().toISOString() }],
  };
}

function deterministicId(prefix: string, ...parts: string[]): string {
  const digest = createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 32);
  return `${prefix}:${digest}`;
}

function requiredId(value: string, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!/^[A-Za-z0-9:_-]{1,180}$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isSerializationFailure(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2034',
  );
}
