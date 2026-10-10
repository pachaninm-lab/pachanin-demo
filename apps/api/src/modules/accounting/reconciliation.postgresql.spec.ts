import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { closingBalanceKopecks, payloadHash } from './reconciliation.policy';
import {
  ReconciliationOutcome,
  ReconciliationRepository,
} from './reconciliation.repository';
import { WorkTaskRepository } from './work-task.repository';

/**
 * A statement of mutual settlements, against a live PostgreSQL 16.
 *
 * The thing being proved is that the statement is a reading of the books rather
 * than a claim about them: the figures are counted from the rows, the bottom
 * line follows from those figures by an expression the database checks again,
 * and neither can be edited afterwards. A reconciliation somebody can rewrite
 * after sending it is not a reconciliation — it is a second opinion with the
 * first one's date on it.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-rec.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const OTHER_ORG = `${RUN}.other`;
const PREPARER_USER = `${RUN}.user1`;
const ANSWERER_USER = `${RUN}.user2`;
const PREPARER = `${RUN}.membership1`;
const ANSWERER = `${RUN}.membership2`;
const DEAL = `${RUN}.deal`;

const WINDOW_START = new Date('2026-07-01T00:00:00.000Z');
const WINDOW_END = new Date('2026-08-01T00:00:00.000Z');

let prisma: PrismaService;
let statements: ReconciliationRepository;

function actor(userId: string, membershipId: string): RequestUser {
  return {
    id: userId,
    email: `${userId}@industrial.invalid`,
    role: Role.ADMIN,
    orgId: ORG,
    tenantId: TENANT,
    membershipId,
    sessionId: `${RUN}.session.${membershipId}`,
    mfaVerified: true,
  };
}

/** An approved charge of `amountKopecks`, rendered inside the window. */
async function approvedCharge(
  id: string,
  amountKopecks: bigint,
  renderedAt = '2026-07-05T00:00:00Z',
  reverses: string | null = null,
): Promise<string> {
  await prisma.$executeRaw`
    INSERT INTO public."accounting_deal_services"
      ("id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
       "unit","quantityMilliUnits","rateKopecks","amountKopecks","currency",
       "renderedAt","status","recordedByMembershipId","reversesServiceId",
       "idempotencyKey","createdAt","updatedAt")
    VALUES (${id}, ${TENANT}, ${ORG}, ${DEAL}, ${OTHER_ORG}, 'TRANSSHIPMENT',
            'TON', ${(amountKopecks * 1_000n) / 300n}, 300, ${amountKopecks},
            'RUB', ${new Date(renderedAt)}, 'RENDERED', ${PREPARER},
            ${reverses}, ${`${id}.key`}, now(), now())
  `;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.current_user_id', ${ANSWERER_USER}, true),
             set_config('app.current_org_id', ${ORG}, true),
             set_config('app.current_tenant_id', ${TENANT}, true)
    `;
    await tx.$executeRaw`
      UPDATE public."accounting_deal_services"
         SET "status" = 'APPROVED', "approvedByMembershipId" = ${ANSWERER},
             "version" = "version" + 1
       WHERE "id" = ${id}
    `;
  });
  return id;
}

describePostgres('a statement of mutual settlements', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);

    for (const [org, name, suffix] of [
      [ORG, 'Reconciliation', '1'],
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
      [PREPARER_USER, PREPARER],
      [ANSWERER_USER, ANSWERER],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO public."users"
          ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
        VALUES (${user}, ${`${user}@industrial.invalid`}, 'hash', 'Recon',
                'ACTIVE', now(), now())
      `;
      await prisma.$executeRaw`
        INSERT INTO public."user_orgs"
          ("id","userId","organizationId","role","isDefault","joinedAt")
        VALUES (${membership}, ${user}, ${ORG}, 'ADMIN', true, now())
      `;
      await prisma.$executeRaw`
        UPDATE public."user_orgs" SET "job_profile" = 'CHIEF_ACCOUNTANT'
         WHERE "id" = ${membership}
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

    const transactions = new RlsTransactionService(prisma);
    statements = new ReconciliationRepository(
      transactions,
      new WorkTaskRepository(transactions),
    );

    // 1500 charged, of which 300 reversed inside the same window.
    await approvedCharge(`${RUN}.svc.a`, 1_000_00n);
    await approvedCharge(`${RUN}.svc.b`, 500_00n);
    const reversedLine = await approvedCharge(`${RUN}.svc.c`, 300_00n);
    await approvedCharge(
      `${RUN}.svc.c.rev`,
      300_00n,
      '2026-07-20T00:00:00Z',
      reversedLine,
    );
  });

  afterAll(async () => {
    await prisma.$executeRaw`ALTER TABLE public."accounting_reconciliations" DISABLE TRIGGER accounting_reconciliations_guard`;
    await prisma.$executeRaw`DELETE FROM public."accounting_reconciliations" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_reconciliations" ENABLE TRIGGER accounting_reconciliations_guard`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" DISABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."accounting_deal_services" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" ENABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."deals" WHERE "id" = ${DEAL}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" IN (${PREPARER_USER}, ${ANSWERER_USER})`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "tenantId" = ${TENANT}`;
    await prisma.$disconnect();
  });

  it('counts the figures from the rows, and reports the reversal separately', async () => {
    const figures = await statements.preview(actor(PREPARER_USER, PREPARER), {
      dealId: DEAL,
      counterpartyOrgId: OTHER_ORG,
      periodStart: WINDOW_START,
      periodEnd: WINDOW_END,
    });
    // 1000 + 500 + 300 charged, 300 reversed — not netted into 1500, because a
    // correction the counterparty cannot see is a correction they cannot check.
    expect(figures.chargedKopecks).toBe(1_800_00n);
    expect(figures.reversedKopecks).toBe(300_00n);
    expect(figures.paidKopecks).toBe(0n);
    expect(figures.closingBalanceKopecks).toBe(1_500_00n);
  });

  it('prepares a statement whose bottom line follows from its figures', async () => {
    const prepared = await statements.prepare(actor(PREPARER_USER, PREPARER), {
      dealId: DEAL,
      counterpartyOrgId: OTHER_ORG,
      periodStart: WINDOW_START,
      periodEnd: WINDOW_END,
      currency: 'RUB',
    });
    expect(prepared.outcome).toBe(ReconciliationOutcome.PREPARED);
    expect(prepared.closingBalanceKopecks).toBe(1_500_00n);
    expect(prepared.payloadHash).toHaveLength(64);
    expect(prepared.payloadHash).toBe(
      payloadHash({
        dealId: DEAL,
        counterpartyOrgId: OTHER_ORG,
        periodStart: WINDOW_START,
        periodEnd: WINDOW_END,
        currency: 'RUB',
        figures: prepared.figures as never,
      }),
    );
  });

  it('refuses a second statement overlapping the same window', async () => {
    const overlapping = await statements.prepare(
      actor(PREPARER_USER, PREPARER),
      {
        dealId: DEAL,
        counterpartyOrgId: OTHER_ORG,
        periodStart: new Date('2026-07-15T00:00:00.000Z'),
        periodEnd: new Date('2026-08-15T00:00:00.000Z'),
        currency: 'RUB',
      },
    );
    expect(overlapping.outcome).toBe(ReconciliationOutcome.REFUSED_BY_POLICY);
    expect(overlapping.refusals).toContain('WINDOW_OVERLAPS');
  });

  it('carries the closing balance into the next window as its opening', async () => {
    const next = await statements.prepare(actor(PREPARER_USER, PREPARER), {
      dealId: DEAL,
      counterpartyOrgId: OTHER_ORG,
      periodStart: WINDOW_END,
      periodEnd: new Date('2026-09-01T00:00:00.000Z'),
      currency: 'RUB',
    });
    expect(next.outcome).toBe(ReconciliationOutcome.PREPARED);
    // Nothing happened in August, so the balance is carried, not recomputed.
    expect(next.figures?.openingBalanceKopecks).toBe(1_500_00n);
    expect(next.closingBalanceKopecks).toBe(1_500_00n);
  });

  it('refuses a bottom line that does not follow from the figures', async () => {
    // Straight at the table, past the repository: the constraint is what has to
    // hold when somebody writes a statement by other means.
    await expect(
      prisma.$executeRaw`
        INSERT INTO public."accounting_reconciliations"
          ("id","tenantId","organizationId","dealId","counterpartyOrgId",
           "periodStart","periodEnd","currency","openingBalanceKopecks",
           "chargedKopecks","reversedKopecks","paidKopecks",
           "advanceAppliedKopecks","closingBalanceKopecks","payloadHash",
           "preparedByMembershipId","createdAt","updatedAt")
        VALUES (${`${RUN}.invented`}, ${TENANT}, ${ORG}, ${DEAL}, ${OTHER_ORG},
                '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 'RUB',
                0, 100, 0, 0, 0, 999, 'f', ${PREPARER}, now(), now())
      `,
    ).rejects.toThrow(/closing_follows_figures/);
  });

  it('refuses editing a figure after the statement is prepared', async () => {
    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_reconciliations"
           SET "chargedKopecks" = 1, "version" = "version" + 1
         WHERE "organizationId" = ${ORG}
      `,
    ).rejects.toThrow(/figures of a reconciliation are settled/);
  });

  it('refuses an answer from the membership that prepared it', async () => {
    const listed = await statements.listForDeal(
      actor(PREPARER_USER, PREPARER),
      DEAL,
    );
    const target = listed[0];
    const refused = await statements.answer(actor(PREPARER_USER, PREPARER), {
      reconciliationId: target.id,
      intended: 'AGREED',
    });
    expect(refused.outcome).toBe(ReconciliationOutcome.REFUSED_BY_POLICY);
    expect(refused.refusals).toContain('ANSWERER_IS_PREPARER');
  });

  it('accepts an answer from a second person and stamps the time itself', async () => {
    const listed = await statements.listForDeal(
      actor(PREPARER_USER, PREPARER),
      DEAL,
    );
    const target = listed[0];
    const before = new Date();
    const answered = await statements.answer(actor(ANSWERER_USER, ANSWERER), {
      reconciliationId: target.id,
      intended: 'DISPUTED',
      note: 'наши цифры расходятся на перевалку',
    });
    expect(answered.outcome).toBe(ReconciliationOutcome.ANSWERED);

    const after = await statements.listForDeal(
      actor(PREPARER_USER, PREPARER),
      DEAL,
    );
    const settled = after.find((each) => each.id === target.id);
    expect(settled?.status).toBe('DISPUTED');
    expect(settled?.respondedByMembershipId).toBe(ANSWERER);
    expect((settled?.respondedAt as Date).getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1_000,
    );
  });

  it('refuses answering the same statement twice', async () => {
    const listed = await statements.listForDeal(
      actor(PREPARER_USER, PREPARER),
      DEAL,
    );
    const answeredOne = listed.find((each) => each.status !== 'PREPARED');
    const again = await statements.answer(actor(ANSWERER_USER, ANSWERER), {
      reconciliationId: (answeredOne as { id: string }).id,
      intended: 'AGREED',
    });
    expect(again.outcome).toBe(ReconciliationOutcome.REFUSED_BY_POLICY);
    expect(again.refusals).toContain('ALREADY_ANSWERED');
  });

  it('refuses deleting a statement, even as the owner', async () => {
    await expect(
      prisma.$executeRaw`
        DELETE FROM public."accounting_reconciliations"
         WHERE "organizationId" = ${ORG}
      `,
    ).rejects.toThrow(/never deleted: it was sent to somebody/);
  });

  it('hashes the figures, and a different figure hashes differently', () => {
    const figures = {
      openingBalanceKopecks: 0n,
      chargedKopecks: 1_000_00n,
      reversedKopecks: 0n,
      paidKopecks: 0n,
      advanceAppliedKopecks: 0n,
    };
    const base = {
      dealId: DEAL,
      counterpartyOrgId: OTHER_ORG,
      periodStart: WINDOW_START,
      periodEnd: WINDOW_END,
      currency: 'RUB',
    };
    expect(closingBalanceKopecks(figures)).toBe(1_000_00n);
    expect(payloadHash({ ...base, figures })).not.toBe(
      payloadHash({
        ...base,
        figures: { ...figures, reversedKopecks: 1n },
      }),
    );
  });
});
