import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { DealRepository } from './deal.repository';
import type { CreateDealDto } from './dto/create-deal.dto';
import type { RequestUser } from '../../common/types/request-user';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';

const ACTIVE_ORG_STATUSES = new Set(['VERIFIED', 'ACTIVE']);
const ACTIVE_PARTICIPANT = 'ACTIVE';
const BASIS_EVENT_TYPE = 'DEAL_BASIS_READY';
const BASIS_ADAPTER = 'auction';
const DECIMAL_6 = /^\d+(?:\.\d{1,6})?$/;

type JsonObject = Record<string, unknown>;

type DealBasis = {
  dealNumber: string;
  tenantId: string;
  lotId: string;
  winnerBidId: string;
  sellerOrgId: string;
  buyerOrgId: string;
  sellerUserId: string;
  buyerUserId: string;
  culture: string;
  cropClass?: string;
  region?: string;
  incoterms?: string;
  volumeTons: string;
  pricePerTon: string;
  totalKopecks: string;
  currency: string;
  sourceHash: string;
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object' && !(value instanceof Date) && !Prisma.Decimal.isDecimal(value)) {
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function exactJson(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return value.toFixed();
  if (Array.isArray(value)) return value.map(exactJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as JsonObject).map(([key, item]) => [key, exactJson(item)]));
  }
  return value;
}

function jsonObject(value: Prisma.JsonValue | null | undefined, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new UnprocessableEntityException({
      code: 'DEAL_BASIS_INVALID',
      field,
      message: 'Серверное основание сделки отсутствует или повреждено.',
    });
  }
  return value as JsonObject;
}

function requiredString(value: JsonObject, field: string): string {
  const candidate = typeof value[field] === 'string' ? String(value[field]).trim() : '';
  if (!candidate) {
    throw new UnprocessableEntityException({
      code: 'DEAL_BASIS_INVALID',
      field,
      message: `В серверном основании сделки отсутствует поле ${field}.`,
    });
  }
  return candidate;
}

function parseMicro(value: string, field: string): bigint {
  if (!DECIMAL_6.test(value)) {
    throw new UnprocessableEntityException({
      code: 'DEAL_BASIS_INVALID',
      field,
      message: `${field} должен быть положительной decimal(20,6) строкой.`,
    });
  }
  const [whole, fraction = ''] = value.split('.');
  const micro = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  if (micro <= 0n) {
    throw new UnprocessableEntityException({ code: 'DEAL_BASIS_INVALID', field, message: `${field} должен быть больше нуля.` });
  }
  return micro;
}

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function assertBasisAmount(basis: DealBasis): void {
  const priceMicroRubPerTon = parseMicro(basis.pricePerTon, 'pricePerTon');
  const volumeMicroTons = parseMicro(basis.volumeTons, 'volumeTons');
  let totalKopecks: bigint;
  try {
    totalKopecks = BigInt(basis.totalKopecks);
  } catch {
    throw new UnprocessableEntityException({ code: 'DEAL_BASIS_INVALID', field: 'totalKopecks' });
  }
  if (totalKopecks <= 0n) {
    throw new UnprocessableEntityException({ code: 'DEAL_BASIS_INVALID', field: 'totalKopecks' });
  }
  // price[µRUB/t] × weight[µt] / 10^10 = kopecks.
  const calculated = divideHalfUp(priceMicroRubPerTon * volumeMicroTons, 10_000_000_000n);
  if (calculated !== totalKopecks) {
    throw new UnprocessableEntityException({
      code: 'DEAL_BASIS_AMOUNT_MISMATCH',
      field: 'totalKopecks',
      message: `Сумма основания не равна цене × объём: ожидается ${calculated.toString()} коп.`,
    });
  }
}

