import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { PrismaDealRepository } from '../../src/modules/deals/prisma-deal.repository';
import { Role, type RequestUser } from '../../src/common/types/request-user';

const LOT_ID = 'LOT-RLS-AUTHORITY-001';
const BID_ID = 'BID-RLS-AUTHORITY-001';
const BASIS_EVENT_ID = 'basis-event-rls-authority-001';
const CREATE_COMMAND = {
  commandId: 'restricted-authority-command-0001',
  idempotencyKey: 'restricted-authority-idempotency-0001',
  lotId: LOT_ID,
  winnerBidId: BID_ID,
};

const seller: RequestUser = {
  id: 'farmer-e2e',
  email: 'farmer@demo.ru',
  fullName: 'Тестовый продавец',
  role: Role.FARMER,
  orgId: 'org-canonical-seller',
  tenantId: 'tenant-canonical-test',
  sessionId: 'restricted-authority-seller-session',
  mfaVerified: true,
};

const buyer: RequestUser = {
  id: 'buyer-e2e',
  email: 'buyer@demo.ru',
  fullName: 'Тестовый покупатель',
  role: Role.BUYER,
  orgId: 'org-canonical-buyer',
  tenantId: 'tenant-canonical-test',
  sessionId: 'restricted-authority-buyer-session',
  mfaVerified: true,
};

const outsider: RequestUser = {
  ...seller,
  id: 'driver-e2e',
  email: 'driver@demo.ru',
  role: Role.DRIVER,
  orgId: 'org-canonical-logistics',
  sessionId: 'restricted-authority-outsider-session',
};

let prisma: PrismaService;
let rls: RlsTransactionService;
let repository: PrismaDealRepository;

function databaseErrorText(error: unknown): string {
  const candidate = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    meta?: unknown;
  };
  return JSON.stringify({
    name: candidate?.name,
    code: candidate?.code,
    message: candidate?.message,
    meta: candidate?.meta,
  });
}

async function captureDatabaseRejection(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    return databaseErrorText(error);
  }
  throw new Error('Expected PostgreSQL to reject the write.');
}

