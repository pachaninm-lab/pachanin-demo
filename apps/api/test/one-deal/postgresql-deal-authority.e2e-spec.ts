import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { PrismaDealRepository } from '../../src/modules/deals/prisma-deal.repository';
import { Role, type RequestUser } from '../../src/common/types/request-user';

const LOT_ID = 'LOT-RLS-AUTHORITY-001';
const BID_ID = 'BID-RLS-AUTHORITY-001';
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
let repository: PrismaDealRepository;

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  repository = new PrismaDealRepository(new RlsTransactionService(prisma));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PostgreSQL deal authority under NOBYPASSRLS application principal', () => {
  it('exposes only the seller-scoped confirmed pre-deal basis', async () => {
    const visible = await new RlsTransactionService(prisma).withTrustedContext(seller, (tx) =>
      tx.integrationEvent.findMany({
        where: { adapterName: 'auction', eventType: 'DEAL_BASIS_READY', dealId: null },
        select: { id: true, externalId: true },
      }),
    );
    expect(visible).toEqual([{
      id: 'basis-event-rls-authority-001',
      externalId: `${LOT_ID}:${BID_ID}`,
    }]);

    const buyerVisible = await new RlsTransactionService(prisma).withTrustedContext(buyer, (tx) =>
      tx.integrationEvent.count({ where: { dealId: null, eventType: 'DEAL_BASIS_READY' } }),
    );
    expect(buyerVisible).toBe(0);
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

    const sellerCounts = await new RlsTransactionService(prisma).withTrustedContext(seller, async (tx) => ({
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