function parseBasis(event: { requestPayload: Prisma.JsonValue | null; responsePayload: Prisma.JsonValue | null }): DealBasis {
  const raw = jsonObject(event.responsePayload ?? event.requestPayload, 'basis');
  const basis: DealBasis = {
    dealNumber: requiredString(raw, 'dealNumber'),
    tenantId: requiredString(raw, 'tenantId'),
    lotId: requiredString(raw, 'lotId'),
    winnerBidId: requiredString(raw, 'winnerBidId'),
    sellerOrgId: requiredString(raw, 'sellerOrgId'),
    buyerOrgId: requiredString(raw, 'buyerOrgId'),
    sellerUserId: requiredString(raw, 'sellerUserId'),
    buyerUserId: requiredString(raw, 'buyerUserId'),
    culture: requiredString(raw, 'culture'),
    cropClass: typeof raw.cropClass === 'string' ? raw.cropClass.trim() || undefined : undefined,
    region: typeof raw.region === 'string' ? raw.region.trim() || undefined : undefined,
    incoterms: typeof raw.incoterms === 'string' ? raw.incoterms.trim() || undefined : undefined,
    volumeTons: requiredString(raw, 'volumeTons'),
    pricePerTon: requiredString(raw, 'pricePerTon'),
    totalKopecks: requiredString(raw, 'totalKopecks'),
    currency: requiredString(raw, 'currency').toUpperCase(),
    sourceHash: requiredString(raw, 'sourceHash'),
  };
  const material = { ...basis, sourceHash: undefined };
  delete (material as { sourceHash?: string }).sourceHash;
  if (digest(material) !== basis.sourceHash) {
    throw new UnprocessableEntityException({
      code: 'DEAL_BASIS_HASH_MISMATCH',
      field: 'sourceHash',
      message: 'Hash серверного основания сделки не совпадает с его содержимым.',
    });
  }
  assertBasisAmount(basis);
  return basis;
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002');
}