async function basisBoundDealData(
  id: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const event = await rls.withTrustedContext(seller, (tx) => tx.integrationEvent.findUniqueOrThrow({
    where: { id: BASIS_EVENT_ID },
  }));
  const basis = (event.responsePayload ?? event.requestPayload) as Record<string, string>;

  return {
    id,
    lotId: basis.lotId,
    sourceLotId: basis.winnerBidId,
    dealNumber: basis.dealNumber,
    status: 'DRAFT',
    tenantId: basis.tenantId,
    sellerOrgId: basis.sellerOrgId,
    buyerOrgId: basis.buyerOrgId,
    volumeTonsDec: basis.volumeTons,
    pricePerTonDec: basis.pricePerTon,
    totalKopecks: BigInt(basis.totalKopecks),
    currency: basis.currency,
    culture: basis.culture,
    cropClass: basis.cropClass,
    region: basis.region,
    incoterms: basis.incoterms,
    sagaState: {
      source: 'POSTGRESQL_INTEGRATION_EVENT',
      integrationEventId: event.id,
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
      paymentTerms: null,
    },
    nextAction: 'Подтвердить допуск участников',
    ...overrides,
  };
}

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  rls = new RlsTransactionService(prisma);
  repository = new PrismaDealRepository(rls);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PostgreSQL deal authority under NOBYPASSRLS application principal', () => {
  it('exposes only the seller-scoped confirmed pre-deal basis', async () => {
    const visible = await rls.withTrustedContext(seller, (tx) =>
      tx.integrationEvent.findMany({
        where: { adapterName: 'auction', eventType: 'DEAL_BASIS_READY', dealId: null },
        select: { id: true, externalId: true },
      }),
    );
    expect(visible).toEqual([{
      id: BASIS_EVENT_ID,
      externalId: `${LOT_ID}:${BID_ID}`,
    }]);

    const buyerVisible = await rls.withTrustedContext(buyer, (tx) =>
      tx.integrationEvent.count({ where: { dealId: null, eventType: 'DEAL_BASIS_READY' } }),
    );
    expect(buyerVisible).toBe(0);
  });

  it('rejects a direct Deal INSERT that is not backed by a confirmed basis', async () => {
    const error = await captureDatabaseRejection(
      rls.withTrustedContext(seller, (tx) => tx.deal.create({
        data: {
          id: 'deal-forged-without-basis',
          lotId: 'LOT-FORGED-WITHOUT-BASIS',
          sourceLotId: 'BID-FORGED-WITHOUT-BASIS',
          dealNumber: 'ТП-FORGED-WITHOUT-BASIS',
          status: 'DRAFT',
          tenantId: seller.tenantId,
          sellerOrgId: seller.orgId,
          buyerOrgId: buyer.orgId,
          totalKopecks: 100n,
          currency: 'RUB',
        },
      })),
    );

    expect(error).toMatch(/row-level security|42501|policy/i);
  });

  it('rejects direct tampering with amount or state even when lot and winner match', async () => {
    const tampered = await basisBoundDealData('deal-tampered-confirmed-basis', {
      totalKopecks: 1n,
      status: 'CLOSED',
    });
    const error = await captureDatabaseRejection(
      rls.withTrustedContext(seller, (tx) => tx.deal.create({ data: tampered as any })),
    );

    expect(error).toMatch(/row-level security|42501|policy/i);
  });

  it('creates the deal and exactly basis-bound seller/buyer participants in one transaction', async () => {
    const result = await repository.create(CREATE_COMMAND, seller) as Record<string, unknown>;
    expect(result).toMatchObject({
      status: 'DRAFT',
      version: '0',
      lotId: LOT_ID,
      winnerBidId: BID_ID,
      tenantId: 'tenant-canonical-test',
      sellerOrgId: 'org-canonical-seller',
      buyerOrgId: 'org-canonical-buyer',
      duplicate: false,
    });
    const dealId = String(result.id);

    const sellerProjection = await repository.getById(dealId, seller);
    const buyerProjection = await repository.getById(dealId, buyer);
    expect(sellerProjection.participants).toHaveLength(1);
    expect(sellerProjection.participants[0]).toMatchObject({ userId: 'farmer-e2e', role: 'FARMER' });
    expect(buyerProjection.participants).toHaveLength(1);
    expect(buyerProjection.participants[0]).toMatchObject({ userId: 'buyer-e2e', role: 'BUYER' });

    const sellerCounts = await rls.withTrustedContext(seller, async (tx) => ({
      events: await tx.dealEvent.count({ where: { dealId } }),
      audits: await tx.auditEvent.count({ where: { dealId } }),
      receipts: await tx.outboxEntry.count({ where: { dealId, type: 'deal.create.receipt' } }),
      shipments: await tx.shipment.count({ where: { dealId } }),
      documents: await tx.dealDocument.count({ where: { dealId } }),
      payments: await tx.payment.count({ where: { dealId } }),
      labs: await tx.labSample.count({ where: { dealId } }),
      bankOperations: await tx.bankOperation.count({ where: { dealId } }),
    }));
    expect(sellerCounts).toEqual({
      events: 1,
      audits: 1,
      receipts: 1,
      shipments: 0,
      documents: 0,
      payments: 0,
      labs: 0,
      bankOperations: 0,
    });
  });

  it('rejects a second Deal row for the same confirmed lot and winning bid', async () => {
    const duplicate = await basisBoundDealData('deal-duplicate-confirmed-basis');
    const error = await captureDatabaseRejection(
      rls.withTrustedContext(seller, (tx) => tx.deal.create({ data: duplicate as any })),
    );

    expect(error).toMatch(/already been consumed|23505|P2002|deals_tenant_lot_winner_single_use/i);
    const matchingDeals = await rls.withTrustedContext(seller, (tx) => tx.deal.count({
      where: {
        tenantId: seller.tenantId,
        lotId: LOT_ID,
        sourceLotId: BID_ID,
      },
    }));
    expect(matchingDeals).toBe(1);
  });

  it('replays idempotently across a fresh application instance', async () => {
    const first = await repository.create(CREATE_COMMAND, seller) as Record<string, unknown>;
    expect(first.duplicate).toBe(true);

    const freshPrisma = new PrismaService();
    await freshPrisma.$connect();
    try {
      const freshRepository = new PrismaDealRepository(new RlsTransactionService(freshPrisma));
      const replay = await freshRepository.create(CREATE_COMMAND, seller) as Record<string, unknown>;
      expect(replay).toMatchObject({ id: first.id, duplicate: true });
      expect(await freshRepository.getById(String(first.id), buyer)).toMatchObject({
        id: first.id,
        totalKopecks: '185000000',
        pricePerTonDec: '18500',
        volumeTonsDec: '100',
      });
    } finally {
      await freshPrisma.$disconnect();
    }
  });

  it('denies a non-participant and never exposes the deal cross-object', async () => {
    const result = await repository.create(CREATE_COMMAND, seller) as Record<string, unknown>;
    const dealId = String(result.id);
    await expect(repository.list(outsider)).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: dealId })]),
    );
    await expect(repository.workspace(dealId, outsider)).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({ code: 'DEAL_PARTICIPANT_REQUIRED' }),
    });
  });
});
