import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import type { RequestUser } from '../../src/common/types/request-user';
import { PostgresqlDisputeRepository } from '../../src/modules/disputes/postgresql-dispute.repository';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const APP_URL = process.env.DATABASE_URL;
const describePostgresql = ADMIN_URL && APP_URL ? describe : describe.skip;

const TENANT = 'tenant-dispute-party-guard';
const DEAL = 'deal-dispute-party-guard';
const BUYER_ORG = 'org-dispute-party-buyer';
const SELLER_ORG = 'org-dispute-party-seller';
const LAB_ORG = 'org-dispute-party-lab';

function actor(id: string, orgId: string, role: RequestUser['role']): RequestUser {
  return {
    id,
    orgId,
    tenantId: TENANT,
    role,
    email: `${id}@example.test`,
    sessionId: `session:${id}`,
    mfaVerified: true,
  };
}

const buyer = actor('user-dispute-party-buyer', BUYER_ORG, 'BUYER');
const lab = actor('user-dispute-party-lab', LAB_ORG, 'LAB');

describePostgresql('Dispute contractual-party initiator guard', () => {
  let admin: PrismaClient;
  let app: PrismaService;
  let disputes: PostgresqlDisputeRepository;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL! } } });
    app = new PrismaService();
    await Promise.all([admin.$connect(), app.$connect()]);
    disputes = new PostgresqlDisputeRepository(new RlsTransactionService(app));

    await admin.$executeRawUnsafe(`
      TRUNCATE TABLE
        dispute.command_receipts,
        dispute.money_instructions,
        dispute.appeals,
        dispute.evidence,
        dispute.participants,
        dispute.cases,
        settlement.reconciliation_facts,
        settlement.ledger_entries,
        settlement.bank_callbacks,
        settlement.bank_operations,
        settlement.holds,
        settlement.payments,
        settlement.beneficiaries,
        settlement.payment_terms,
        public."outbox_entries",
        public."audit_events",
        public."deal_events",
        public."deal_participants",
        public."deals",
        public."user_orgs",
        public."users",
        public."organizations"
      RESTART IDENTITY CASCADE
    `);

    for (const [id, inn, name] of [
      [BUYER_ORG, '7800000201', 'Party Buyer'],
      [SELLER_ORG, '7800000202', 'Party Seller'],
      [LAB_ORG, '7800000203', 'Neutral Laboratory'],
    ] as const) {
      await admin.organization.create({
        data: {
          id,
          inn,
          name,
          tenantId: TENANT,
          status: 'VERIFIED',
          kycStatus: 'APPROVED',
          amlStatus: 'CLEAR',
          sanctionHit: false,
          verifiedAt: new Date(),
        },
      });
    }

    for (const [user, organizationId] of [
      [buyer, BUYER_ORG],
      [lab, LAB_ORG],
    ] as const) {
      await admin.user.create({
        data: {
          id: user.id,
          email: user.email,
          passwordHash: 'not-used',
          fullName: user.id,
          status: 'ACTIVE',
        },
      });
      await admin.userOrg.create({
        data: {
          id: `membership:${user.id}`,
          userId: user.id,
          organizationId,
          role: user.role,
          isDefault: true,
        },
      });
    }

    await admin.deal.create({
      data: {
        id: DEAL,
        dealNumber: 'DISPUTE-PARTY-001',
        status: 'RESERVED',
        tenantId: TENANT,
        sellerOrgId: SELLER_ORG,
        buyerOrgId: BUYER_ORG,
        totalKopecks: 1_000_000n,
        currency: 'RUB',
        version: 0n,
      },
    });

    for (const [user, organizationId] of [
      [buyer, BUYER_ORG],
      [lab, LAB_ORG],
    ] as const) {
      await admin.dealParticipant.create({
        data: {
          id: `participant:${user.id}`,
          dealId: DEAL,
          tenantId: TENANT,
          organizationId,
          userId: user.id,
          role: user.role,
          accessLevel: 'APPROVE',
          status: 'ACTIVE',
        },
      });
    }
  }, 90_000);

  afterAll(async () => {
    await Promise.all([admin?.$disconnect(), app?.$disconnect()]);
  });

  it('rejects a neutral evidence actor as claim initiator', async () => {
    await expect(disputes.open({
      dealId: DEAL,
      reason: 'QUALITY',
      detail: 'The laboratory may submit evidence but cannot originate a party claim.',
      currency: 'RUB',
      idempotencyKey: 'open:neutral-lab',
    }, lab)).rejects.toMatchObject({
      response: { code: 'DISPUTE_PARTY_INITIATOR_REQUIRED' },
    });

    const cases = await admin.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM dispute.cases WHERE deal_id = '${DEAL}'`,
    );
    expect(Number(cases[0]?.count ?? 0n)).toBe(0);
  });

  it('allows the contractual buyer and derives the seller as respondent', async () => {
    const opened = await disputes.open({
      dealId: DEAL,
      reason: 'QUALITY',
      detail: 'The contractual buyer opens a claim against the contractual seller.',
      currency: 'RUB',
      idempotencyKey: 'open:buyer-party',
    }, buyer) as Record<string, unknown>;

    expect(opened.initiatorOrgId).toBe(BUYER_ORG);
    expect(opened.respondentOrgId).toBe(SELLER_ORG);
  });
});
