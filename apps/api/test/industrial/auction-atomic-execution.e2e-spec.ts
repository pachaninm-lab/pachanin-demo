import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuctionCommandService } from '../../src/modules/auctions/auction-command.service';
import { PrismaDealRepository } from '../../src/modules/deals/prisma-deal.repository';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import type { RequestUser } from '../../src/common/types/request-user';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const APP_URL = process.env.DATABASE_URL;

const TENANT = 'tenant-auction-atomic';
const FOREIGN_TENANT = 'tenant-auction-foreign';
const SELLER_ORG = 'org-auction-seller';
const BUYER_ONE_ORG = 'org-auction-buyer-one';
const BUYER_TWO_ORG = 'org-auction-buyer-two';
const BUYER_BLOCKED_ORG = 'org-auction-buyer-blocked';
const FOREIGN_ORG = 'org-auction-foreign';
const SELLER_USER = 'user-auction-seller';
const ADMIN_USER = 'user-auction-admin';
const BUYER_ONE_USER = 'user-auction-buyer-one';
const BUYER_TWO_USER = 'user-auction-buyer-two';
const BUYER_BLOCKED_USER = 'user-auction-buyer-blocked';
const FOREIGN_USER = 'user-auction-foreign';

const seller = actor(SELLER_USER, SELLER_ORG, TENANT, 'FARMER');
const administrator = actor(ADMIN_USER, SELLER_ORG, TENANT, 'ADMIN');
const buyerOne = actor(BUYER_ONE_USER, BUYER_ONE_ORG, TENANT, 'BUYER');
const buyerTwo = actor(BUYER_TWO_USER, BUYER_TWO_ORG, TENANT, 'BUYER');
const blockedBuyer = actor(BUYER_BLOCKED_USER, BUYER_BLOCKED_ORG, TENANT, 'BUYER');
const foreignBuyer = actor(FOREIGN_USER, FOREIGN_ORG, FOREIGN_TENANT, 'BUYER');

function actor(id: string, orgId: string, tenantId: string, role: RequestUser['role']): RequestUser {
  return {
    id,
    orgId,
    tenantId,
    role,
    email: `${id}@example.test`,
    sessionId: `session:${id}`,
  };
}

function resultObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected command result object');
  }
  return value as Record<string, unknown>;
}

function errorCode(reason: unknown): string {
  if (!reason || typeof reason !== 'object') return String(reason);
  const response = (reason as { response?: unknown }).response;
  if (response && typeof response === 'object' && 'code' in response) {
    return String((response as { code?: unknown }).code);
  }
  return String((reason as { message?: unknown }).message ?? reason);
}

const describeAuctionAtomic = ADMIN_URL && APP_URL ? describe : describe.skip;

