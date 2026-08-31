import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * What a service line is allowed to become, against a live PostgreSQL 16 and as
 * the migration owner.
 *
 * Every check here is made from the strongest principal the platform has. A rule
 * the application enforces and the database does not is a rule that lasts until
 * the next script, and a service charge is a number two organizations will
 * compare against an act.
 *
 * The two that matter most are the arithmetic and the second person: a total that
 * does not follow from the quantity and the rate, and an approval by the same
 * membership that raised the line. Both are refused here by the database itself,
 * with no application code in the path at all.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-svc.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const OTHER_ORG = `${RUN}.other`;
const RECORDER_USER = `${RUN}.user1`;
const APPROVER_USER = `${RUN}.user2`;
const RECORDER = `${RUN}.membership1`;
const APPROVER = `${RUN}.membership2`;
const DEAL = `${RUN}.deal`;

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_FROM = new Date('2026-06-01T00:00:00.000Z');
const WINDOW_TO = new Date('2026-06-11T00:00:00.000Z');
const RENDERED_AT = new Date('2026-06-11T00:00:00.000Z');

let prisma: PrismaService;

interface LineOptions {
  kind?: string;
  unit?: string;
  quantityMilliUnits?: bigint;
  tonnageMilliTons?: bigint | null;
  periodFrom?: Date | null;
  periodTo?: Date | null;
  rateKopecks?: bigint;
  amountKopecks?: bigint;
  currency?: string;
  renderedAt?: Date;
  status?: string;
  counterpartyOrgId?: string;
  reversesServiceId?: string | null;
}

/** The same half-up expression the CHECK constraint carries. */
function amountFor(quantityMilliUnits: bigint, rateKopecks: bigint): bigint {
  return (quantityMilliUnits * rateKopecks + 500n) / 1000n;
}

async function record(id: string, options: LineOptions = {}): Promise<void> {
  const {
    kind = 'STORAGE',
    unit = 'TON_DAY',
    quantityMilliUnits = 400_000n,
    tonnageMilliTons = 40_000n,
    periodFrom = WINDOW_FROM,
    periodTo = WINDOW_TO,
    rateKopecks = 300n,
    currency = 'RUB',
    renderedAt = RENDERED_AT,
    status = 'RENDERED',
    counterpartyOrgId = OTHER_ORG,
    reversesServiceId = null,
  } = options;
  const amountKopecks =
    options.amountKopecks ?? amountFor(quantityMilliUnits, rateKopecks);

  await prisma.$executeRaw`
    INSERT INTO public."accounting_deal_services"
      ("id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
       "unit","quantityMilliUnits","tonnageMilliTons","periodFrom","periodTo",
       "rateKopecks","amountKopecks","currency","renderedAt","status",
       "recordedByMembershipId","reversesServiceId","idempotencyKey",
       "createdAt","updatedAt")
    VALUES (${id}, ${TENANT}, ${ORG}, ${DEAL}, ${counterpartyOrgId}, ${kind},
            ${unit}, ${quantityMilliUnits}, ${tonnageMilliTons}, ${periodFrom},
            ${periodTo}, ${rateKopecks}, ${amountKopecks}, ${currency},
            ${renderedAt}, ${status}, ${RECORDER}, ${reversesServiceId},
            ${`${id}.key`}, now(), now())
  `;
}

/**
 * A statement run with an identity the row policies and the guard can resolve.
 *
 * Inside a transaction on purpose: `set_config` with the transaction-local flag
 * is scoped to it, and the client's pool would otherwise be free to send the
 * next statement down a different connection where the identity was never set.
 */
