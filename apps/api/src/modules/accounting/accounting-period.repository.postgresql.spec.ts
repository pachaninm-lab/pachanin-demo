import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { PeriodReadiness, PeriodRefusal, PeriodStatus } from './accounting-period.policy';
import {
  AccountingPeriodRepository,
  PeriodOutcome,
} from './accounting-period.repository';
import { WorkTaskDeriver } from './work-task.deriver';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Opening and closing a period through the repository, against a live
 * PostgreSQL 16.
 *
 * The counts the close depends on are read here rather than accepted, so the
 * test that matters is the one where somebody asks to close a month that still
 * has an unsigned document in it and is told no by numbers they did not supply.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-perr.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const USER = `${RUN}.user`;
const MEMBERSHIP = `${RUN}.membership`;
const DOCUMENT = `${RUN}.document`;

let prisma: PrismaService;
let periods: AccountingPeriodRepository;
let deriver: WorkTaskDeriver;

function actor(): RequestUser {
  return {
    id: USER,
    email: `${RUN}@industrial.invalid`,
    role: Role.ADMIN,
    orgId: ORG,
    tenantId: TENANT,
    membershipId: MEMBERSHIP,
    sessionId: `${RUN}.session`,
    mfaVerified: true,
  };
}

const START = new Date('2026-06-01T00:00:00.000Z');
const END = new Date('2026-07-01T00:00:00.000Z');