describeAuctionAtomic('IR-AUCTION atomic execution', () => {
  let admin: PrismaClient;
  let app: PrismaService;
  let commands: AuctionCommandService;
  let deals: PrismaDealRepository;

  beforeAll(async () => {
    if (!ADMIN_URL || !APP_URL) {
      throw new Error('TEST_ADMIN_DATABASE_URL and DATABASE_URL are required');
    }
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    app = new PrismaService();
    await Promise.all([admin.$connect(), app.$connect()]);
    const rls = new RlsTransactionService(app);
    commands = new AuctionCommandService(rls);
    deals = new PrismaDealRepository(rls);
    await resetDatabase(admin);
    await seedActors(admin);
  }, 60_000);

  afterAll(async () => {
    await Promise.all([admin?.$disconnect(), app?.$disconnect()]);
  });

  it('accepts atomic bids, deterministic winner, one close and one canonical Deal', async () => {
    const lot = resultObject(await commands.registerLot({
      title: 'Пшеница 3 класс — атомарный тест',
      culture: 'WHEAT',
      grade: '3',
      volumeTons: '100.000000',
      startPriceKopecksPerTon: '1850000',
      stepPriceKopecksPerTon: '10000',
      region: 'Тамбовская область',
      address: 'Элеватор атомарного теста',
      auctionEndsAt: new Date(Date.now() + 3_600_000).toISOString(),
      sourceType: 'MANUAL_VERIFIED',
      sourceExternalId: 'source:auction:atomic:1',
      sourceCertificateId: 'certificate:auction:atomic:1',
      autoExtendEnabled: false,
      idempotencyKey: 'register:auction:atomic:1',
    }, seller));
    const lotId = String(lot.lotId);
    expect(lot.version).toBe('1');

    const admissionOne = resultObject(await commands.recordAdmission(lotId, {
      buyerOrgId: BUYER_ONE_ORG,
      buyerUserId: BUYER_ONE_USER,
      status: 'ADMITTED',
      validUntil: new Date(Date.now() + 7_200_000).toISOString(),
      reason: 'KYC and AML accepted for atomic test buyer one',
      expectedVersion: '1',
      idempotencyKey: 'admission:buyer:one',
    }, administrator));
    expect(admissionOne.lotVersion).toBe('2');

    const admissionTwo = resultObject(await commands.recordAdmission(lotId, {
      buyerOrgId: BUYER_TWO_ORG,
      buyerUserId: BUYER_TWO_USER,
      status: 'ADMITTED',
      validUntil: new Date(Date.now() + 7_200_000).toISOString(),
      reason: 'KYC and AML accepted for atomic test buyer two',
      expectedVersion: '2',
      idempotencyKey: 'admission:buyer:two',
    }, administrator));
    expect(admissionTwo.lotVersion).toBe('3');

    await expect(commands.placeBid(lotId, {
      amountKopecksPerTon: '1850000',
      volumeTons: '100.000000',
      expectedVersion: '3',
      idempotencyKey: 'bid:blocked',
    }, blockedBuyer)).rejects.toMatchObject({ response: { code: 'AUCTION_ADMISSION_REQUIRED' } });

    await expect(commands.placeBid(lotId, {
      amountKopecksPerTon: '1850000',
      volumeTons: '100.000000',
      expectedVersion: '3',
      idempotencyKey: 'bid:foreign',
    }, foreignBuyer)).rejects.toMatchObject({ response: { code: 'AUCTION_LOT_NOT_FOUND' } });

    const simultaneous = await Promise.allSettled([
      commands.placeBid(lotId, {
        amountKopecksPerTon: '1900000',
        volumeTons: '100.000000',
        expectedVersion: '3',
        idempotencyKey: 'bid:buyer:one',
      }, buyerOne),
      commands.placeBid(lotId, {
        amountKopecksPerTon: '1900000',
        volumeTons: '100.000000',
        expectedVersion: '3',
        idempotencyKey: 'bid:buyer:two',
      }, buyerTwo),
    ]);
    const fulfilled = simultaneous.filter(
      (item): item is PromiseFulfilledResult<unknown> => item.status === 'fulfilled',
    );
    const rejected = simultaneous.filter(
      (item): item is PromiseRejectedResult => item.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(errorCode(rejected[0].reason)).toBe('AUCTION_STALE_VERSION');

    const firstBid = resultObject(fulfilled[0].value);
    expect(firstBid.lotVersion).toBe('4');
    const firstBidId = String(firstBid.bidId);
    const firstBuyer = String(firstBid.bidId).length > 0
      && simultaneous[0].status === 'fulfilled' ? buyerOne : buyerTwo;
    const secondBuyer = firstBuyer.id === buyerOne.id ? buyerTwo : buyerOne;
    const secondKey = secondBuyer.id === buyerOne.id ? 'bid:buyer:one' : 'bid:buyer:two';

    const equalLaterBid = resultObject(await commands.placeBid(lotId, {
      amountKopecksPerTon: '1900000',
      volumeTons: '100.000000',
      expectedVersion: '4',
      idempotencyKey: secondKey,
    }, secondBuyer));
    expect(equalLaterBid.lotVersion).toBe('5');
    expect(equalLaterBid.bidStatus).toBe('OUTBID');
    expect(equalLaterBid.leaderId).toBe(firstBidId);

    const replay = resultObject(await commands.placeBid(lotId, {
      amountKopecksPerTon: '1900000',
      volumeTons: '100.000000',
      expectedVersion: '3',
      idempotencyKey: firstBuyer.id === buyerOne.id ? 'bid:buyer:one' : 'bid:buyer:two',
    }, firstBuyer));
    expect(replay.duplicate).toBe(true);
    expect(replay.bidId).toBe(firstBidId);

    await expect(commands.placeBid(lotId, {
      amountKopecksPerTon: '1910000',
      volumeTons: '100.000000',
      expectedVersion: '3',
      idempotencyKey: firstBuyer.id === buyerOne.id ? 'bid:buyer:one' : 'bid:buyer:two',
    }, firstBuyer)).rejects.toMatchObject({
      response: { code: 'AUCTION_IDEMPOTENCY_PAYLOAD_MISMATCH' },
    });

    const beforeRollback = await auctionCounts(admin, lotId);
    await admin.outboxEntry.create({
      data: {
        id: 'forced-auction-outbox-collision',
        type: 'forced.collision',
        payload: { test: true },
        status: 'PENDING',
        idempotencyKey: `auction-bid-event:${TENANT}:bid:rollback`,
      },
    });
    await expect(commands.placeBid(lotId, {
      amountKopecksPerTon: '1910000',
      volumeTons: '100.000000',
      expectedVersion: '5',
      idempotencyKey: 'bid:rollback',
    }, firstBuyer)).rejects.toBeDefined();
    const afterRollback = await auctionCounts(admin, lotId);
    expect(afterRollback.bids).toBe(beforeRollback.bids);
    expect(afterRollback.receipts).toBe(beforeRollback.receipts);
    expect(afterRollback.audits).toBe(beforeRollback.audits);
    expect(afterRollback.version).toBe(beforeRollback.version);
    await admin.outboxEntry.delete({ where: { id: 'forced-auction-outbox-collision' } });

    await admin.$executeRawUnsafe(
      `UPDATE auction.lots SET auction_ends_at = clock_timestamp() - interval '1 second' WHERE tenant_id = $1 AND id = $2`,
      TENANT,
      lotId,
    );
    const ended = await lotVersion(admin, lotId);
    expect(ended).toBe('6');

    await expect(commands.placeBid(lotId, {
      amountKopecksPerTon: '1910000',
      volumeTons: '100.000000',
      expectedVersion: ended,
      idempotencyKey: 'bid:late',
    }, firstBuyer)).rejects.toMatchObject({
      response: { code: 'AUCTION_BID_CUTOFF_REACHED' },
    });

    const closeRace = await Promise.allSettled([
      commands.closeLot(lotId, {
        expectedVersion: ended,
        idempotencyKey: 'close:one',
      }, seller),
      commands.closeLot(lotId, {
        expectedVersion: ended,
        idempotencyKey: 'close:two',
      }, seller),
    ]);
    const closeSuccess = closeRace.filter(
      (item): item is PromiseFulfilledResult<unknown> => item.status === 'fulfilled',
    );
    const closeFailure = closeRace.filter(
      (item): item is PromiseRejectedResult => item.status === 'rejected',
    );
    expect(closeSuccess).toHaveLength(1);
    expect(closeFailure).toHaveLength(1);
    expect(['AUCTION_STALE_VERSION', 'AUCTION_ALREADY_CLOSED']).toContain(
      errorCode(closeFailure[0].reason),
    );

    const closeResult = resultObject(closeSuccess[0].value);
    expect(closeResult.winnerBidId).toBe(firstBidId);
    expect(closeResult.amountKopecksPerTon).toBe('1900000');
    const successfulCloseKey = closeRace[0].status === 'fulfilled' ? 'close:one' : 'close:two';

    const restartedApp = new PrismaService();
    await restartedApp.$connect();
    try {
      const restartedCommands = new AuctionCommandService(
        new RlsTransactionService(restartedApp),
      );
      const restartedReplay = resultObject(await restartedCommands.closeLot(lotId, {
        expectedVersion: ended,
        idempotencyKey: successfulCloseKey,
      }, seller));
      expect(restartedReplay.duplicate).toBe(true);
      expect(restartedReplay.awardId).toBe(closeResult.awardId);
      expect(restartedReplay.integrationEventId).toBe(closeResult.integrationEventId);
    } finally {
      await restartedApp.$disconnect();
    }

    const closedCounts = await auctionCounts(admin, lotId);
    expect(closedCounts.winners).toBe(1);
    expect(closedCounts.awards).toBe(1);
    expect(closedCounts.basisEvents).toBe(1);
    expect(closedCounts.basisOutbox).toBe(1);

    const dealDto = {
      commandId: `deal-command:${randomUUID()}`,
      idempotencyKey: 'deal:create:auction:atomic',
      lotId,
      winnerBidId: firstBidId,
    };
    const createdDeal = resultObject(await deals.create(dealDto, seller));
    expect(createdDeal.duplicate).toBe(false);

    const repeatedDelivery = resultObject(await deals.create(dealDto, seller));
    expect(repeatedDelivery.duplicate).toBe(true);
    expect(repeatedDelivery.id).toBe(createdDeal.id);

    await expect(deals.create({
      ...dealDto,
      commandId: `deal-command:${randomUUID()}`,
      idempotencyKey: 'deal:create:auction:atomic:second-delivery',
    }, seller)).rejects.toMatchObject({
      response: { code: 'DEAL_BASIS_ALREADY_CONSUMED' },
    });

    const bind = resultObject(await commands.bindDeal(
      lotId,
      firstBidId,
      String(createdDeal.id),
      seller,
    ));
    expect(bind.duplicate).toBe(false);
    const bindReplay = resultObject(await commands.bindDeal(
      lotId,
      firstBidId,
      String(createdDeal.id),
      seller,
    ));
    expect(bindReplay.duplicate).toBe(true);

    const finalState = await admin.$queryRawUnsafe<Array<Record<string, string>>>(`
      SELECT
        (SELECT count(*)::text FROM public.deals WHERE "tenantId" = '${TENANT}' AND "lotId" = '${lotId}') AS deals,
        (SELECT count(*)::text FROM auction.awards WHERE tenant_id = '${TENANT}' AND lot_id = '${lotId}' AND status = 'DEAL_CREATED') AS bound_awards,
        (SELECT count(*)::text FROM public.integration_events WHERE "adapterName" = 'auction' AND "eventType" = 'DEAL_BASIS_READY' AND "externalId" = '${lotId}:${firstBidId}') AS basis_events
    `);
    expect(finalState[0]).toMatchObject({ deals: '1', bound_awards: '1', basis_events: '1' });
  }, 120_000);
});

async function resetDatabase(admin: PrismaClient): Promise<void> {
  await admin.$executeRawUnsafe(`
    TRUNCATE TABLE
      auction.command_receipts,
      auction.admissions,
      auction.awards,
      auction.bids,
      auction.lots,
      public."outbox_entries",
      public."audit_events",
      public."integration_events",
      public."deal_events",
      public."deal_participants",
      public."deals",
      public."user_orgs",
      public."users",
      public."organizations"
    RESTART IDENTITY CASCADE
  `);
}

async function seedActors(admin: PrismaClient): Promise<void> {
  const organizations = [
    [SELLER_ORG, '7700000001', 'Auction Seller', TENANT],
    [BUYER_ONE_ORG, '7700000002', 'Auction Buyer One', TENANT],
    [BUYER_TWO_ORG, '7700000003', 'Auction Buyer Two', TENANT],
    [BUYER_BLOCKED_ORG, '7700000004', 'Auction Buyer Blocked', TENANT],
    [FOREIGN_ORG, '7700000005', 'Auction Foreign Buyer', FOREIGN_TENANT],
  ];
  for (const [id, inn, name, tenantId] of organizations) {
    await admin.organization.create({
      data: {
        id,
        inn,
        name,
        tenantId,
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
        amlStatus: 'CLEAR',
        sanctionHit: false,
        verifiedAt: new Date(),
      },
    });
  }

  const users = [
    [SELLER_USER, SELLER_ORG, 'FARMER'],
    [ADMIN_USER, SELLER_ORG, 'ADMIN'],
    [BUYER_ONE_USER, BUYER_ONE_ORG, 'BUYER'],
    [BUYER_TWO_USER, BUYER_TWO_ORG, 'BUYER'],
    [BUYER_BLOCKED_USER, BUYER_BLOCKED_ORG, 'BUYER'],
    [FOREIGN_USER, FOREIGN_ORG, 'BUYER'],
  ];
  for (const [id, organizationId, role] of users) {
    await admin.user.create({
      data: {
        id,
        email: `${id}@example.test`,
        passwordHash: 'not-used-in-auction-e2e',
        fullName: id,
        status: 'ACTIVE',
      },
    });
    await admin.userOrg.create({
      data: {
        id: `membership:${id}`,
        userId: id,
        organizationId,
        role,
        isDefault: true,
      },
    });
  }
}

async function lotVersion(admin: PrismaClient, lotId: string): Promise<string> {
  const rows = await admin.$queryRawUnsafe<Array<{ version: bigint }>>(
    'SELECT version FROM auction.lots WHERE tenant_id = $1 AND id = $2',
    TENANT,
    lotId,
  );
  return rows[0].version.toString();
}

async function auctionCounts(admin: PrismaClient, lotId: string) {
  const rows = await admin.$queryRawUnsafe<Array<Record<string, bigint>>>(`
    SELECT
      (SELECT count(*) FROM auction.bids WHERE tenant_id = $1 AND lot_id = $2) AS bids,
      (SELECT count(*) FROM auction.bids WHERE tenant_id = $1 AND lot_id = $2 AND status = 'WINNING') AS winners,
      (SELECT count(*) FROM auction.awards WHERE tenant_id = $1 AND lot_id = $2) AS awards,
      (SELECT count(*) FROM auction.command_receipts WHERE tenant_id = $1 AND result ->> 'lotId' = $2) AS receipts,
      (SELECT count(*) FROM public."audit_events" WHERE "tenantId" = $1 AND "objectType" = 'auction_lot' AND "objectId" = $2) AS audits,
      (SELECT count(*) FROM public."integration_events" WHERE "adapterName" = 'auction' AND "eventType" = 'DEAL_BASIS_READY' AND "externalId" LIKE $2 || ':%') AS "basisEvents",
      (SELECT count(*) FROM public."outbox_entries" WHERE type = 'auction.deal-basis.ready' AND payload ->> 'lotId' = $2) AS "basisOutbox",
      (SELECT version FROM auction.lots WHERE tenant_id = $1 AND id = $2) AS version
  `, TENANT, lotId);
  const row = rows[0];
  return {
    bids: Number(row.bids),
    winners: Number(row.winners),
    awards: Number(row.awards),
    receipts: Number(row.receipts),
    audits: Number(row.audits),
    basisEvents: Number(row.basisEvents),
    basisOutbox: Number(row.basisOutbox),
    version: row.version.toString(),
  };
}
