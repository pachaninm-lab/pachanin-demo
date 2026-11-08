import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import {
  DecisionRefusal,
  ReversalRefusal,
  ServiceRefusal,
  ServiceStatus,
} from './deal-service.policy';
import {
  DealServiceRepository,
  ServiceOutcome,
} from './deal-service.repository';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Recording, approving and reversing services through the repository, against a
 * live PostgreSQL 16.
 *
 * The constraint suite next door proves the database refuses what it must. This
 * one proves the surface in front of it is reachable and says why: that the
 * amount is computed rather than accepted, that a capability the profile does not
 * carry refuses the command, that a retried command is a retry rather than a
 * second charge, and that the net a deal owes moves only when a second person
 * agrees.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-svcr.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const OTHER_ORG = `${RUN}.other`;
const RECORDER_USER = `${RUN}.user1`;
const APPROVER_USER = `${RUN}.user2`;
const CLERK_USER = `${RUN}.user3`;
const RECORDER = `${RUN}.membership1`;
const APPROVER = `${RUN}.membership2`;
const CLERK = `${RUN}.membership3`;
const DEAL = `${RUN}.deal`;

const WINDOW_FROM = new Date('2026-06-01T00:00:00.000Z');
const WINDOW_TO = new Date('2026-06-11T00:00:00.000Z');
const RENDERED_AT = new Date('2026-06-11T00:00:00.000Z');

let prisma: PrismaService;
let services: DealServiceRepository;

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

/** 40 tons for 10 days at 3 roubles a ton-day: 1200 roubles and nothing else. */
function storage(idempotencyKey: string) {
  return {
    dealId: DEAL,
    counterpartyOrgId: OTHER_ORG,
    kind: 'STORAGE',
    quantityMilliUnits: 400_000n,
    tonnageMilliTons: 40_000n,
    periodFrom: WINDOW_FROM,
    periodTo: WINDOW_TO,
    rateKopecks: 300n,
    currency: 'RUB',
    renderedAt: RENDERED_AT,
    idempotencyKey,
  };
}