@Injectable()
export class PrismaDealRepository implements DealRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<unknown[]> {
    this.assertIdentity(user);
    return this.rls.withTrustedContext(user, async (tx) => {
      const deals = await tx.deal.findMany({
        where: {
          tenantId: user.tenantId,
          participants: {
            some: {
              userId: user.id,
              organizationId: user.orgId,
              role: String(user.role),
              status: ACTIVE_PARTICIPANT,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 100,
        include: {
          participants: { where: { status: ACTIVE_PARTICIPANT }, select: { organizationId: true, userId: true, role: true, accessLevel: true } },
          shipments: { select: { id: true, status: true, nextAction: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, amountKopecks: true, callbackState: true } },
        },
      });
      return exactJson(deals) as unknown[];
    });
  }

  async getById(id: string, user: RequestUser): Promise<any> {
    this.assertIdentity(user);
    return this.rls.withTrustedContext(user, async (tx) => {
      await this.assertParticipant(tx, id, user);
      const deal = await tx.deal.findUnique({
        where: { id },
        include: {
          participants: { where: { status: ACTIVE_PARTICIPANT }, orderBy: [{ role: 'asc' }, { assignedAt: 'asc' }] },
        },
      });
      if (!deal) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', dealId: id });
      return exactJson(deal);
    });
  }

  async workspace(id: string, user: RequestUser): Promise<any> {
    this.assertIdentity(user);
    return this.rls.withTrustedContext(user, async (tx) => {
      const participant = await this.assertParticipant(tx, id, user);
      const deal = await tx.deal.findUnique({
        where: { id },
        include: {
          participants: { where: { status: ACTIVE_PARTICIPANT }, orderBy: [{ role: 'asc' }, { assignedAt: 'asc' }] },
          shipments: { include: { checkpoints: { orderBy: [{ completedAt: 'asc' }, { id: 'asc' }] } }, orderBy: { createdAt: 'asc' } },
          documents: { orderBy: [{ type: 'asc' }, { version: 'desc' }] },
          payments: { orderBy: { createdAt: 'desc' } },
          labSamples: { include: { tests: { orderBy: { recordedAt: 'asc' } } }, orderBy: { createdAt: 'desc' } },
          acceptanceRecords: { orderBy: { createdAt: 'desc' } },
          bankOperations: { orderBy: { createdAt: 'asc' } },
          dealEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
      });
      if (!deal) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', dealId: id });
      const [disputes, evidence, audits, outbox] = await Promise.all([
        tx.dispute.findMany({ where: { dealId: id }, include: { moneyHold: true, evidence: true }, orderBy: { createdAt: 'desc' } }),
        tx.evidenceFile.findMany({ where: { dealId: id }, orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }] }),
        tx.auditEvent.findMany({ where: { dealId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
        tx.outboxEntry.findMany({ where: { dealId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 500 }),
      ]);
      return exactJson({
        deal,
        viewer: {
          participantId: participant.id,
          organizationId: participant.organizationId,
          role: participant.role,
          accessLevel: participant.accessLevel,
        },
        projections: {
          auctionDealBasis: deal.sagaState,
          shipments: deal.shipments,
          documents: deal.documents,
          laboratory: deal.labSamples,
          payments: deal.payments,
          disputes,
          evidence,
        },
        timeline: deal.dealEvents,
        audit: audits,
        outbox,
      });
    });
  }

  async passport(id: string, user: RequestUser): Promise<any> {
    this.assertIdentity(user);
    return this.rls.withTrustedContext(user, async (tx) => {
      const participant = await this.assertParticipant(tx, id, user);
      const deal = await tx.deal.findUnique({
        where: { id },
        include: {
          participants: { where: { status: ACTIVE_PARTICIPANT }, select: { organizationId: true, userId: true, role: true, accessLevel: true, assignedAt: true } },
          documents: { orderBy: [{ type: 'asc' }, { version: 'desc' }] },
          payments: { orderBy: { createdAt: 'desc' } },
          bankOperations: { orderBy: { createdAt: 'asc' } },
          acceptanceRecords: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!deal) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', dealId: id });
      const evidence = await tx.evidenceFile.findMany({
        where: { dealId: id },
        select: { id: true, type: true, filename: true, hash: true, prevHash: true, s3Key: true, uploadedAt: true },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
      });
      return exactJson({
        identity: {
          id: deal.id,
          dealNumber: deal.dealNumber,
          tenantId: deal.tenantId,
          status: deal.status,
          version: deal.version,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt,
          closedAt: deal.closedAt,
        },
        commercialBasis: {
          lotId: deal.lotId,
          winnerBidId: deal.sourceLotId,
          sellerOrgId: deal.sellerOrgId,
          buyerOrgId: deal.buyerOrgId,
          culture: deal.culture,
          cropClass: deal.cropClass,
          region: deal.region,
          incoterms: deal.incoterms,
          volumeTons: deal.volumeTonsDec,
          pricePerTon: deal.pricePerTonDec,
          totalKopecks: deal.totalKopecks,
          currency: deal.currency,
          basisSnapshot: deal.sagaState,
        },
        participants: deal.participants,
        documents: deal.documents,
        evidence,
        payments: deal.payments,
        bankOperations: deal.bankOperations,
        acceptance: deal.acceptanceRecords,
        viewer: { participantId: participant.id, role: participant.role, accessLevel: participant.accessLevel },
      });
    });
  }

  async timeline(id: string, user: RequestUser): Promise<any> {
    this.assertIdentity(user);
    return this.rls.withTrustedContext(user, async (tx) => {
      await this.assertParticipant(tx, id, user);
      const [events, audits, outbox, bankOperations, evidence] = await Promise.all([
        tx.dealEvent.findMany({ where: { dealId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1000 }),
        tx.auditEvent.findMany({ where: { dealId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1000 }),
        tx.outboxEntry.findMany({ where: { dealId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1000 }),
        tx.bankOperation.findMany({ where: { dealId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1000 }),
        tx.evidenceFile.findMany({ where: { dealId: id }, orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }], take: 1000 }),
      ]);
      const items = [
        ...events.map((item) => ({ at: item.createdAt, source: 'DEAL_EVENT', id: item.id, kind: item.eventType, payload: item.payload })),
        ...audits.map((item) => ({ at: item.createdAt, source: 'AUDIT', id: item.id, kind: item.action, outcome: item.outcome, payload: item.metadata })),
        ...outbox.map((item) => ({ at: item.createdAt, source: 'OUTBOX', id: item.id, kind: item.type, outcome: item.status, payload: item.payload })),
        ...bankOperations.map((item) => ({ at: item.createdAt, source: 'BANK_OPERATION', id: item.id, kind: item.type, outcome: item.status, payload: item.responsePayload ?? item.requestPayload })),
        ...evidence.map((item) => ({ at: item.uploadedAt, source: 'EVIDENCE', id: item.id, kind: item.type, outcome: item.hash ? 'HASHED' : 'INVALID', payload: { filename: item.filename, hash: item.hash, prevHash: item.prevHash } })),
      ].sort((left, right) => left.at.getTime() - right.at.getTime() || left.id.localeCompare(right.id));
      return exactJson({ dealId: id, count: items.length, items });
    });
  }

  async create(dto: CreateDealDto, user: RequestUser): Promise<any> {
    this.assertIdentity(user);
    const basisExternalId = `${dto.lotId}:${dto.winnerBidId}`;
    const receiptKey = `deal-create:${user.tenantId}:${dto.idempotencyKey}`;
    const requestFingerprint = digest({
      commandId: dto.commandId,
      idempotencyKey: dto.idempotencyKey,
      lotId: dto.lotId,
      winnerBidId: dto.winnerBidId,
      buyerOrgId: dto.buyerOrgId ?? null,
      culture: dto.culture ?? null,
      paymentTerms: dto.paymentTerms ?? null,
    });

    try {
      return await this.rls.withTrustedContext(user, async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${basisExternalId}, 83)) IS NULL AS locked`;
        const existingReceipt = await tx.outboxEntry.findUnique({ where: { idempotencyKey: receiptKey } });
        if (existingReceipt) return this.replayCreate(existingReceipt.payload, requestFingerprint);

        const basisEvent = await tx.integrationEvent.findFirst({
          where: {
            adapterName: BASIS_ADAPTER,
            eventType: BASIS_EVENT_TYPE,
            externalId: basisExternalId,
            status: 'CONFIRMED',
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        if (!basisEvent) {
          throw new UnprocessableEntityException({
            code: 'DEAL_BASIS_NOT_FOUND',
            field: 'winnerBidId',
            message: 'В PostgreSQL нет подтверждённого основания лот → победитель → сделка.',
          });
        }
        const basis = parseBasis(basisEvent);
        if (basis.tenantId !== user.tenantId || basis.lotId !== dto.lotId || basis.winnerBidId !== dto.winnerBidId) {
          throw new ForbiddenException({ code: 'DEAL_BASIS_SCOPE_DENIED' });
        }
        if (basis.sellerUserId !== user.id || basis.sellerOrgId !== user.orgId || String(user.role) !== 'FARMER') {
          throw new ForbiddenException({
            code: 'DEAL_CREATOR_NOT_BASIS_SELLER',
            message: 'Создать сделку может только продавец, зафиксированный в серверном основании.',
          });
        }
        if (dto.buyerOrgId && dto.buyerOrgId !== basis.buyerOrgId) {
          throw new ConflictException({ code: 'CLIENT_BASIS_MISMATCH', field: 'buyerOrgId' });
        }
        if (dto.culture && dto.culture !== basis.culture) {
          throw new ConflictException({ code: 'CLIENT_BASIS_MISMATCH', field: 'culture' });
        }

        const alreadyCreated = await tx.deal.findFirst({
          where: { tenantId: basis.tenantId, lotId: basis.lotId, sourceLotId: basis.winnerBidId },
          select: { id: true },
        });
        if (alreadyCreated) {
          throw new ConflictException({
            code: 'DEAL_BASIS_ALREADY_CONSUMED',
            dealId: alreadyCreated.id,
          });
        }

        await this.assertCreationActors(tx, basis);
        const dealId = `deal-${randomUUID()}`;
        const basisSnapshot = {
          source: 'POSTGRESQL_INTEGRATION_EVENT',
          integrationEventId: basisEvent.id,
          sourceHash: basis.sourceHash,
          lotId: basis.lotId,
          winnerBidId: basis.winnerBidId,
          sellerOrgId: basis.sellerOrgId,
          buyerOrgId: basis.buyerOrgId,
          sellerUserId: basis.sellerUserId,
          buyerUserId: basis.buyerUserId,
          culture: basis.culture,
          cropClass: basis.cropClass ?? null,
          region: basis.region ?? null,
          incoterms: basis.incoterms ?? null,
          volumeTons: basis.volumeTons,
          pricePerTon: basis.pricePerTon,
          totalKopecks: basis.totalKopecks,
          currency: basis.currency,
          paymentTerms: dto.paymentTerms ?? null,
        };

        const deal = await tx.deal.create({
          data: {
            id: dealId,
            lotId: basis.lotId,
            sourceLotId: basis.winnerBidId,
            dealNumber: basis.dealNumber,
            status: 'DRAFT',
            tenantId: basis.tenantId,
            sellerOrgId: basis.sellerOrgId,
            buyerOrgId: basis.buyerOrgId,
            volumeTonsDec: new Prisma.Decimal(basis.volumeTons),
            pricePerTonDec: new Prisma.Decimal(basis.pricePerTon),
            totalKopecks: BigInt(basis.totalKopecks),
            currency: basis.currency,
            culture: basis.culture,
            cropClass: basis.cropClass,
            region: basis.region,
            incoterms: basis.incoterms,
            sagaState: basisSnapshot,
            nextAction: 'Подтвердить допуск участников',
          },
        });
        await tx.dealParticipant.createMany({
          data: [
            {
              id: `participant:${dealId}:seller`,
              dealId,
              tenantId: basis.tenantId,
              organizationId: basis.sellerOrgId,
              userId: basis.sellerUserId,
              role: 'FARMER',
              accessLevel: 'APPROVE',
              status: ACTIVE_PARTICIPANT,
              assignedByUserId: user.id,
            },
            {
              id: `participant:${dealId}:buyer`,
              dealId,
              tenantId: basis.tenantId,
              organizationId: basis.buyerOrgId,
              userId: basis.buyerUserId,
              role: 'BUYER',
              accessLevel: 'APPROVE',
              status: ACTIVE_PARTICIPANT,
              assignedByUserId: user.id,
            },
          ],
        });

        const eventId = `event-${randomUUID()}`;
        const eventPayload = {
          commandId: dto.commandId,
          idempotencyKey: dto.idempotencyKey,
          integrationEventId: basisEvent.id,
          basisHash: basis.sourceHash,
          status: 'DRAFT',
        };
        const eventHash = digest({ id: eventId, dealId, eventType: 'CREATED', actorId: user.id, actorRole: String(user.role), tenantId: user.tenantId, payload: eventPayload, prevHash: null });
        await tx.dealEvent.create({
          data: {
            id: eventId,
            dealId,
            eventType: 'CREATED',
            actorId: user.id,
            actorRole: String(user.role),
            tenantId: user.tenantId,
            payload: eventPayload,
            hash: eventHash,
          },
        });

        const auditId = `audit-${randomUUID()}`;
        const auditMaterial = {
          id: auditId,
          action: 'deal.create',
          actorUserId: user.id,
          actorRole: String(user.role),
          tenantId: user.tenantId,
          orgId: user.orgId,
          dealId,
          objectType: 'deal',
          objectId: dealId,
          beforeState: null,
          afterState: { status: 'DRAFT', version: '0' },
          outcome: 'SUCCESS',
          metadata: { commandId: dto.commandId, idempotencyKey: dto.idempotencyKey, eventId, basisEventId: basisEvent.id },
          prevHash: null,
        };
        await tx.auditEvent.create({
          data: { ...auditMaterial, hash: digest(auditMaterial) },
        });

        const result = exactJson({
          id: deal.id,
          dealNumber: deal.dealNumber,
          status: deal.status,
          version: deal.version,
          tenantId: deal.tenantId,
          sellerOrgId: deal.sellerOrgId,
          buyerOrgId: deal.buyerOrgId,
          lotId: deal.lotId,
          winnerBidId: deal.sourceLotId,
          eventId,
          auditId,
          duplicate: false,
        });
        await tx.outboxEntry.create({
          data: {
            type: 'deal.create.receipt',
            dealId,
            status: 'CONFIRMED',
            idempotencyKey: receiptKey,
            correlationId: dto.commandId,
            auditId,
            confirmedAt: new Date(),
            payload: { requestFingerprint, result } as Prisma.InputJsonValue,
          },
        });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return this.rls.withTrustedContext(user, async (tx) => {
          const receipt = await tx.outboxEntry.findUnique({ where: { idempotencyKey: receiptKey } });
          if (receipt) return this.replayCreate(receipt.payload, requestFingerprint);
          throw error;
        });
      }
      throw error;
    }
  }

  private assertIdentity(user: RequestUser): void {
    if (!user.id || !user.sessionId || !user.orgId || !user.tenantId || !user.role) {
      throw new ForbiddenException({ code: 'TRUSTED_CONTEXT_REQUIRED' });
    }
  }

  private async assertParticipant(tx: Prisma.TransactionClient, dealId: string, user: RequestUser) {
    const participant = await tx.dealParticipant.findFirst({
      where: {
        dealId,
        tenantId: user.tenantId,
        userId: user.id,
        organizationId: user.orgId,
        role: String(user.role),
        status: ACTIVE_PARTICIPANT,
      },
      include: { organization: true, user: true },
    });
    if (!participant) throw new ForbiddenException({ code: 'DEAL_PARTICIPANT_REQUIRED', dealId });
    if (
      participant.organization.tenantId !== user.tenantId
      || !ACTIVE_ORG_STATUSES.has(participant.organization.status)
      || participant.organization.kycStatus !== 'APPROVED'
      || participant.user.status !== 'ACTIVE'
      || participant.user.deletedAt
    ) {
      throw new ForbiddenException({ code: 'DEAL_PARTICIPANT_INACTIVE', dealId });
    }
    const membership = await tx.userOrg.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: user.orgId } },
    });
    if (!membership || membership.role !== String(user.role)) {
      throw new ForbiddenException({ code: 'DEAL_MEMBERSHIP_REQUIRED', dealId });
    }
    const deal = await tx.deal.findUnique({ where: { id: dealId }, select: { tenantId: true } });
    if (!deal) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', dealId });
    if (deal.tenantId !== user.tenantId) throw new ForbiddenException({ code: 'TENANT_SCOPE_DENIED', dealId });
    return participant;
  }

  private async assertCreationActors(tx: Prisma.TransactionClient, basis: DealBasis): Promise<void> {
    const organizations = await tx.organization.findMany({
      where: { id: { in: [basis.sellerOrgId, basis.buyerOrgId] } },
    });
    if (organizations.length !== 2 || organizations.some((org) => org.tenantId !== basis.tenantId || !ACTIVE_ORG_STATUSES.has(org.status) || org.kycStatus !== 'APPROVED')) {
      throw new UnprocessableEntityException({ code: 'DEAL_BASIS_ORGANIZATION_INVALID' });
    }
    const users = await tx.user.findMany({ where: { id: { in: [basis.sellerUserId, basis.buyerUserId] } } });
    if (users.length !== 2 || users.some((actor) => actor.status !== 'ACTIVE' || actor.deletedAt)) {
      throw new UnprocessableEntityException({ code: 'DEAL_BASIS_USER_INVALID' });
    }
    const memberships = await tx.userOrg.findMany({
      where: {
        OR: [
          { userId: basis.sellerUserId, organizationId: basis.sellerOrgId, role: 'FARMER' },
          { userId: basis.buyerUserId, organizationId: basis.buyerOrgId, role: 'BUYER' },
        ],
      },
    });
    if (memberships.length !== 2) {
      throw new UnprocessableEntityException({ code: 'DEAL_BASIS_MEMBERSHIP_INVALID' });
    }
  }

  private replayCreate(payload: Prisma.JsonValue, requestFingerprint: string): unknown {
    const root = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as JsonObject : {};
    if (root.requestFingerprint !== requestFingerprint) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        message: 'Этот idempotency key уже использован с другим основанием сделки.',
      });
    }
    const result = root.result && typeof root.result === 'object' && !Array.isArray(root.result) ? root.result as JsonObject : null;
    if (!result) throw new ConflictException({ code: 'CREATE_RECEIPT_INVALID' });
    return { ...result, duplicate: true };
  }
}
