import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../src/common/types/request-user';
import { Role } from '../../src/common/types/request-user';
import { PrismaDealRepository } from '../../src/modules/deals/prisma-deal.repository';
import {
  cleanTenant,
  createInstance,
  destroyInstance,
  INDUSTRIAL_TENANT,
  type ServiceInstance,
} from './harness';

jest.setTimeout(180_000);

const PREFIX = 'authority';
const SELLER_ORG = 'org-e2e-authority-seller';
const BUYER_ORG = 'org-e2e-authority-buyer';
const SELLER_USER = 'user-e2e-authority-seller';
const BUYER_USER = 'user-e2e-authority-buyer';
const OUTSIDER_USER = 'user-e2e-authority-outsider';
const LOT_ID = 'LOT-AUTHORITY-0001';
const BID_ID = 'BID-AUTHORITY-0001';
const TOTAL_KOPECKS = '10000000000000000';

let alpha: ServiceInstance;
let repository: PrismaDealRepository;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function actor(id: string, role: Role, orgId: string): RequestUser {
  return {
    id,
    email: `${id}@industrial-e2e.invalid`,
    fullName: id,
    role,
    orgId,
    tenantId: INDUSTRIAL_TENANT,
    sessionId: `session-${id}`,
    mfaVerified: true,
  };
}

const seller = actor(SELLER_USER, Role.FARMER, SELLER_ORG);
const buyer = actor(BUYER_USER, Role.BUYER, BUYER_ORG);
const outsider = actor(OUTSIDER_USER, Role.FARMER, SELLER_ORG);

function basis(overrides: Record<string, unknown> = {}) {
  const material = {
    dealNumber: `ТП-${PREFIX}-0001`,
    tenantId: INDUSTRIAL_TENANT,
    lotId: LOT_ID,
    winnerBidId: BID_ID,
    sellerOrgId: SELLER_ORG,
    buyerOrgId: BUYER_ORG,
    sellerUserId: SELLER_USER,
    buyerUserId: BUYER_USER,
    culture: 'Пшеница',
    cropClass: '3 класс',
    region: 'Тамбовская область',
    incoterms: 'CPT',
    volumeTons: '100.000000',
    pricePerTon: '1000000000000.000000',
    totalKopecks: TOTAL_KOPECKS,
    currency: 'RUB',
    ...overrides,
  };
  return { ...material, sourceHash: digest(material) };
}

async function seedIdentityAndBasis(
  instance: ServiceInstance,
  suffix = '',
  basisOverrides: Record<string, unknown> = {},
) {
  const lotId = suffix ? `${LOT_ID}-${suffix}` : LOT_ID;
  const bidId = suffix ? `${BID_ID}-${suffix}` : BID_ID;
  const payload = basis({ lotId, winnerBidId: bidId, dealNumber: `ТП-${PREFIX}-${suffix || '0001'}`, ...basisOverrides });
  await instance.prisma.$transaction(async (tx) => {
    for (const organization of [
      { id: SELLER_ORG, inn: '779900000001' },
      { id: BUYER_ORG, inn: '779900000002' },
    ]) {
      await tx.organization.upsert({
        where: { id: organization.id },
        update: { tenantId: INDUSTRIAL_TENANT, status: 'VERIFIED', kycStatus: 'APPROVED' },
        create: {
          ...organization,
          name: organization.id,
          tenantId: INDUSTRIAL_TENANT,
          status: 'VERIFIED',
          kycStatus: 'APPROVED',
        },
      });
    }

    const passwordHash = bcrypt.hashSync('authority-e2e', 4);
    for (const identity of [
      { id: SELLER_USER, role: Role.FARMER, orgId: SELLER_ORG },
      { id: BUYER_USER, role: Role.BUYER, orgId: BUYER_ORG },
      { id: OUTSIDER_USER, role: Role.FARMER, orgId: SELLER_ORG },
    ]) {
      await tx.user.upsert({
        where: { id: identity.id },
        update: { status: 'ACTIVE', deletedAt: null },
        create: {
          id: identity.id,
          email: `${identity.id}@industrial-e2e.invalid`,
          fullName: identity.id,
          passwordHash,
          status: 'ACTIVE',
        },
      });
      await tx.userOrg.upsert({
        where: { userId_organizationId: { userId: identity.id, organizationId: identity.orgId } },
        update: { role: identity.role, isDefault: true },
        create: {
          userId: identity.id,
          organizationId: identity.orgId,
          role: identity.role,
          isDefault: true,
        },
      });
    }

    await tx.integrationEvent.create({
      data: {
        id: `basis-event-${suffix || 'primary'}`,
        adapterName: 'auction',
        direction: 'INBOUND',
        eventType: 'DEAL_BASIS_READY',
        externalId: `${lotId}:${bidId}`,
        status: 'CONFIRMED',
        responsePayload: payload as Prisma.InputJsonValue,
        idempotencyKey: `basis-${suffix || 'primary'}`,
      },
    });
  });
  return { lotId, bidId, payload };
}

