import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * What a payment and its allocations are allowed to become, against a live
 * PostgreSQL 16 and as the migration owner.
 *
 * The case that matters most is the last one: two allocations taken from one
 * payment at the same instant. Every CHECK on the table passes for both, because
 * a CHECK cannot see the other transaction's row — only the row lock in the
 * guard separates them. It uses two independent connections deliberately;
 * through one client the driver would serialise them and the test would prove
 * nothing.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-pay.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const OTHER_ORG = `${RUN}.other`;
const USER = `${RUN}.user`;
const APPROVER_USER = `${RUN}.user2`;
const MEMBERSHIP = `${RUN}.membership`;
const APPROVER = `${RUN}.membership2`;
const DEAL = `${RUN}.deal`;
const OTHER_DEAL = `${RUN}.deal2`;

let prisma: PrismaService;

async function bankOperation(
  id: string,
  options: {
    dealId?: string;
    amountKopecks?: bigint;
    currency?: string;
    status?: string;
  } = {},
): Promise<string> {
  const {
    dealId = DEAL,
    amountKopecks = 1_000_00n,
    currency = 'RUB',
    status = 'CONFIRMED',
  } = options;
  await prisma.$executeRaw`
    INSERT INTO public."bank_operations"
      ("id","dealId","type","status","amountKopecks","currency",
       "debitAccount","creditAccount","idempotencyKey","createdAt","updatedAt")
    VALUES (${id}, ${dealId}, 'PAYMENT_IN', ${status}, ${amountKopecks},
            ${currency}, 'buyer', 'seller', ${`${id}.key`}, now(), now())
  `;
  return id;
}

async function payment(
  id: string,
  options: {
    bankOperationId?: string;
    amountKopecks?: bigint;
    currency?: string;
    paidAt?: string;
    dealId?: string;
    direction?: string;
  } = {},
): Promise<void> {
  const {
    bankOperationId = `${id}.op`,
    amountKopecks = 1_000_00n,
    currency = 'RUB',
    paidAt = '2026-07-10T00:00:00Z',
    dealId = DEAL,
    direction = 'INCOMING',
  } = options;
  await prisma.$executeRaw`
    INSERT INTO public."accounting_payments"
      ("id","tenantId","organizationId","dealId","counterpartyOrgId","direction",
       "amountKopecks","currency","paidAt","bankOperationId",
       "recordedByMembershipId","idempotencyKey","createdAt","updatedAt")
    VALUES (${id}, ${TENANT}, ${ORG}, ${dealId}, ${OTHER_ORG}, ${direction},
            ${amountKopecks}, ${currency}, ${new Date(paidAt)},
            ${bankOperationId}, ${MEMBERSHIP}, ${`${id}.key`}, now(), now())
  `;
}

async function allocate(
  id: string,
  paymentId: string,
  amountKopecks: bigint,
  target: { dealServiceId?: string; documentVersionId?: string } = {},
  allocatedAt = '2026-07-20T00:00:00Z',
  client: PrismaService = prisma,
): Promise<void> {
  await client.$executeRaw`
    INSERT INTO public."accounting_payment_allocations"
      ("id","tenantId","organizationId","paymentId","documentVersionId",
       "dealServiceId","amountKopecks","allocatedAt","reason","idempotencyKey",
       "allocatedByMembershipId","createdAt")
    VALUES (${id}, ${TENANT}, ${ORG}, ${paymentId},
            ${target.documentVersionId ?? null}, ${target.dealServiceId ?? null},
            ${amountKopecks}, ${new Date(allocatedAt)}, 'against the act',
            ${`${id}.key`}, ${MEMBERSHIP}, now())
  `;
}