async function asUser(userId: string, sql: (tx: PrismaService) => Promise<void>) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.current_user_id', ${userId}, true),
             set_config('app.current_org_id', ${ORG}, true),
             set_config('app.current_tenant_id', ${TENANT}, true)
    `;
    await sql(tx as unknown as PrismaService);
  });
}

async function approve(id: string, userId: string, membershipId: string) {
  await asUser(userId, async (tx) => {
    await tx.$executeRaw`
      UPDATE public."accounting_deal_services"
         SET "status" = 'APPROVED',
             "approvedByMembershipId" = ${membershipId},
             "version" = "version" + 1,
             "updatedAt" = now()
       WHERE "id" = ${id}
    `;
  });
}

async function statusOf(id: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ status: string }[]>`
    SELECT "status" FROM public."accounting_deal_services" WHERE "id" = ${id}
  `;
  return rows[0]?.status ?? 'MISSING';
}

describePostgres('a service line on a deal', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);

    for (const [org, name, suffix] of [
      [ORG, 'Services', '1'],
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

    for (const [user, membership, name] of [
      [RECORDER_USER, RECORDER, 'Recorder'],
      [APPROVER_USER, APPROVER, 'Approver'],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO public."users"
          ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
        VALUES (${user}, ${`${user}@industrial.invalid`}, 'hash', ${name},
                'ACTIVE', now(), now())
      `;
      await prisma.$executeRaw`
        INSERT INTO public."user_orgs"
          ("id","userId","organizationId","role","isDefault","joinedAt")
        VALUES (${membership}, ${user}, ${ORG}, 'ADMIN', true, now())
      `;
    }

    await prisma.$executeRaw`
      INSERT INTO public."deals"
        ("id","tenantId","sellerOrgId","buyerOrgId","status","currency",
         "dealNumber","totalKopecks","pricePerTonDec","culture","cropClass",
         "gost","createdAt","updatedAt")
      VALUES (${DEAL}, ${TENANT}, ${OTHER_ORG}, ${ORG}, 'SIGNED', 'RUB',
              ${`СД-${RUN}`}, 12500000, 5000.000000, 'Пшеница', '3',
              'ГОСТ 9353-2016', now(), now())
    `;
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."accounting_periods" WHERE "organizationId" = ${ORG}`;
    // The guard refuses every delete, including the owner's. Disabling it for
    // the teardown is deliberate and local: the alternative is leaving fixture
    // rows behind in a shared database, and the refusal is proved by a test of
    // its own a few blocks up.
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" DISABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."accounting_deal_services" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" ENABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."accounting_document_versions" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_documents" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."deals" WHERE "id" = ${DEAL}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" IN (${RECORDER_USER}, ${APPROVER_USER})`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "tenantId" = ${TENANT}`;
    await prisma.$disconnect();
  });

  describe('is priced by its own terms', () => {
    it('accepts a storage line whose ton-days follow from its window', async () => {
      await record(`${RUN}.good`);
      const rows = await prisma.$queryRaw<{ amountKopecks: bigint }[]>`
        SELECT "amountKopecks" FROM public."accounting_deal_services"
         WHERE "id" = ${`${RUN}.good`}
      `;
      // 40 tons × 10 days × 3 roubles.
      expect(rows[0].amountKopecks).toBe(120_000n);
    });

    it('refuses a total that does not follow from the quantity and the rate', async () => {
      await expect(
        record(`${RUN}.inflated`, { amountKopecks: 999_999n }),
      ).rejects.toThrow(/amount_follows_terms/);
    });

    it('refuses a total a kopeck off, in either direction', async () => {
      const honest = amountFor(400_000n, 300n);
      await expect(
        record(`${RUN}.off.up`, { amountKopecks: honest + 1n }),
      ).rejects.toThrow(/amount_follows_terms/);
      await expect(
        record(`${RUN}.off.down`, { amountKopecks: honest - 1n }),
      ).rejects.toThrow(/amount_follows_terms/);
    });

    // A quantity or a rate of zero makes the amount zero too, so three
    // constraints all bar the row and PostgreSQL does not promise which reports
    // first. What is asserted is that it is refused as a check violation; which
    // of the three caught it is not a fact worth pinning a test to.
    it('refuses a quantity of nothing', async () => {
      await expect(
        record(`${RUN}.zero`, {
          quantityMilliUnits: 0n,
          tonnageMilliTons: 0n,
        }),
      ).rejects.toThrow(/violates check constraint/);
    });

    it('refuses a free service', async () => {
      await expect(
        record(`${RUN}.free`, { rateKopecks: 0n }),
      ).rejects.toThrow(/violates check constraint/);
    });

    it('refuses a quantity beyond the range the arithmetic is safe in', async () => {
      // Above this the product with the rate would leave 64-bit range, and an
      // overflow error says nothing about which field was implausible.
      await expect(
        record(`${RUN}.huge`, {
          quantityMilliUnits: 10_000_000_001n,
          tonnageMilliTons: 1_000_000_000_1n / 10n,
        }),
      ).rejects.toThrow(/quantity_is_positive|ton_days_follow_window/);
    });
  });

  describe('matches its unit to its kind', () => {
    it('refuses storage charged by the ton', async () => {
      // Shaped so that only the kind-to-unit constraint can fail: a TON line
      // carries no window and no tonnage, which is what the other constraints
      // in this area look at.
      await expect(
        record(`${RUN}.unitmix`, {
          unit: 'TON',
          tonnageMilliTons: null,
          periodFrom: null,
          periodTo: null,
        }),
      ).rejects.toThrow(/unit_follows_kind/);
    });

    it('refuses a kind the contour does not know', async () => {
      await expect(
        record(`${RUN}.kind`, { kind: 'ASTROLOGY' }),
      ).rejects.toThrow(/kind_known/);
    });

    it('refuses storage without the window it was stored for', async () => {
      await expect(
        record(`${RUN}.nowindow`, { periodFrom: null, periodTo: null }),
      ).rejects.toThrow(/window_belongs_to_storage/);
    });

    it('refuses storage without a tonnage', async () => {
      await expect(
        record(`${RUN}.notonnage`, { tonnageMilliTons: null }),
      ).rejects.toThrow(/tonnage_belongs_to_storage/);
    });

    it('refuses a window on a service charged by the ton', async () => {
      await expect(
        record(`${RUN}.tonwindow`, {
          kind: 'TRANSSHIPMENT',
          unit: 'TON',
          quantityMilliUnits: 40_000n,
          tonnageMilliTons: null,
          periodFrom: null,
          periodTo: null,
          rateKopecks: 15_000n,
        }).then(() => 'accepted'),
      ).resolves.toBe('accepted');
      // ...and the same line with a window is refused.
      await expect(
        record(`${RUN}.tonwindow2`, {
          kind: 'TRANSSHIPMENT',
          unit: 'TON',
          quantityMilliUnits: 40_000n,
          tonnageMilliTons: null,
          rateKopecks: 15_000n,
          periodFrom: WINDOW_FROM,
          periodTo: WINDOW_TO,
        }),
      ).rejects.toThrow(/window_belongs_to_storage/);
    });

    it('refuses half a weighing', async () => {
      await expect(
        record(`${RUN}.halfop`, {
          kind: 'WEIGHING',
          unit: 'OPERATION',
          quantityMilliUnits: 1_500n,
          tonnageMilliTons: null,
          periodFrom: null,
          periodTo: null,
          rateKopecks: 50_000n,
        }),
      ).rejects.toThrow(/operations_are_whole/);
    });
  });

  describe('cannot bill ton-days its window does not hold', () => {
    it('refuses the same window billed for more tonnage', async () => {
      await expect(
        record(`${RUN}.moretons`, { quantityMilliUnits: 500_000n }),
      ).rejects.toThrow(/ton_days_follow_window/);
    });

    it('refuses the same tonnage billed for more days', async () => {
      await expect(
        record(`${RUN}.moredays`, {
          periodTo: new Date(WINDOW_FROM.getTime() + 5 * DAY),
        }),
      ).rejects.toThrow(/ton_days_follow_window/);
    });

    it('refuses a window that is not a whole number of days', async () => {
      await expect(
        record(`${RUN}.partday`, {
          periodTo: new Date(WINDOW_FROM.getTime() + 10 * DAY + 3_600_000),
        }),
      ).rejects.toThrow(/window_is_whole_days|ton_days_follow_window/);
    });

    it('refuses a window that ends before it starts', async () => {
      await expect(
        record(`${RUN}.backwards`, {
          periodFrom: WINDOW_TO,
          periodTo: WINDOW_FROM,
        }),
      ).rejects.toThrow(/window_is_whole_days|ton_days_follow_window/);
    });
  });

  describe('is a charge to somebody else', () => {
    it('refuses a service to the organization itself', async () => {
      await expect(
        record(`${RUN}.self`, { counterpartyOrgId: ORG }),
      ).rejects.toThrow(/counterparty_is_other/);
    });

    it('refuses a currency the contour does not settle in', async () => {
      await expect(
        record(`${RUN}.currency`, { currency: 'XAU' }),
      ).rejects.toThrow(/currency_known/);
    });
  });

  describe('needs a second person to approve it', () => {
    it('refuses a line inserted already approved', async () => {
      await expect(
        record(`${RUN}.preapproved`, { status: 'APPROVED' }),
      ).rejects.toThrow(/recorded as RENDERED and approved afterwards/);
    });

    it('refuses approval by the membership that recorded it', async () => {
      await record(`${RUN}.self.approve`);
      await expect(
        approve(`${RUN}.self.approve`, RECORDER_USER, RECORDER),
      ).rejects.toThrow(/does not approve it/);
      expect(await statusOf(`${RUN}.self.approve`)).toBe('RENDERED');
    });

    it('refuses an approval attributed to somebody other than the approver', async () => {
      await record(`${RUN}.forged`);
      await expect(
        // The session is the approver; the command names the recorder.
        approve(`${RUN}.forged`, APPROVER_USER, RECORDER),
      ).rejects.toThrow(/names the approving membership itself/);
    });

    it('refuses approval with no membership in the organization at all', async () => {
      await record(`${RUN}.nomember`);
      await expect(
        prisma.$executeRaw`
          UPDATE public."accounting_deal_services"
             SET "status" = 'APPROVED',
                 "approvedByMembershipId" = ${APPROVER},
                 "version" = "version" + 1
           WHERE "id" = ${`${RUN}.nomember`}
        `,
      ).rejects.toThrow(/requires an active membership/);
    });

    it('accepts approval by a second person and stamps the time itself', async () => {
      await record(`${RUN}.approved`);
      const before = new Date();
      await approve(`${RUN}.approved`, APPROVER_USER, APPROVER);
      const rows = await prisma.$queryRaw<
        { status: string; approvedAt: Date; approvedByMembershipId: string }[]
      >`
        SELECT "status", "approvedAt", "approvedByMembershipId"
          FROM public."accounting_deal_services"
         WHERE "id" = ${`${RUN}.approved`}
      `;
      expect(rows[0].status).toBe('APPROVED');
      expect(rows[0].approvedByMembershipId).toBe(APPROVER);
      expect(rows[0].approvedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1_000,
      );
    });

    it('overwrites an antedated approval time with its own clock', async () => {
      await record(`${RUN}.antedated`);
      await asUser(APPROVER_USER, async (tx) => {
        await tx.$executeRaw`
          UPDATE public."accounting_deal_services"
             SET "status" = 'APPROVED',
                 "approvedByMembershipId" = ${APPROVER},
                 "approvedAt" = '2020-01-01T00:00:00Z',
                 "version" = "version" + 1
           WHERE "id" = ${`${RUN}.antedated`}
        `;
      });
      const rows = await prisma.$queryRaw<{ approvedAt: Date }[]>`
        SELECT "approvedAt" FROM public."accounting_deal_services"
         WHERE "id" = ${`${RUN}.antedated`}
      `;
      // An approval time the caller picks is an approval time the caller can
      // move into a month that is still open.
      expect(rows[0].approvedAt.getUTCFullYear()).toBeGreaterThan(2020);
    });
  });

  describe('is final once decided', () => {
    it('refuses approving an approved line again', async () => {
      await record(`${RUN}.twice`);
      await approve(`${RUN}.twice`, APPROVER_USER, APPROVER);
      await expect(
        approve(`${RUN}.twice`, APPROVER_USER, APPROVER),
      ).rejects.toThrow(/is decided/);
    });

    it('refuses reviving a rejected line', async () => {
      await record(`${RUN}.rejected`);
      await asUser(RECORDER_USER, async (tx) => {
        await tx.$executeRaw`
          UPDATE public."accounting_deal_services"
             SET "status" = 'REJECTED', "version" = "version" + 1
           WHERE "id" = ${`${RUN}.rejected`}
        `;
      });
      await expect(
        approve(`${RUN}.rejected`, APPROVER_USER, APPROVER),
      ).rejects.toThrow(/is final/);
    });

    it('refuses repricing a line', async () => {
      await record(`${RUN}.reprice`);
      await expect(
        prisma.$executeRaw`
          UPDATE public."accounting_deal_services"
             SET "rateKopecks" = 1, "amountKopecks" = 400,
                 "version" = "version" + 1
           WHERE "id" = ${`${RUN}.reprice`}
        `,
      ).rejects.toThrow(/terms of a service line are settled/);
    });

    it('refuses an update that does not advance the version', async () => {
      await record(`${RUN}.version`);
      await expect(
        prisma.$executeRaw`
          UPDATE public."accounting_deal_services"
             SET "status" = 'REJECTED'
           WHERE "id" = ${`${RUN}.version`}
        `,
      ).rejects.toThrow(/must advance its version/);
    });

    it('refuses deleting a line, even as the owner', async () => {
      await record(`${RUN}.delete`);
      await expect(
        prisma.$executeRaw`
          DELETE FROM public."accounting_deal_services"
           WHERE "id" = ${`${RUN}.delete`}
        `,
      ).rejects.toThrow(/never deleted, only reversed/);
    });
  });

  describe('goes into an act once, and only when approved', () => {
    const DOCUMENT = `${RUN}.doc`;
    const VERSION_ONE = `${RUN}.doc.v1`;
    const VERSION_TWO = `${RUN}.doc.v2`;

    beforeAll(async () => {
      await prisma.$executeRaw`
        INSERT INTO public."accounting_documents"
          ("id","tenantId","organizationId","documentType","documentNumber",
           "status","createdByMembershipId","createdAt","updatedAt")
        VALUES (${DOCUMENT}, ${TENANT}, ${ORG}, 'ACT', ${`АКТ-${RUN}`},
                'ISSUED', ${RECORDER}, now(), now())
      `;
      let ordinal = 0;
      for (const version of [VERSION_ONE, VERSION_TWO]) {
        ordinal += 1;
        await prisma.$executeRaw`
          INSERT INTO public."accounting_document_versions"
            ("id","tenantId","organizationId","documentId","versionNumber",
             "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
          VALUES (${version}, ${TENANT}, ${ORG}, ${DOCUMENT}, ${ordinal},
                  ${`${ordinal}`}||repeat('0',63), '{}'::jsonb, ${RECORDER}, now())
        `;
      }
    });

    async function bind(serviceId: string, versionId: string) {
      await prisma.$executeRaw`
        UPDATE public."accounting_deal_services"
           SET "documentVersionId" = ${versionId}, "version" = "version" + 1
         WHERE "id" = ${serviceId}
      `;
    }

    it('refuses binding a line nobody has approved', async () => {
      const line = `${RUN}.bind.unapproved`;
      await record(line);
      await expect(bind(line, VERSION_ONE)).rejects.toThrow(
        /only an approved service line goes into an act/,
      );
    });

    it('accepts binding an approved line', async () => {
      const line = `${RUN}.bind.approved`;
      await record(line);
      await approve(line, APPROVER_USER, APPROVER);
      await bind(line, VERSION_ONE);
      const rows = await prisma.$queryRaw<{ documentVersionId: string }[]>`
        SELECT "documentVersionId" FROM public."accounting_deal_services"
         WHERE "id" = ${line}
      `;
      expect(rows[0].documentVersionId).toBe(VERSION_ONE);
    });

    it('refuses rebinding a line to another act', async () => {
      // The act has been issued with this line in it. Re-pointing the line
      // leaves the issued document describing something else.
      const line = `${RUN}.bind.rebound`;
      await record(line);
      await approve(line, APPROVER_USER, APPROVER);
      await bind(line, VERSION_ONE);
      await expect(bind(line, VERSION_TWO)).rejects.toThrow(
        /already bound to an act is not rebound/,
      );
    });
  });

  describe('is corrected by a reversal, never an edit', () => {
    const ORIGINAL = `${RUN}.original`;

    beforeAll(async () => {
      await record(ORIGINAL);
      await approve(ORIGINAL, APPROVER_USER, APPROVER);
    });

    it('accepts a reversal that repeats the original exactly', async () => {
      await record(`${RUN}.reversal`, { reversesServiceId: ORIGINAL });
      const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) AS count FROM public."accounting_deal_services"
         WHERE "reversesServiceId" = ${ORIGINAL}
      `;
      expect(Number(rows[0].count)).toBe(1);
    });

    it('refuses a second reversal of the same line', async () => {
      await expect(
        record(`${RUN}.reversal2`, { reversesServiceId: ORIGINAL }),
      ).rejects.toThrow(/reversesServiceId/);
    });

    it('refuses a reversal that cancels a large charge with a small one', async () => {
      const other = `${RUN}.original2`;
      await record(other);
      await approve(other, APPROVER_USER, APPROVER);
      await expect(
        record(`${RUN}.cheap.reversal`, {
          reversesServiceId: other,
          quantityMilliUnits: 40_000n,
          tonnageMilliTons: 4_000n,
          rateKopecks: 300n,
        }),
      ).rejects.toThrow(/same deal, kind, unit, currency, quantity, rate and amount/);
    });

    it('refuses reversing a line nobody approved', async () => {
      const unapproved = `${RUN}.unapproved`;
      await record(unapproved);
      await expect(
        record(`${RUN}.premature.reversal`, { reversesServiceId: unapproved }),
      ).rejects.toThrow(/only an approved service line is reversed/);
    });

    it('refuses reversing a reversal', async () => {
      const reversal = `${RUN}.reversal`;
      await approve(reversal, APPROVER_USER, APPROVER);
      await expect(
        record(`${RUN}.double.reversal`, { reversesServiceId: reversal }),
      ).rejects.toThrow(/not itself reversed/);
    });

    it('refuses a reversal of a line that does not exist', async () => {
      await expect(
        record(`${RUN}.ghost.reversal`, {
          reversesServiceId: `${RUN}.nowhere`,
        }),
      ).rejects.toThrow(/does not exist|foreign key/);
    });
  });

  describe('respects a closed period', () => {
    const IN_MAY = new Date('2026-05-20T00:00:00.000Z');
    const IN_APRIL = new Date('2026-04-20T00:00:00.000Z');

    /**
     * A period, opened open and closed through CLOSING.
     *
     * The periods contour refuses a period inserted closed and refuses to reopen
     * a closed one, so each of these tests closes a month of its own. Driving it
     * through the real transitions is the point: a fixture that wrote CLOSED
     * directly would be testing a state the platform cannot reach.
     */
    async function closeMonth(id: string, start: Date, finish: Date) {
      await prisma.$executeRaw`
        INSERT INTO public."accounting_periods"
          ("id","tenantId","organizationId","periodStart","periodEnd","status",
           "openedByMembershipId","createdAt","updatedAt")
        VALUES (${id}, ${TENANT}, ${ORG}, ${start}, ${finish}, 'OPEN',
                ${RECORDER}, now(), now())
      `;
      await prisma.$executeRaw`
        UPDATE public."accounting_periods"
           SET "status" = 'CLOSING', "version" = "version" + 1
         WHERE "id" = ${id}
      `;
      await prisma.$executeRaw`
        UPDATE public."accounting_periods"
           SET "status" = 'CLOSED', "closedByMembershipId" = ${RECORDER},
               "version" = "version" + 1
         WHERE "id" = ${id}
      `;
    }

    /** A per-ton line, the simplest shape that can carry any rendering date. */
    function perTon(id: string, renderedAt: Date) {
      return record(id, {
        kind: 'TRANSSHIPMENT',
        unit: 'TON',
        quantityMilliUnits: 40_000n,
        tonnageMilliTons: null,
        periodFrom: null,
        periodTo: null,
        rateKopecks: 15_000n,
        renderedAt,
      });
    }

    it('refuses a service rendered inside a closed month', async () => {
      await closeMonth(
        `${RUN}.period.may`,
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-06-01T00:00:00.000Z'),
      );
      await expect(perTon(`${RUN}.closed`, IN_MAY)).rejects.toThrow(
        /period this service would fall in is closed/,
      );
    });

    // There was a case here for approving a line whose month closed after it
    // was recorded. It is gone, and its absence is the point: the periods
    // contour now refuses to close a month that still holds an undecided line,
    // exactly because approving one afterwards is refused and the charge would
    // be lost. The two rules are a pair, and with the first in place the second
    // is unreachable through the guards.
    //
    // The guard still carries it, for a state that could arise by other means —
    // a restore, a script, a migration — and the pair is proved from the other
    // side by "refuses a close while a service line for the period is
    // undecided" in the periods suite. Reaching it from here would have meant
    // disabling a neighbouring contour's trigger mid-run, which is a table-wide
    // change: measured, it broke every suite running in parallel against the
    // same database. A test that has to sabotage another contour to run is not
    // covering this one.
  });
});