async function cleanup(instance: ServiceInstance) {
  await instance.prisma.$executeRawUnsafe('SET session_replication_role = replica');
  try {
    await instance.prisma.$executeRawUnsafe(
      `DELETE FROM "integration_events" WHERE "id" LIKE 'basis-event-%' OR "idempotencyKey" LIKE 'basis-%'`,
    );
  } finally {
    await instance.prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT');
  }
  await cleanTenant(instance.prisma);
}

beforeAll(async () => {
  alpha = await createInstance();
  repository = new PrismaDealRepository(alpha.rls);
  await cleanup(alpha);
  await seedIdentityAndBasis(alpha);
});

afterAll(async () => {
  await cleanup(alpha);
  await destroyInstance(alpha);
});

describe('PostgreSQL-authoritative DealRepository', () => {
  it('creates Deal, participants, initial event, audit and receipt atomically without operational fixtures', async () => {
    const result = await repository.create({
      commandId: 'authority-create-command-0001',
      idempotencyKey: 'authority-create-idempotency-0001',
      lotId: LOT_ID,
      winnerBidId: BID_ID,
    }, seller) as Record<string, unknown>;

    expect(result).toMatchObject({
      status: 'DRAFT',
      version: '0',
      tenantId: INDUSTRIAL_TENANT,
      sellerOrgId: SELLER_ORG,
      buyerOrgId: BUYER_ORG,
      lotId: LOT_ID,
      winnerBidId: BID_ID,
      duplicate: false,
    });
    const dealId = String(result.id);

    const [deal, participants, events, audits, receipts, shipments, documents, payments, labs, bankOperations, acceptance] = await Promise.all([
      alpha.prisma.deal.findUniqueOrThrow({ where: { id: dealId } }),
      alpha.prisma.dealParticipant.findMany({ where: { dealId }, orderBy: { role: 'asc' } }),
      alpha.prisma.dealEvent.findMany({ where: { dealId } }),
      alpha.prisma.auditEvent.findMany({ where: { dealId } }),
      alpha.prisma.outboxEntry.findMany({ where: { dealId, type: 'deal.create.receipt' } }),
      alpha.prisma.shipment.count({ where: { dealId } }),
      alpha.prisma.dealDocument.count({ where: { dealId } }),
      alpha.prisma.payment.count({ where: { dealId } }),
      alpha.prisma.labSample.count({ where: { dealId } }),
      alpha.prisma.bankOperation.count({ where: { dealId } }),
      alpha.prisma.acceptanceRecord.count({ where: { dealId } }),
    ]);

    expect(deal.totalKopecks?.toString()).toBe(TOTAL_KOPECKS);
    expect(deal.pricePerTonDec?.toFixed()).toBe('1000000000000');
    expect(deal.volumeTonsDec?.toFixed()).toBe('100');
    expect(participants.map((item) => [item.userId, item.organizationId, item.role])).toEqual([
      [BUYER_USER, BUYER_ORG, 'BUYER'],
      [SELLER_USER, SELLER_ORG, 'FARMER'],
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('CREATED');
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'deal.create', outcome: 'SUCCESS' });
    expect(receipts).toHaveLength(1);
    expect({ shipments, documents, payments, labs, bankOperations, acceptance }).toEqual({
      shipments: 0,
      documents: 0,
      payments: 0,
      labs: 0,
      bankOperations: 0,
      acceptance: 0,
    });
  });

  it('replays the stored create receipt and rejects idempotency payload mutation', async () => {
    const first = await repository.create({
      commandId: 'authority-create-command-0001',
      idempotencyKey: 'authority-create-idempotency-0001',
      lotId: LOT_ID,
      winnerBidId: BID_ID,
    }, seller) as Record<string, unknown>;
    expect(first.duplicate).toBe(true);

    await expect(repository.create({
      commandId: 'authority-create-command-mutated',
      idempotencyKey: 'authority-create-idempotency-0001',
      lotId: LOT_ID,
      winnerBidId: BID_ID,
    }, seller)).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' }),
    });
  });

  it('returns participant-scoped exact projections and survives a new API instance', async () => {
    const sellerList = await repository.list(seller) as Array<Record<string, unknown>>;
    expect(sellerList).toHaveLength(1);
    const dealId = String(sellerList[0].id);
    expect(sellerList[0].totalKopecks).toBe(TOTAL_KOPECKS);
    expect(typeof sellerList[0].totalKopecks).toBe('string');

    const [sellerDeal, buyerDeal, workspace, passport, timeline] = await Promise.all([
      repository.getById(dealId, seller),
      repository.getById(dealId, buyer),
      repository.workspace(dealId, buyer),
      repository.passport(dealId, seller),
      repository.timeline(dealId, buyer),
    ]);
    expect(sellerDeal).toEqual(buyerDeal);
    expect(workspace.deal.id).toBe(dealId);
    expect(passport.commercialBasis.totalKopecks).toBe(TOTAL_KOPECKS);
    expect(timeline.items.some((item: { kind: string }) => item.kind === 'CREATED')).toBe(true);

    const beta = await createInstance();
    try {
      const restarted = new PrismaDealRepository(beta.rls);
      expect(await restarted.getById(dealId, seller)).toEqual(sellerDeal);
      expect(await restarted.workspace(dealId, buyer)).toEqual(workspace);
    } finally {
      await destroyInstance(beta);
    }
  });

  it('denies non-participant object reads and returns no foreign deals', async () => {
    const dealId = String((await repository.list(seller) as Array<Record<string, unknown>>)[0].id);
    await expect(repository.list(outsider)).resolves.toEqual([]);
    const reads = [
      () => repository.getById(dealId, outsider),
      () => repository.workspace(dealId, outsider),
      () => repository.passport(dealId, outsider),
      () => repository.timeline(dealId, outsider),
    ];
    for (const read of reads) {
      await expect(read()).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({ code: 'DEAL_PARTICIPANT_REQUIRED' }),
      });
    }
  });

  it('rejects a forged basis hash and commits no deal/event/audit/outbox effect', async () => {
    const forged = await seedIdentityAndBasis(alpha, 'forged', { sourceHash: 'forged' });
    // sourceHash is generated after overrides by helper; corrupt the stored row explicitly.
    await alpha.prisma.integrationEvent.update({
      where: { id: 'basis-event-forged' },
      data: { responsePayload: { ...forged.payload, sourceHash: '0'.repeat(64) } as Prisma.InputJsonValue },
    });
    const before = {
      deals: await alpha.prisma.deal.count(),
      events: await alpha.prisma.dealEvent.count(),
      audits: await alpha.prisma.auditEvent.count(),
      outbox: await alpha.prisma.outboxEntry.count(),
    };

    await expect(repository.create({
      commandId: 'authority-create-command-forged',
      idempotencyKey: 'authority-create-idempotency-forged',
      lotId: forged.lotId,
      winnerBidId: forged.bidId,
    }, seller)).rejects.toMatchObject({
      status: 422,
      response: expect.objectContaining({ code: 'DEAL_BASIS_HASH_MISMATCH' }),
    });

    expect({
      deals: await alpha.prisma.deal.count(),
      events: await alpha.prisma.dealEvent.count(),
      audits: await alpha.prisma.auditEvent.count(),
      outbox: await alpha.prisma.outboxEntry.count(),
    }).toEqual(before);
  });

  it('rejects an inactive organization before any deal write', async () => {
    const inactive = await seedIdentityAndBasis(alpha, 'inactive');
    await alpha.prisma.organization.update({ where: { id: BUYER_ORG }, data: { status: 'SUSPENDED' } });
    const before = await alpha.prisma.deal.count();
    try {
      await expect(repository.create({
        commandId: 'authority-create-command-inactive',
        idempotencyKey: 'authority-create-idempotency-inactive',
        lotId: inactive.lotId,
        winnerBidId: inactive.bidId,
      }, seller)).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({ code: 'DEAL_BASIS_ORGANIZATION_INVALID' }),
      });
      expect(await alpha.prisma.deal.count()).toBe(before);
    } finally {
      await alpha.prisma.organization.update({ where: { id: BUYER_ORG }, data: { status: 'VERIFIED' } });
    }
  });
});
