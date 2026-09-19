import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * What an advance is allowed to become, against a live PostgreSQL 16 and as the
 * migration owner.
 *
 * Every check here is made from the strongest principal the platform has. A
 * rule the application enforces and the database does not is a rule that lasts
 * until the next script, and an advance is the number two organizations will
 * compare against a bank statement.
 *
 * The case that matters most is the last one: two offsets applied at the same
 * instant against one advance. Every CHECK on the table passes for both, because
 * a CHECK cannot see the other transaction's row. Only the row lock in the guard
 * separates them, so the test uses two independent connections — running both
 * through one client would serialise them at the driver and prove nothing.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-adv.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const OTHER_ORG = `${RUN}.other`;
const USER = `${RUN}.user`;
const MEMBERSHIP = `${RUN}.membership`;
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
    VALUES (${id}, ${dealId}, 'ADVANCE_IN', ${status}, ${amountKopecks},
            ${currency}, 'buyer', 'escrow', ${`${id}.key`}, now(), now())
  `;
  return id;
}

async function recordAdvance(
  id: string,
  options: {
    bankOperationId?: string;
    amountKopecks?: bigint;
    currency?: string;
    receivedAt?: string;
    dealId?: string;
  } = {},
): Promise<void> {
  const {
    bankOperationId = `${id}.op`,
    amountKopecks = 1_000_00n,
    currency = 'RUB',
    receivedAt = '2026-07-10T00:00:00Z',
    dealId = DEAL,
  } = options;
  await prisma.$executeRaw`
    INSERT INTO public."accounting_advances"
      ("id","tenantId","organizationId","dealId","counterpartyOrgId",
       "amountKopecks","currency","receivedAt","bankOperationId",
       "recordedByMembershipId","createdAt","updatedAt")
    VALUES (${id}, ${TENANT}, ${ORG}, ${dealId}, ${OTHER_ORG},
            ${amountKopecks}, ${currency}, ${new Date(receivedAt)},
            ${bankOperationId}, ${MEMBERSHIP}, now(), now())
  `;
}

async function offset(
  id: string,
  advanceId: string,
  amountKopecks: bigint,
  appliedAt = '2026-07-20T00:00:00Z',
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public."accounting_advance_offsets"
      ("id","tenantId","organizationId","advanceId","amountKopecks","appliedAt",
       "reason","idempotencyKey","appliedByMembershipId","createdAt")
    VALUES (${id}, ${TENANT}, ${ORG}, ${advanceId}, ${amountKopecks},
            ${new Date(appliedAt)}, 'offset against delivery', ${`${id}.key`},
            ${MEMBERSHIP}, now())
  `;
}

async function appliedTotal(advanceId: string): Promise<bigint> {
  const rows = await prisma.$queryRaw<{ total: bigint | null }[]>`
    SELECT COALESCE(sum("amountKopecks"), 0) AS total
      FROM public."accounting_advance_offsets"
     WHERE "advanceId" = ${advanceId}
  `;
  return BigInt(rows[0].total ?? 0);
}