describePostgres('opening and closing a period', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);

    await prisma.$executeRaw`
      INSERT INTO public."organizations"
        ("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES (${ORG}, ${inn}, 'Periods', 'LEGAL', 'VERIFIED', 'VERIFIED',
              ${TENANT}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."users"
        ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
      VALUES (${USER}, ${`${RUN}@industrial.invalid`}, 'hash', 'Periods',
              'ACTIVE', now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      VALUES (${MEMBERSHIP}, ${USER}, ${ORG}, 'ADMIN', true, now())
    `;
    await prisma.$executeRaw`
      UPDATE public."user_orgs" SET "job_profile" = 'CHIEF_ACCOUNTANT'
       WHERE "id" = ${MEMBERSHIP}
    `;

    const transactions = new RlsTransactionService(prisma);
    const tasks = new WorkTaskRepository(transactions);
    periods = new AccountingPeriodRepository(transactions, tasks);
    deriver = new WorkTaskDeriver(transactions, tasks);
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."accounting_work_tasks" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_periods" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_document_versions" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_documents" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" = ${USER}`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "id" = ${ORG}`;
    await prisma.$disconnect();
  });

  it('opens a period and refuses one overlapping it', async () => {
    const opened = await periods.open(actor(), { periodStart: START, periodEnd: END });
    expect(opened.outcome).toBe(PeriodOutcome.DONE);

    const overlapping = await periods.open(actor(), {
      periodStart: new Date('2026-06-15T00:00:00.000Z'),
      periodEnd: new Date('2026-07-15T00:00:00.000Z'),
    });
    expect(overlapping.outcome).toBe(PeriodOutcome.REFUSED_BY_POLICY);
    expect(overlapping.refusals).toContain(PeriodRefusal.WINDOW_OVERLAPS);
  });

  it('reports the month as waiting while a document inside it is unsigned', async () => {
    await prisma.$executeRaw`
      INSERT INTO public."accounting_documents"
        ("id","tenantId","organizationId","documentType","status",
         "createdByMembershipId","createdAt","updatedAt")
      VALUES (${DOCUMENT}, ${TENANT}, ${ORG}, 'UPD', 'DRAFT', ${MEMBERSHIP},
              '2026-06-10T00:00:00Z', now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_document_versions"
        ("id","tenantId","organizationId","documentId","versionNumber",
         "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
      VALUES (${`${DOCUMENT}.v1`}, ${TENANT}, ${ORG}, ${DOCUMENT}, 1,
              'e'||repeat('0',63), '{}'::jsonb, ${MEMBERSHIP}, now())
    `;

    const [summary] = await periods.list(actor());
    expect(summary.readiness).toBe(PeriodReadiness.WAITING_ON_WORK);
    expect(summary.unsignedDocuments).toBe(1);
  });

  it('refuses a close on numbers the caller never supplied', async () => {
    const [before] = await periods.list(actor());
    const closing = await periods.advance(actor(), {
      periodId: before.id,
      to: PeriodStatus.CLOSING,
      expectedVersion: before.version,
    });
    expect(closing.outcome).toBe(PeriodOutcome.DONE);

    const [mid] = await periods.list(actor());
    const refused = await periods.advance(actor(), {
      periodId: mid.id,
      to: PeriodStatus.CLOSED,
      expectedVersion: mid.version,
    });
    expect(refused.outcome).toBe(PeriodOutcome.REFUSED_BY_POLICY);
    expect(refused.refusals).toContain(PeriodRefusal.UNSIGNED_DOCUMENTS);
  });

  it('closes once the document is signed, and the deriver stops offering it', async () => {
    await prisma.$executeRaw`
      INSERT INTO public."signing_authorities"
        ("id","tenantId","organizationId","membershipId","authorityType",
         "validFrom","validTo","allowedDocumentTypes","certificateFingerprint",
         "allowedSigningModes","status","grantedByMembershipId","createdAt","updatedAt")
      VALUES (${`${RUN}.auth`}, ${TENANT}, ${ORG}, ${MEMBERSHIP},
              'ORGANIZATION_HEAD', now() - interval '1 day',
              now() + interval '365 days', ARRAY['UPD'], ${`${RUN}.fp`},
              ARRAY['LOCAL_CSP'], 'REVOKED', ${MEMBERSHIP}, now(), now())
    `;
    await prisma.$executeRaw`
      UPDATE public."accounting_document_versions"
         SET "signedAt" = now(), "signedByMembershipId" = ${MEMBERSHIP},
             "signingAuthorityId" = ${`${RUN}.auth`},
             "signatureCertificateFingerprint" = ${`${RUN}.fp`}
       WHERE "id" = ${`${DOCUMENT}.v1`}
    `;

    const raised = await deriver.derivePeriodsReadyToClose(actor());
    expect(raised).toEqual({ examined: 1, raised: 1, alreadyOpen: 0 });

    const [ready] = await periods.list(actor());
    expect(ready.readiness).toBe(PeriodReadiness.READY_TO_CLOSE);

    const closed = await periods.advance(actor(), {
      periodId: ready.id,
      to: PeriodStatus.CLOSED,
      expectedVersion: ready.version,
    });
    expect(closed.outcome).toBe(PeriodOutcome.DONE);

    // June is closed, so it is no longer offered — but closing it opened July,
    // which has also already ended with nothing in it. The loop continues by
    // itself, which is the behaviour a month-end is supposed to have.
    expect(await deriver.derivePeriodsReadyToClose(actor())).toEqual({
      examined: 1,
      raised: 1,
      alreadyOpen: 0,
    });
    const offered = await periods.list(actor());
    expect(
      offered.find((p) => p.status === PeriodStatus.CLOSED)?.periodStart,
    ).toEqual(START);
  });

  it('opens the month after the one it just closed', async () => {
    // A gap between periods is invisible until somebody tries to close the
    // month that fell into it, so the successor is opened by the close itself.
    const all = await periods.list(actor());
    const successor = all.find(
      (p) => p.periodStart.getTime() === new Date('2026-07-01T00:00:00.000Z').getTime(),
    );
    expect(successor).toBeDefined();
    expect(successor?.periodEnd).toEqual(new Date('2026-08-01T00:00:00.000Z'));
    expect(successor?.status).toBe(PeriodStatus.OPEN);
  });

  it('loses a stale version rather than closing twice', async () => {
    const closed = (await periods.list(actor())).find(
      (p) => p.status === PeriodStatus.CLOSED,
    )!;
    const result = await periods.advance(actor(), {
      periodId: closed.id,
      to: PeriodStatus.CLOSED,
      expectedVersion: closed.version - 1n,
    });
    expect(result.outcome).toBe(PeriodOutcome.VERSION_CONFLICT);
  });
});