/** An approved service line, which is what an allocation may settle. */
async function approvedService(
  id: string,
  amountKopecks: bigint,
  dealId = DEAL,
): Promise<string> {
  const quantity = amountKopecks * 1_000n / 300n;
  await prisma.$executeRaw`
    INSERT INTO public."accounting_deal_services"
      ("id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
       "unit","quantityMilliUnits","rateKopecks","amountKopecks","currency",
       "renderedAt","status","recordedByMembershipId","idempotencyKey",
       "createdAt","updatedAt")
    VALUES (${id}, ${TENANT}, ${ORG}, ${dealId}, ${OTHER_ORG}, 'TRANSSHIPMENT',
            'TON', ${quantity}, 300, ${amountKopecks}, 'RUB',
            '2026-07-05T00:00:00Z', 'RENDERED', ${MEMBERSHIP}, ${`${id}.key`},
            now(), now())
  `;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.current_user_id', ${APPROVER_USER}, true),
             set_config('app.current_org_id', ${ORG}, true),
             set_config('app.current_tenant_id', ${TENANT}, true)
    `;
    await tx.$executeRaw`
      UPDATE public."accounting_deal_services"
         SET "status" = 'APPROVED', "approvedByMembershipId" = ${APPROVER},
             "version" = "version" + 1
       WHERE "id" = ${id}
    `;
  });
  return id;
}

async function allocatedTotal(paymentId: string): Promise<bigint> {
  const rows = await prisma.$queryRaw<{ total: bigint | null }[]>`
    SELECT COALESCE(sum("amountKopecks"), 0) AS total
      FROM public."accounting_payment_allocations"
     WHERE "paymentId" = ${paymentId}
  `;
  return BigInt(rows[0].total ?? 0);
}

describePostgres('an accounting payment', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);

    for (const [org, name, suffix] of [
      [ORG, 'Payments', '1'],
      [OTHER_ORG, 'Counterparty', '2'],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO public."organizations"
          ("id","inn","name","type","status","kycStatus","tenantId",
           "createdAt","updatedAt")
        VALUES (${org}, ${`${inn.slice(0, 9)}${suffix}`}, ${name}, 'LEGAL',
                'VERIFIED', 'VERIFIED', ${TENANT}, now(), now())
      `;
    }
    for (const [user, membership] of [
      [USER, MEMBERSHIP],
      [APPROVER_USER, APPROVER],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO public."users"
          ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
        VALUES (${user}, ${`${user}@industrial.invalid`}, 'hash', 'Payments',
                'ACTIVE', now(), now())
      `;
      await prisma.$executeRaw`
        INSERT INTO public."user_orgs"
          ("id","userId","organizationId","role","isDefault","joinedAt")
        VALUES (${membership}, ${user}, ${ORG}, 'ADMIN', true, now())
      `;
    }
    let ordinal = 0;
    for (const deal of [DEAL, OTHER_DEAL]) {
      ordinal += 1;
      await prisma.$executeRaw`
        INSERT INTO public."deals"
          ("id","tenantId","sellerOrgId","buyerOrgId","status","currency",
           "dealNumber","totalKopecks","pricePerTonDec","culture","cropClass",
           "gost","createdAt","updatedAt")
        VALUES (${deal}, ${TENANT}, ${OTHER_ORG}, ${ORG}, 'SIGNED', 'RUB',
                ${`СД-${RUN}-${ordinal}`}, 12500000, 5000.000000, 'Пшеница',
                '3', 'ГОСТ 9353-2016', now(), now())
      `;
    }
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."accounting_periods" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_payment_allocations" DISABLE TRIGGER accounting_payment_allocations_append_only`;
    await prisma.$executeRaw`DELETE FROM public."accounting_payment_allocations" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_payment_allocations" ENABLE TRIGGER accounting_payment_allocations_append_only`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_payments" DISABLE TRIGGER accounting_payments_guard`;
    await prisma.$executeRaw`DELETE FROM public."accounting_payments" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_payments" ENABLE TRIGGER accounting_payments_guard`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" DISABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."accounting_deal_services" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" ENABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."accounting_advances" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."bank_operations" WHERE "dealId" IN (${DEAL}, ${OTHER_DEAL})`;
    await prisma.$executeRaw`DELETE FROM public."deals" WHERE "id" IN (${DEAL}, ${OTHER_DEAL})`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" IN (${USER}, ${APPROVER_USER})`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "tenantId" = ${TENANT}`;
    await prisma.$disconnect();
  });

  describe('is recorded only against money that moved', () => {
    it('refuses a payment citing an operation that does not exist', async () => {
      await expect(
        payment(`${RUN}.ghost`, { bankOperationId: `${RUN}.nowhere` }),
      ).rejects.toThrow(/bank operation a payment cites does not exist/);
    });

    it('refuses a payment against an unconfirmed operation', async () => {
      await bankOperation(`${RUN}.pending.op`, { status: 'PENDING' });
      await expect(
        payment(`${RUN}.pending`, { bankOperationId: `${RUN}.pending.op` }),
      ).rejects.toThrow(/confirmed bank operation, not a PENDING one/);
    });

    it('refuses a payment whose amount is not the amount that moved', async () => {
      await bankOperation(`${RUN}.mismatch.op`, { amountKopecks: 500_00n });
      await expect(
        payment(`${RUN}.mismatch`, {
          bankOperationId: `${RUN}.mismatch.op`,
          amountKopecks: 1_000_00n,
        }),
      ).rejects.toThrow(/states the amount that actually moved/);
    });

    it('refuses a payment citing another deal’s operation', async () => {
      await bankOperation(`${RUN}.otherdeal.op`, { dealId: OTHER_DEAL });
      await expect(
        payment(`${RUN}.otherdeal`, {
          bankOperationId: `${RUN}.otherdeal.op`,
        }),
      ).rejects.toThrow(/belongs to another deal/);
    });

    it('accepts a payment that matches its evidence exactly', async () => {
      await bankOperation(`${RUN}.good.op`);
      await payment(`${RUN}.good`, { bankOperationId: `${RUN}.good.op` });
      const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) AS count FROM public."accounting_payments"
         WHERE "id" = ${`${RUN}.good`}
      `;
      expect(Number(rows[0].count)).toBe(1);
    });
  });

  describe('counts one transfer once', () => {
    it('refuses a payment citing an operation already recorded as an advance', async () => {
      // The bank moved the money once. Recorded as both, it would settle a debt
      // twice on paper while the statement shows one transfer.
      await bankOperation(`${RUN}.dual.op`);
      await prisma.$executeRaw`
        INSERT INTO public."accounting_advances"
          ("id","tenantId","organizationId","dealId","counterpartyOrgId",
           "amountKopecks","currency","receivedAt","bankOperationId",
           "recordedByMembershipId","createdAt","updatedAt")
        VALUES (${`${RUN}.dual.adv`}, ${TENANT}, ${ORG}, ${DEAL}, ${OTHER_ORG},
                100000, 'RUB', '2026-07-01T00:00:00Z', ${`${RUN}.dual.op`},
                ${MEMBERSHIP}, now(), now())
      `;
      await expect(
        payment(`${RUN}.dual`, { bankOperationId: `${RUN}.dual.op` }),
      ).rejects.toThrow(/already recorded as an advance/);
    });

    it('refuses a second payment citing the same operation', async () => {
      await bankOperation(`${RUN}.twice.op`);
      await payment(`${RUN}.twice.a`, { bankOperationId: `${RUN}.twice.op` });
      await expect(
        payment(`${RUN}.twice.b`, { bankOperationId: `${RUN}.twice.op` }),
        // The unique index, not the guard: one operation, one payment.
      ).rejects.toThrow(/"organizationId", "bankOperationId".*already exists/);
    });
  });

  describe('cannot be allocated past what was paid', () => {
    const PAYMENT = `${RUN}.spend`;

    beforeAll(async () => {
      await bankOperation(`${PAYMENT}.op`, { amountKopecks: 1_000_00n });
      await payment(PAYMENT, {
        bankOperationId: `${PAYMENT}.op`,
        amountKopecks: 1_000_00n,
      });
    });

    it('accepts allocations that fit', async () => {
      const service = await approvedService(`${PAYMENT}.svc.a`, 600_00n);
      await allocate(`${PAYMENT}.all.a`, PAYMENT, 600_00n, {
        dealServiceId: service,
      });
      expect(await allocatedTotal(PAYMENT)).toBe(600_00n);
    });

    it('refuses the kopeck that would take it past the payment', async () => {
      const service = await approvedService(`${PAYMENT}.svc.b`, 500_00n);
      await expect(
        allocate(`${PAYMENT}.all.b`, PAYMENT, 400_01n, {
          dealServiceId: service,
        }),
      ).rejects.toThrow(/past the 100000 kopecks that were paid/);
      expect(await allocatedTotal(PAYMENT)).toBe(600_00n);
    });

    it('accepts exactly the remainder', async () => {
      const service = await approvedService(`${PAYMENT}.svc.c`, 400_00n);
      await allocate(`${PAYMENT}.all.c`, PAYMENT, 400_00n, {
        dealServiceId: service,
      });
      expect(await allocatedTotal(PAYMENT)).toBe(1_000_00n);
    });
  });

  describe('cannot settle an obligation past what it is for', () => {
    it('refuses more than the service line charges', async () => {
      await bankOperation(`${RUN}.over.op`, { amountKopecks: 1_000_00n });
      await payment(`${RUN}.over`, {
        bankOperationId: `${RUN}.over.op`,
        amountKopecks: 1_000_00n,
      });
      const service = await approvedService(`${RUN}.over.svc`, 300_00n);
      await expect(
        allocate(`${RUN}.over.all`, `${RUN}.over`, 300_01n, {
          dealServiceId: service,
        }),
      ).rejects.toThrow(/past the 30000 kopecks the obligation is for/);
    });

    it('refuses settling a line nobody approved', async () => {
      await prisma.$executeRaw`
        INSERT INTO public."accounting_deal_services"
          ("id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
           "unit","quantityMilliUnits","rateKopecks","amountKopecks","currency",
           "renderedAt","status","recordedByMembershipId","idempotencyKey",
           "createdAt","updatedAt")
        VALUES (${`${RUN}.unapproved.svc`}, ${TENANT}, ${ORG}, ${DEAL},
                ${OTHER_ORG}, 'TRANSSHIPMENT', 'TON', 100000, 300, 30000, 'RUB',
                '2026-07-05T00:00:00Z', 'RENDERED', ${MEMBERSHIP},
                ${`${RUN}.unapproved.svc.key`}, now(), now())
      `;
      await expect(
        allocate(`${RUN}.unapproved.all`, `${RUN}.over`, 100_00n, {
          dealServiceId: `${RUN}.unapproved.svc`,
        }),
      ).rejects.toThrow(/only an approved service line is settled/);
    });

    it('refuses an allocation naming neither obligation', async () => {
      await expect(
        allocate(`${RUN}.none.all`, `${RUN}.over`, 100_00n, {}),
      ).rejects.toThrow(/one_target/);
    });
  });

  describe('is append-only', () => {
    it('refuses editing an allocation, even as the owner', async () => {
      await expect(
        prisma.$executeRaw`
          UPDATE public."accounting_payment_allocations"
             SET "amountKopecks" = 1
           WHERE "paymentId" = ${`${RUN}.spend`}
        `,
      ).rejects.toThrow(/append-only/);
    });

    it('refuses removing one', async () => {
      await expect(
        prisma.$executeRaw`
          DELETE FROM public."accounting_payment_allocations"
           WHERE "paymentId" = ${`${RUN}.spend`}
        `,
      ).rejects.toThrow(/append-only/);
    });

    it('refuses deleting the payment itself', async () => {
      await expect(
        prisma.$executeRaw`
          DELETE FROM public."accounting_payments" WHERE "id" = ${`${RUN}.spend`}
        `,
      ).rejects.toThrow(/never deleted: the money moved/);
    });
  });

  describe('respects a closed period', () => {
    beforeAll(async () => {
      await prisma.$executeRaw`
        INSERT INTO public."accounting_periods"
          ("id","tenantId","organizationId","periodStart","periodEnd","status",
           "openedByMembershipId","createdAt","updatedAt")
        VALUES (${`${RUN}.period`}, ${TENANT}, ${ORG}, '2026-04-01T00:00:00Z',
                '2026-05-01T00:00:00Z', 'OPEN', ${MEMBERSHIP}, now(), now())
      `;
      // Through CLOSING, and the closer is named only on the step that closes:
      // the periods contour refuses a closure that is half-stated.
      await prisma.$executeRaw`
        UPDATE public."accounting_periods"
           SET "status" = 'CLOSING', "version" = "version" + 1
         WHERE "id" = ${`${RUN}.period`}
      `;
      await prisma.$executeRaw`
        UPDATE public."accounting_periods"
           SET "status" = 'CLOSED', "closedByMembershipId" = ${MEMBERSHIP},
               "version" = "version" + 1
         WHERE "id" = ${`${RUN}.period`}
      `;
    });

    it('refuses a payment that would land in the closed month', async () => {
      await bankOperation(`${RUN}.closed.op`);
      await expect(
        payment(`${RUN}.closed`, {
          bankOperationId: `${RUN}.closed.op`,
          paidAt: '2026-04-20T00:00:00Z',
        }),
      ).rejects.toThrow(/period this payment would fall in is closed/);
    });

    it('refuses an allocation that would land there', async () => {
      const service = await approvedService(`${RUN}.closed.svc`, 100_00n);
      await expect(
        allocate(
          `${RUN}.closed.all`,
          `${RUN}.over`,
          100_00n,
          { dealServiceId: service },
          '2026-04-20T00:00:00Z',
        ),
      ).rejects.toThrow(/period this allocation would fall in is closed/);
    });
  });

  describe('under concurrency', () => {
    it('lets only one of two simultaneous allocations consume the remainder', async () => {
      await bankOperation(`${RUN}.race.op`, { amountKopecks: 100_00n });
      await payment(`${RUN}.race`, {
        bankOperationId: `${RUN}.race.op`,
        amountKopecks: 100_00n,
      });
      const first = await approvedService(`${RUN}.race.svc.a`, 100_00n);
      const second = await approvedService(`${RUN}.race.svc.b`, 100_00n);

      // Two independent clients: through one, the driver would serialise them
      // and both would pass a check only one can actually satisfy.
      const left = new PrismaService();
      const right = new PrismaService();
      await Promise.all([left.$connect(), right.$connect()]);

      const attempt = async (
        client: PrismaService,
        id: string,
        serviceId: string,
      ) =>
        client.$transaction(async (tx) => {
          await allocate(
            id,
            `${RUN}.race`,
            100_00n,
            { dealServiceId: serviceId },
            '2026-07-20T00:00:00Z',
            tx as unknown as PrismaService,
          );
          // Held open so both transactions are genuinely in flight.
          await new Promise((resolve) => setTimeout(resolve, 150));
        });

      const outcomes = await Promise.allSettled([
        attempt(left, `${RUN}.race.a`, first),
        attempt(right, `${RUN}.race.b`, second),
      ]);
      await Promise.all([left.$disconnect(), right.$disconnect()]);

      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      expect(await allocatedTotal(`${RUN}.race`)).toBe(100_00n);
    });
  });
});