describePostgres('services on a deal, through the repository', () => {
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

    // Two bookkeepers and one clerk. The clerk's profile carries no accounting
    // capability at all, which is what makes the refusal below a measurement
    // rather than a restatement of the policy.
    for (const [user, membership, profile] of [
      [RECORDER_USER, RECORDER, 'CHIEF_ACCOUNTANT'],
      [APPROVER_USER, APPROVER, 'CHIEF_ACCOUNTANT'],
      [CLERK_USER, CLERK, null],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO public."users"
          ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
        VALUES (${user}, ${`${user}@industrial.invalid`}, 'hash', ${user},
                'ACTIVE', now(), now())
      `;
      await prisma.$executeRaw`
        INSERT INTO public."user_orgs"
          ("id","userId","organizationId","role","isDefault","joinedAt")
        VALUES (${membership}, ${user}, ${ORG}, 'ADMIN', true, now())
      `;
      if (profile !== null) {
        await prisma.$executeRaw`
          UPDATE public."user_orgs" SET "job_profile" = ${profile}
           WHERE "id" = ${membership}
        `;
      }
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
    const tasks = new WorkTaskRepository(transactions);
    services = new DealServiceRepository(transactions, tasks);
  });

  afterAll(async () => {
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" DISABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."accounting_deal_services" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" ENABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."deals" WHERE "id" = ${DEAL}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" IN (${RECORDER_USER}, ${APPROVER_USER}, ${CLERK_USER})`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "tenantId" = ${TENANT}`;
    await prisma.$disconnect();
  });

  it('computes the amount rather than accepting one', async () => {
    const recorded = await services.record(
      actor(RECORDER_USER, RECORDER),
      storage(`${RUN}.k1`),
    );
    expect(recorded.outcome).toBe(ServiceOutcome.RECORDED);

    const listed = await services.listForDeal(
      actor(RECORDER_USER, RECORDER),
      DEAL,
    );
    const line = listed.lines.find((each) => each.id === recorded.serviceId);
    expect(line?.amountKopecks).toBe(120_000n);
    // The unit was never in the command: it follows from the kind.
    expect(line?.unit).toBe('TON_DAY');
    expect(line?.status).toBe(ServiceStatus.RENDERED);
  });

  it('leaves the net at nothing until a second person agrees', async () => {
    const before = await services.listForDeal(
      actor(RECORDER_USER, RECORDER),
      DEAL,
    );
    // One line recorded by the test above, and nobody has approved it.
    expect(before.lines.length).toBeGreaterThan(0);
    expect(before.netKopecks).toBe(0n);
  });

  it('refuses a command from a membership with no accounting capability', async () => {
    const refused = await services.record(
      actor(CLERK_USER, CLERK),
      storage(`${RUN}.k2`),
    );
    expect(refused.outcome).toBe(ServiceOutcome.REFUSED_BY_POLICY);
    expect(refused.refusals).toContain(ServiceRefusal.NOT_AUTHORISED);
  });

  it('refuses ton-days the window does not hold, with the reason', async () => {
    const refused = await services.record(actor(RECORDER_USER, RECORDER), {
      ...storage(`${RUN}.k3`),
      quantityMilliUnits: 500_000n,
    });
    expect(refused.outcome).toBe(ServiceOutcome.REFUSED_BY_POLICY);
    expect(refused.refusals).toContain(
      ServiceRefusal.TON_DAYS_DISAGREE_WITH_WINDOW,
    );
  });

  it('treats a retried command as a retry, not a second charge', async () => {
    const key = `${RUN}.k4`;
    const first = await services.record(
      actor(RECORDER_USER, RECORDER),
      storage(key),
    );
    const again = await services.record(
      actor(RECORDER_USER, RECORDER),
      storage(key),
    );
    expect(first.outcome).toBe(ServiceOutcome.RECORDED);
    expect(again.outcome).toBe(ServiceOutcome.ALREADY_RECORDED);
    expect(again.serviceId).toBe(first.serviceId);
  });

  it('refuses approval by the membership that recorded the line', async () => {
    const recorded = await services.record(
      actor(RECORDER_USER, RECORDER),
      storage(`${RUN}.k5`),
    );
    const refused = await services.decide(actor(RECORDER_USER, RECORDER), {
      serviceId: recorded.serviceId as string,
      intended: ServiceStatus.APPROVED,
    });
    expect(refused.outcome).toBe(ServiceOutcome.REFUSED_BY_POLICY);
    expect(refused.refusals).toContain(DecisionRefusal.APPROVER_IS_RECORDER);
  });

  it('counts an approved line in the net, and only then', async () => {
    const recorded = await services.record(
      actor(RECORDER_USER, RECORDER),
      storage(`${RUN}.k6`),
    );
    const before = await services.listForDeal(
      actor(RECORDER_USER, RECORDER),
      DEAL,
    );
    const decided = await services.decide(actor(APPROVER_USER, APPROVER), {
      serviceId: recorded.serviceId as string,
      intended: ServiceStatus.APPROVED,
    });
    expect(decided.outcome).toBe(ServiceOutcome.DECIDED);

    const after = await services.listForDeal(
      actor(RECORDER_USER, RECORDER),
      DEAL,
    );
    expect(after.netKopecks - before.netKopecks).toBe(120_000n);
  });

  it('refuses reversing a line nobody approved', async () => {
    const recorded = await services.record(
      actor(RECORDER_USER, RECORDER),
      storage(`${RUN}.k7`),
    );
    const refused = await services.reverse(actor(RECORDER_USER, RECORDER), {
      serviceId: recorded.serviceId as string,
      renderedAt: new Date('2026-07-01T00:00:00.000Z'),
      idempotencyKey: `${RUN}.k7.rev`,
    });
    expect(refused.outcome).toBe(ServiceOutcome.REFUSED_BY_POLICY);
    expect(refused.refusals).toContain(ReversalRefusal.ORIGINAL_NOT_APPROVED);
  });

  it('takes the reversal off the net once it too is approved', async () => {
    const recorded = await services.record(
      actor(RECORDER_USER, RECORDER),
      storage(`${RUN}.k8`),
    );
    await services.decide(actor(APPROVER_USER, APPROVER), {
      serviceId: recorded.serviceId as string,
      intended: ServiceStatus.APPROVED,
    });
    const charged = await services.listForDeal(
      actor(RECORDER_USER, RECORDER),
      DEAL,
    );

    const reversal = await services.reverse(actor(RECORDER_USER, RECORDER), {
      serviceId: recorded.serviceId as string,
      renderedAt: new Date('2026-07-01T00:00:00.000Z'),
      idempotencyKey: `${RUN}.k8.rev`,
    });
    expect(reversal.outcome).toBe(ServiceOutcome.REVERSED);

    // A correction one person asked for is not yet a correction.
    const pending = await services.listForDeal(
      actor(RECORDER_USER, RECORDER),
      DEAL,
    );
    expect(pending.netKopecks).toBe(charged.netKopecks);

    await services.decide(actor(APPROVER_USER, APPROVER), {
      serviceId: reversal.serviceId as string,
      intended: ServiceStatus.APPROVED,
    });
    const corrected = await services.listForDeal(
      actor(RECORDER_USER, RECORDER),
      DEAL,
    );
    expect(charged.netKopecks - corrected.netKopecks).toBe(120_000n);

    // The original still says what it always said, and now names its reversal.
    const original = corrected.lines.find(
      (each) => each.id === recorded.serviceId,
    );
    expect(original?.amountKopecks).toBe(120_000n);
    expect(original?.reversedByServiceId).toBe(reversal.serviceId);
  });

  it('refuses a second reversal of the same line', async () => {
    const listed = await services.listForDeal(
      actor(RECORDER_USER, RECORDER),
      DEAL,
    );
    const reversed = listed.lines.find(
      (each) => each.reversedByServiceId !== null && each.reversesServiceId === null,
    );
    expect(reversed).toBeDefined();
    const refused = await services.reverse(actor(RECORDER_USER, RECORDER), {
      serviceId: (reversed as { id: string }).id,
      renderedAt: new Date('2026-07-02T00:00:00.000Z'),
      idempotencyKey: `${RUN}.k9.rev`,
    });
    expect(refused.outcome).toBe(ServiceOutcome.REFUSED_BY_POLICY);
    expect(refused.refusals).toContain(ReversalRefusal.ALREADY_REVERSED);
  });

  it('shows another organization none of it', async () => {
    // Same repository, a membership in the counterparty.
    //
    // Measured, and the measurement corrected an assumption: what refuses here
    // is the organization predicate in the query, not the row policy. This suite
    // connects as the migration owner, which is a superuser, and a superuser
    // bypasses row level security even with FORCE — removing the predicate makes
    // this test fail with the policy fully in place. The policy is proved
    // separately, under the narrow NOBYPASSRLS principals, by checks 109 and 110
    // of the isolation gate. Both layers exist on purpose; neither one of them is
    // the other's evidence.
    const outsider: RequestUser = {
      ...actor(RECORDER_USER, RECORDER),
      orgId: OTHER_ORG,
      tenantId: TENANT,
    };
    const listed = await services.listForDeal(outsider, DEAL);
    expect(listed.lines).toEqual([]);
    expect(listed.netKopecks).toBe(0n);
  });
});
