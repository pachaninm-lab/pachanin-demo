import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { Capability } from '../auth/membership-capability.resolver';
import { WorkTaskDeriver } from './work-task.deriver';
import { WorkTaskStatus } from './work-task.policy';
import {
  RaiseOutcome,
  TransitionOutcome,
  WorkTaskRepository,
} from './work-task.repository';

/**
 * Raising and closing against a live PostgreSQL 16.
 *
 * The claims a unit test cannot make: that raising the same condition twice
 * produces one task rather than two, that the guard refuses a closure the
 * policy would have allowed if the world disagrees with it, and that a stale
 * version loses rather than overwriting.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-wtr.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const USER = `${RUN}.user`;
const MEMBERSHIP = `${RUN}.membership`;
const DOCUMENT = `${RUN}.document`;

let prisma: PrismaService;
let repo: WorkTaskRepository;
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

describePostgres('raising and working tasks', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);

    await prisma.$executeRaw`
      INSERT INTO public."organizations"
        ("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES (${ORG}, ${inn}, 'Tasks', 'LEGAL', 'VERIFIED', 'VERIFIED',
              ${TENANT}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."users"
        ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
      VALUES (${USER}, ${`${RUN}@industrial.invalid`}, 'hash', 'Tasks',
              'ACTIVE', now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      -- A job profile, because capabilities are now resolved from the database
      -- rather than accepted from the caller. Bookkeeper is the honest fixture:
      -- role stays a market role, the profile is the accounting axis.
      VALUES (${MEMBERSHIP}, ${USER}, ${ORG}, 'ADMIN', true, now())
    `;
    await prisma.$executeRaw`
      UPDATE public."user_orgs" SET "job_profile" = 'CHIEF_ACCOUNTANT'
       WHERE "id" = ${MEMBERSHIP}
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_documents"
        ("id","tenantId","organizationId","documentType","status",
         "createdByMembershipId","createdAt","updatedAt")
      VALUES (${DOCUMENT}, ${TENANT}, ${ORG}, 'UPD', 'DRAFT',
              ${MEMBERSHIP}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_document_versions"
        ("id","tenantId","organizationId","documentId","versionNumber",
         "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
      VALUES (${`${RUN}.v1`}, ${TENANT}, ${ORG}, ${DOCUMENT}, 1,
              'a'||repeat('0',63), '{}'::jsonb, ${MEMBERSHIP}, now())
    `;

    const transactions = new RlsTransactionService(prisma);
    repo = new WorkTaskRepository(transactions);
    deriver = new WorkTaskDeriver(transactions, repo);
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."accounting_work_tasks" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_document_versions" WHERE "documentId" = ${DOCUMENT}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_documents" WHERE "id" = ${DOCUMENT}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" = ${USER}`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "id" = ${ORG}`;
    await prisma.$disconnect();
  });

  it('raises one task for an unsigned document and no second one on a rerun', async () => {
    const first = await deriver.deriveUnsignedDocuments(actor());
    expect(first).toEqual({ examined: 1, raised: 1, alreadyOpen: 0 });

    // The deriver runs on a schedule over the same sources. A second pass that
    // produced a second task would give somebody two things to close for one
    // unsigned document.
    const second = await deriver.deriveUnsignedDocuments(actor());
    expect(second).toEqual({ examined: 1, raised: 0, alreadyOpen: 1 });

    const open = await repo.listOpen(actor());
    expect(open).toHaveLength(1);
    expect(open[0].taskType).toBe('DOCUMENT_NOT_SIGNED');
    expect(open[0].responsibleCapability).toBe(Capability.DOCUMENTS_SIGN);
  });

  it('refuses a task type nobody registered before touching the database', async () => {
    const result = await repo.raiseDerived(actor(), {
      taskType: 'TRUST_ME_BRO',
      derivationKey: 'k',
      title: 'т',
      humanDescription: 'о',
    });
    expect(result.outcome).toBe(RaiseOutcome.REFUSED);
  });

  it('refuses to close while the document is unsigned, with nothing the caller can assert', async () => {
    const [task] = await repo.listOpen(actor());

    // There is no parameter for "the condition cleared". The server reads the
    // document inside the transaction, finds no signature and refuses. A caller
    // who could assert it would be closing tasks by agreeing with them.
    const result = await repo.transition(actor(), {
      taskId: task.id,
      to: WorkTaskStatus.RESOLVED,
      expectedVersion: task.version,
    });

    expect(result.outcome).toBe(TransitionOutcome.REFUSED_BY_POLICY);
    expect(result.refusals).toContain('CONDITION_STILL_HOLDS');

    const stillOpen = await repo.listOpen(actor());
    expect(stillOpen).toHaveLength(1);
  });

  it('refuses a membership with no accounting profile, whatever it claims', async () => {
    // No job profile: the resolver grants nothing in this contour. The request
    // carries no capability list to argue with, which is the point.
    await prisma.$executeRaw`
      UPDATE public."user_orgs" SET "job_profile" = NULL WHERE "id" = ${MEMBERSHIP}
    `;
    const [task] = await repo.listOpen(actor());
    const result = await repo.transition(actor(), {
      taskId: task.id,
      to: WorkTaskStatus.IN_PROGRESS,
      expectedVersion: task.version,
    });
    await prisma.$executeRaw`
      UPDATE public."user_orgs" SET "job_profile" = 'CHIEF_ACCOUNTANT'
       WHERE "id" = ${MEMBERSHIP}
    `;

    expect(result.outcome).toBe(TransitionOutcome.REFUSED_BY_POLICY);
    expect(result.refusals).toContain('ACTOR_LACKS_TASK_MANAGE');
  });

  it('loses a stale version rather than overwriting the other person', async () => {
    const [task] = await repo.listOpen(actor());

    const moved = await repo.transition(actor(), {
      taskId: task.id,
      to: WorkTaskStatus.IN_PROGRESS,
      expectedVersion: task.version,
    });
    expect(moved.outcome).toBe(TransitionOutcome.MOVED);

    // The second screen still holds the version it read before the first moved.
    const stale = await repo.transition(actor(), {
      taskId: task.id,
      to: WorkTaskStatus.WAITING_COUNTERPARTY,
      expectedVersion: task.version,
    });
    expect(stale.outcome).toBe(TransitionOutcome.VERSION_CONFLICT);
  });

  it('lets a person write their own note, and refuses a blank one', async () => {
    const blank = await repo.raiseManual(actor(), {
      title: '   ',
      humanDescription: 'о',
    });
    expect(blank.outcome).toBe(RaiseOutcome.REFUSED);

    const written = await repo.raiseManual(actor(), {
      title: 'Позвонить покупателю',
      humanDescription: 'Уточнить реквизиты для УПД.',
    });
    expect(written.outcome).toBe(RaiseOutcome.RAISED);

    const open = await repo.listOpen(actor());
    const note = open.find((t) => t.id === written.taskId);
    expect(note?.origin).toBe('MANUAL');
    // A manual note is the one thing a person may close by deciding it is done.
    expect(note?.resolutionMode).toBe('HUMAN_JUDGEMENT');
  });

  it('refuses a note from a membership with no accounting profile', async () => {
    await prisma.$executeRaw`
      UPDATE public."user_orgs" SET "job_profile" = NULL WHERE "id" = ${MEMBERSHIP}
    `;
    const refused = await repo.raiseManual(actor(), {
      title: 'т',
      humanDescription: 'о',
    });
    await prisma.$executeRaw`
      UPDATE public."user_orgs" SET "job_profile" = 'CHIEF_ACCOUNTANT'
       WHERE "id" = ${MEMBERSHIP}
    `;
    expect(refused.outcome).toBe(RaiseOutcome.REFUSED);
  });

  it('reports a task that is not there rather than inventing one', async () => {
    const result = await repo.transition(actor(), {
      taskId: `${RUN}.absent`,
      to: WorkTaskStatus.IN_PROGRESS,
      expectedVersion: 0n,
    });
    expect(result.outcome).toBe(TransitionOutcome.TASK_NOT_FOUND);
  });

  it('closes the document task once signed, and leaves the manual note alone', async () => {
    await prisma.$executeRaw`
      INSERT INTO public."signing_authorities"
        ("id","tenantId","organizationId","membershipId","authorityType",
         "validFrom","validTo","allowedDocumentTypes","certificateFingerprint",
         "allowedSigningModes","status","grantedByMembershipId",
         "secondApprovalMembershipId","createdAt","updatedAt")
      SELECT ${`${RUN}.authority`}, ${TENANT}, ${ORG}, ${MEMBERSHIP},
             'ORGANIZATION_HEAD', now() - interval '1 day',
             now() + interval '365 days', ARRAY['UPD'], ${`${RUN}.fp`},
             ARRAY['LOCAL_CSP'], 'REVOKED', ${MEMBERSHIP}, NULL, now(), now()
    `;
    await prisma.$executeRaw`
      UPDATE public."accounting_document_versions"
      SET "signedAt" = now(),
          "signedByMembershipId" = ${MEMBERSHIP},
          "signingAuthorityId" = ${`${RUN}.authority`},
          "signatureCertificateFingerprint" = ${`${RUN}.fp`}
      WHERE "id" = ${`${RUN}.v1`}
    `;

    const documentTask = (await repo.listOpen(actor())).find(
      (t) => t.taskType === 'DOCUMENT_NOT_SIGNED',
    )!;
    const result = await repo.transition(actor(), {
      taskId: documentTask.id,
      to: WorkTaskStatus.RESOLVED,
      expectedVersion: documentTask.version,
    });
    expect(result.outcome).toBe(TransitionOutcome.MOVED);

    // The document task is gone; the person's own note is untouched, because
    // one closing has nothing to do with the other.
    const left = await repo.listOpen(actor());
    expect(left.map((t) => t.taskType)).toEqual(['MANUAL_NOTE']);

    // Released, so the deriver would raise a fresh task if the document ever
    // went back to unsigned — and it does not raise one now, because it is not.
    const rerun = await deriver.deriveUnsignedDocuments(actor());
    expect(rerun).toEqual({ examined: 0, raised: 0, alreadyOpen: 0 });
  });
});