describePostgres('an accounting advance', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);

    for (const [org, name, suffix] of [
      [ORG, 'Advances', '1'],
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
    await prisma.$executeRaw`
      INSERT INTO public."users"
        ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
      VALUES (${USER}, ${`${RUN}@industrial.invalid`}, 'hash', 'Advances',
              'ACTIVE', now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      VALUES (${MEMBERSHIP}, ${USER}, ${ORG}, 'ADMIN', true, now())
    `;
    let dealOrdinal = 0;
    for (const deal of [DEAL, OTHER_DEAL]) {
      dealOrdinal += 1;
      await prisma.$executeRaw`
        INSERT INTO public."deals"
          ("id","tenantId","sellerOrgId","buyerOrgId","status","currency",
           "dealNumber","totalKopecks","pricePerTonDec","culture","cropClass",
           "gost","createdAt","updatedAt")
        VALUES (${deal}, ${TENANT}, ${OTHER_ORG}, ${ORG}, 'SIGNED', 'RUB',
                ${`СД-${RUN}-${dealOrdinal}`}, 12500000, 5000.000000,
                'Пшеница', '3', 'ГОСТ 9353-2016', now(), now())
      `;
    }
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."accounting_periods" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_advance_offsets" DISABLE TRIGGER accounting_advance_offsets_append_only`;
    await prisma.$executeRaw`DELETE FROM public."accounting_advance_offsets" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_advance_offsets" ENABLE TRIGGER accounting_advance_offsets_append_only`;
    await prisma.$executeRaw`DELETE FROM public."accounting_advances" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."bank_operations" WHERE "dealId" IN (${DEAL}, ${OTHER_DEAL})`;
    await prisma.$executeRaw`DELETE FROM public."deals" WHERE "id" IN (${DEAL}, ${OTHER_DEAL})`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" = ${USER}`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "tenantId" = ${TENANT}`;
    await prisma.$disconnect();
  });

  describe('is recorded only against money that arrived', () => {
    it('refuses an advance citing a bank operation that does not exist', async () => {
      await expect(
        recordAdvance(`${RUN}.ghost`, { bankOperationId: `${RUN}.nowhere` }),
      ).rejects.toThrow(/bank operation an advance cites does not exist/);
    });

    it('refuses an advance against an unconfirmed operation', async () => {
      await bankOperation(`${RUN}.pending.op`, { status: 'PENDING' });
      await expect(
        recordAdvance(`${RUN}.pending`, { bankOperationId: `${RUN}.pending.op` }),
      ).rejects.toThrow(/confirmed bank operation, not a PENDING one/);
    });

    it('refuses an advance whose amount is not the amount that arrived', async () => {
      await bankOperation(`${RUN}.mismatch.op`, { amountKopecks: 500_00n });
      await expect(
        recordAdvance(`${RUN}.mismatch`, {
          bankOperationId: `${RUN}.mismatch.op`,
          amountKopecks: 1_000_00n,
        }),
      ).rejects.toThrow(/states the amount that actually arrived/);
    });

    it('refuses an advance citing another deal’s operation', async () => {
      await bankOperation(`${RUN}.otherdeal.op`, { dealId: OTHER_DEAL });
      await expect(
        recordAdvance(`${RUN}.otherdeal`, {
          bankOperationId: `${RUN}.otherdeal.op`,
        }),
      ).rejects.toThrow(/belongs to another deal/);
    });

    it('accepts an advance that matches its evidence exactly', async () => {
      await bankOperation(`${RUN}.good.op`);
      await recordAdvance(`${RUN}.good`, { bankOperationId: `${RUN}.good.op` });
      const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) AS count FROM public."accounting_advances"
         WHERE "id" = ${`${RUN}.good`}
      `;
      expect(Number(rows[0].count)).toBe(1);
    });
  });

  describe('cannot be spent twice', () => {
    const ADVANCE = `${RUN}.spend`;

    beforeAll(async () => {
      await bankOperation(`${ADVANCE}.op`, { amountKopecks: 1_000_00n });
      await recordAdvance(ADVANCE, {
        bankOperationId: `${ADVANCE}.op`,
        amountKopecks: 1_000_00n,
      });
    });

    it('accepts partial offsets that stay within it', async () => {
      await offset(`${ADVANCE}.a`, ADVANCE, 400_00n);
      await offset(`${ADVANCE}.b`, ADVANCE, 300_00n);
      expect(await appliedTotal(ADVANCE)).toBe(700_00n);
    });

    it('refuses the offset that would take it past the amount received', async () => {
      await expect(offset(`${ADVANCE}.c`, ADVANCE, 400_00n)).rejects.toThrow(
        /offsets would exceed the advance: 70000 already applied, 40000 requested, 100000 received/,
      );
      expect(await appliedTotal(ADVANCE)).toBe(700_00n);
    });

    it('accepts an offset for exactly the remainder', async () => {
      await offset(`${ADVANCE}.d`, ADVANCE, 300_00n);
      expect(await appliedTotal(ADVANCE)).toBe(1_000_00n);
    });

  });

  describe('applies a retried command once', () => {
    // On its own advance with room left. The first draft of this test reused the
    // advance above, which by then was fully consumed — so the balance guard
    // refused the replay before the unique key could, and the test proved
    // nothing about idempotency while passing for a plausible-looking reason.
    const ADVANCE = `${RUN}.replay`;

    beforeAll(async () => {
      await bankOperation(`${ADVANCE}.op`, { amountKopecks: 500_00n });
      await recordAdvance(ADVANCE, {
        bankOperationId: `${ADVANCE}.op`,
        amountKopecks: 500_00n,
      });
      await offset(`${ADVANCE}.a`, ADVANCE, 100_00n);
    });

    it('refuses a second offset carrying the same idempotency key', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO public."accounting_advance_offsets"
            ("id","tenantId","organizationId","advanceId","amountKopecks",
             "appliedAt","reason","idempotencyKey","appliedByMembershipId",
             "createdAt")
          VALUES (${`${ADVANCE}.again`}, ${TENANT}, ${ORG}, ${ADVANCE}, 100_00,
                  ${new Date('2026-07-21T00:00:00Z')}, 'replay',
                  ${`${ADVANCE}.a.key`}, ${MEMBERSHIP}, now())
        `,
      ).rejects.toThrow(/idempotencyKey/);
      // Refused for the key, not for the balance: there was room for it.
      expect(await appliedTotal(ADVANCE)).toBe(100_00n);
    });
  });

  describe('is append-only once applied', () => {
    const ADVANCE = `${RUN}.frozen`;

    beforeAll(async () => {
      await bankOperation(`${ADVANCE}.op`, { amountKopecks: 200_00n });
      await recordAdvance(ADVANCE, {
        bankOperationId: `${ADVANCE}.op`,
        amountKopecks: 200_00n,
      });
      await offset(`${ADVANCE}.a`, ADVANCE, 150_00n);
    });

    it('refuses an update to an offset', async () => {
      await expect(
        prisma.$executeRaw`
          UPDATE public."accounting_advance_offsets"
             SET "amountKopecks" = 1
           WHERE "id" = ${`${ADVANCE}.a`}
        `,
      ).rejects.toThrow(/append-only: UPDATE is not permitted/);
    });

    it('refuses a delete of an offset', async () => {
      await expect(
        prisma.$executeRaw`
          DELETE FROM public."accounting_advance_offsets"
           WHERE "id" = ${`${ADVANCE}.a`}
        `,
      ).rejects.toThrow(/append-only: DELETE is not permitted/);
    });

    it('refuses reducing the advance below what is already offset', async () => {
      await expect(
        prisma.$executeRaw`
          UPDATE public."accounting_advances"
             SET "amountKopecks" = 100_00, "version" = "version" + 1
           WHERE "id" = ${ADVANCE}
        `,
      ).rejects.toThrow(/cannot be reduced below the 15000 kopecks already offset/);
    });

    it('refuses moving the evidence, currency, deal or arrival time', async () => {
      await expect(
        prisma.$executeRaw`
          UPDATE public."accounting_advances"
             SET "receivedAt" = now(), "version" = "version" + 1
           WHERE "id" = ${ADVANCE}
        `,
      ).rejects.toThrow(/settled once recorded/);
    });

    it('refuses an update that does not advance the version', async () => {
      await expect(
        prisma.$executeRaw`
          UPDATE public."accounting_advances"
             SET "amountKopecks" = 200_00
           WHERE "id" = ${ADVANCE}
        `,
      ).rejects.toThrow(/must advance its version/);
    });
  });

  describe('respects a closed period', () => {
    const CLOSED_START = new Date('2026-05-01T00:00:00.000Z');
    const CLOSED_END = new Date('2026-06-01T00:00:00.000Z');

    beforeAll(async () => {
      const period = `${RUN}.may`;
      await prisma.$executeRaw`
        INSERT INTO public."accounting_periods"
          ("id","tenantId","organizationId","periodStart","periodEnd",
           "openedByMembershipId","createdAt","updatedAt")
        VALUES (${period}, ${TENANT}, ${ORG}, ${CLOSED_START}, ${CLOSED_END},
                ${MEMBERSHIP}, now(), now())
      `;
      await prisma.$executeRaw`
        UPDATE public."accounting_periods"
           SET "status" = 'CLOSING', "version" = "version" + 1
         WHERE "id" = ${period}
      `;
      await prisma.$executeRaw`
        UPDATE public."accounting_periods"
           SET "status" = 'CLOSED',
               "closedByMembershipId" = ${MEMBERSHIP},
               "version" = "version" + 1
         WHERE "id" = ${period}
      `;
    });

    it('refuses an advance that would land in the closed month', async () => {
      await bankOperation(`${RUN}.closed.op`);
      await expect(
        recordAdvance(`${RUN}.closed`, {
          bankOperationId: `${RUN}.closed.op`,
          receivedAt: '2026-05-15T00:00:00Z',
        }),
      ).rejects.toThrow(/period this advance would fall in is closed/);
    });

    it('refuses an offset that would land in the closed month', async () => {
      await bankOperation(`${RUN}.late.op`);
      await recordAdvance(`${RUN}.late`, { bankOperationId: `${RUN}.late.op` });
      await expect(
        offset(`${RUN}.late.a`, `${RUN}.late`, 100_00n, '2026-05-20T00:00:00Z'),
      ).rejects.toThrow(/period this offset would fall in is closed/);
    });
  });

  describe('under concurrency', () => {
    it('lets only one of two simultaneous offsets consume the remainder', async () => {
      const ADVANCE = `${RUN}.race`;
      await bankOperation(`${ADVANCE}.op`, { amountKopecks: 100_00n });
      await recordAdvance(ADVANCE, {
        bankOperationId: `${ADVANCE}.op`,
        amountKopecks: 100_00n,
      });

      // Two independent connections. Running both through one client would let
      // the driver serialise them, and the test would pass without the lock
      // that makes it true.
      const left = new PrismaService();
      const right = new PrismaService();
      await Promise.all([left.$connect(), right.$connect()]);

      const attempt = (client: PrismaService, suffix: string) =>
        client
          .$transaction(async (tx) => {
            await tx.$executeRaw`
              INSERT INTO public."accounting_advance_offsets"
                ("id","tenantId","organizationId","advanceId","amountKopecks",
                 "appliedAt","reason","idempotencyKey","appliedByMembershipId",
                 "createdAt")
              VALUES (${`${ADVANCE}.${suffix}`}, ${TENANT}, ${ORG}, ${ADVANCE},
                      100_00, ${new Date('2026-07-20T00:00:00Z')},
                      'racing offset', ${`${ADVANCE}.${suffix}.key`},
                      ${MEMBERSHIP}, now())
            `;
            // Held open briefly so the other transaction is genuinely inside the
            // window where it could double-spend, rather than merely arriving
            // after this one committed.
            await new Promise((resolve) => setTimeout(resolve, 150));
          })
          .then(() => 'committed' as const)
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            return { refused: message } as const;
          });

      const [a, b] = await Promise.all([attempt(left, 'x'), attempt(right, 'y')]);
      await Promise.all([left.$disconnect(), right.$disconnect()]);

      const outcomes = [a, b];
      const committed = outcomes.filter((entry) => entry === 'committed');
      const refused = outcomes.filter(
        (entry): entry is { refused: string } => entry !== 'committed',
      );

      expect(committed).toHaveLength(1);
      expect(refused).toHaveLength(1);
      expect(refused[0].refused).toMatch(/offsets would exceed the advance/);
      // The point of the whole test: the advance was consumed once.
      expect(await appliedTotal(ADVANCE)).toBe(100_00n);
    });
  });
});
