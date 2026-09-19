import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * The closing rules, against a live PostgreSQL 16 and as a superuser.
 *
 * The policy in work-task.policy.ts answers a caller. This answers everybody:
 * the connection here is the migration owner, the strongest principal the
 * platform has, and it still cannot dismiss a derived task. That is the whole
 * claim. A rule that only the application enforces is a rule that holds until
 * somebody opens psql, and "the document is not signed" is exactly the sort of
 * message people want to make go away.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-task.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const USER = `${RUN}.user`;
const MEMBERSHIP = `${RUN}.membership`;
const DOCUMENT = `${RUN}.document`;
const GRANTER = `${RUN}.granter`;
const APPROVER = `${RUN}.approver`;
const AUTHORITY = `${RUN}.authority`;
const FINGERPRINT = `${RUN}.fingerprint`;

let prisma: PrismaService;

async function raiseDerived(
  id: string,
  taskType: string,
  resolutionMode: string,
  extra: { documentId?: string | null; sourceEventId?: string | null } = {},
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public."accounting_work_tasks"
      ("id","tenantId","organizationId","taskType","origin","resolutionMode",
       "derivationKey","openDerivationKey","title","humanDescription",
       "responsibleCapability","documentId","sourceEventId","createdAt","updatedAt")
    VALUES (${id}, ${TENANT}, ${ORG}, ${taskType}, 'DERIVED', ${resolutionMode},
            ${`key:${id}`}, ${`key:${id}`}, 'Нужна подпись',
            'УПД не подписан', 'documents.sign',
            ${extra.documentId ?? null}, ${extra.sourceEventId ?? null},
            now(), now())
  `;
}

async function statusOf(id: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ status: string }[]>`
    SELECT "status" FROM public."accounting_work_tasks" WHERE "id" = ${id}
  `;
  return rows[0].status;
}

describePostgres('a derived work task closes only when its condition clears', () => {
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
      VALUES (${MEMBERSHIP}, ${USER}, ${ORG}, 'ADMIN', true, now())
    `;
    // The two-person rule needs three distinct memberships: the holder, whoever
    // granted the authority, and a second approver who is neither.
    for (const membership of [GRANTER, APPROVER]) {
      await prisma.$executeRaw`
        INSERT INTO public."users"
          ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
        VALUES (${`${membership}.user`}, ${`${membership}@industrial.invalid`},
                'hash', 'Tasks', 'ACTIVE', now(), now())
      `;
      await prisma.$executeRaw`
        INSERT INTO public."user_orgs"
          ("id","userId","organizationId","role","isDefault","joinedAt")
        VALUES (${membership}, ${`${membership}.user`}, ${ORG}, 'ADMIN', false, now())
      `;
    }
    await prisma.$executeRaw`
      INSERT INTO public."signing_authorities"
        ("id","tenantId","organizationId","membershipId","authorityType",
         "validFrom","validTo","allowedDocumentTypes","certificateFingerprint",
         "allowedSigningModes","status","grantedByMembershipId",
         "secondApprovalMembershipId","createdAt","updatedAt")
      VALUES (${AUTHORITY}, ${TENANT}, ${ORG}, ${MEMBERSHIP}, 'ORGANIZATION_HEAD',
              now() - interval '1 day', now() + interval '365 days',
              ARRAY['UPD'], ${FINGERPRINT}, ARRAY['LOCAL_CSP'], 'ACTIVE',
              ${GRANTER}, ${APPROVER}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_documents"
        ("id","tenantId","organizationId","documentType","status",
         "createdByMembershipId","createdAt","updatedAt")
      -- DRAFT, not ISSUED: an issued document must carry a number, which this
      -- contour's own constraint enforces. The task here is about a document
      -- awaiting signature, and that is what a draft is.
      VALUES (${DOCUMENT}, ${TENANT}, ${ORG}, 'UPD', 'DRAFT',
              ${MEMBERSHIP}, now(), now())
    `;
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."accounting_work_tasks" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_document_versions" WHERE "documentId" = ${DOCUMENT}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_documents" WHERE "id" = ${DOCUMENT}`;
    await prisma.$executeRaw`DELETE FROM public."signing_authorities" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" IN (${USER}, ${`${GRANTER}.user`}, ${`${APPROVER}.user`})`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "id" = ${ORG}`;
    await prisma.$disconnect();
  });

  it('refuses to resolve an unsigned document task, superuser or not', async () => {
    const id = `${RUN}.unsigned`;
    await raiseDerived(id, 'DOCUMENT_NOT_SIGNED', 'SYSTEM_VERIFIED', {
      documentId: DOCUMENT,
    });

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "status" = 'RESOLVED', "version" = "version" + 1
        WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/still unsigned/);

    expect(await statusOf(id)).toBe('OPEN');
  });

  it('resolves once the document actually carries a signature', async () => {
    const id = `${RUN}.signed`;
    await raiseDerived(id, 'DOCUMENT_NOT_SIGNED', 'SYSTEM_VERIFIED', {
      documentId: DOCUMENT,
    });

    await prisma.$executeRaw`
      INSERT INTO public."accounting_document_versions"
        ("id","tenantId","organizationId","documentId","versionNumber",
         "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
      VALUES (${`${RUN}.v1`}, ${TENANT}, ${ORG}, ${DOCUMENT}, 1,
              'f'||repeat('0',63), '{}'::jsonb, ${MEMBERSHIP}, now())
    `;
    // A real signature, not a half one: this contour's own constraint requires
    // all four signature columns together, so proving the task closes needs an
    // authority record that satisfies the two-person rule as well.
    await prisma.$executeRaw`
      UPDATE public."accounting_document_versions"
      SET "signedAt" = now(),
          "signedByMembershipId" = ${MEMBERSHIP},
          "signingAuthorityId" = ${AUTHORITY},
          "signatureCertificateFingerprint" = ${FINGERPRINT}
      WHERE "id" = ${`${RUN}.v1`}
    `;

    await prisma.$executeRaw`
      UPDATE public."accounting_work_tasks"
      SET "status" = 'RESOLVED', "version" = "version" + 1
      WHERE "id" = ${id}
    `;

    const rows = await prisma.$queryRaw<
      { status: string; resolvedAt: Date | null; openDerivationKey: string | null }[]
    >`
      SELECT "status", "resolvedAt", "openDerivationKey"
      FROM public."accounting_work_tasks" WHERE "id" = ${id}
    `;
    expect(rows[0].status).toBe('RESOLVED');
    // The database stamps the time; a caller cannot antedate a resolution.
    expect(rows[0].resolvedAt).not.toBeNull();
    // The condition is released, so a recurrence can raise a fresh task.
    expect(rows[0].openDerivationKey).toBeNull();
  });

  it('refuses to cancel a derived task, because cancelling is closing', async () => {
    const id = `${RUN}.cancel`;
    await raiseDerived(id, 'DOCUMENT_NOT_SIGNED', 'SYSTEM_VERIFIED', {
      documentId: DOCUMENT,
    });

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "status" = 'CANCELLED', "resolvedByMembershipId" = ${MEMBERSHIP},
            "version" = "version" + 1
        WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/not cancelled/);

    expect(await statusOf(id)).toBe('OPEN');
  });

  it('refuses a reported task closed on the very event that raised it', async () => {
    const id = `${RUN}.echo`;
    await raiseDerived(id, 'ONE_C_TRANSFER_FAILED', 'SYSTEM_REPORTED', {
      sourceEventId: `${RUN}.event.1`,
    });

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "status" = 'RESOLVED', "resolutionEventId" = ${`${RUN}.event.1`},
            "version" = "version" + 1
        WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/cannot be the news/);

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "status" = 'RESOLVED', "version" = "version" + 1
        WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/not on assent/);

    await prisma.$executeRaw`
      UPDATE public."accounting_work_tasks"
      SET "status" = 'RESOLVED', "resolutionEventId" = ${`${RUN}.event.2`},
          "version" = "version" + 1
      WHERE "id" = ${id}
    `;
    expect(await statusOf(id)).toBe('RESOLVED');
  });

  it('refuses a verified type with no verifier rather than waving it through', async () => {
    const id = `${RUN}.noverifier`;
    await raiseDerived(id, 'PAYMENT_NOT_MATCHED', 'SYSTEM_VERIFIED');

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "status" = 'RESOLVED', "version" = "version" + 1
        WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/no verifier is registered/);
  });

  it('refuses a derived task that claims a person decides it', async () => {
    await expect(
      raiseDerived(`${RUN}.judged`, 'DOCUMENT_NOT_SIGNED', 'HUMAN_JUDGEMENT'),
    ).rejects.toThrow(/derived_is_never_human_judgement/);
  });

  it('refuses a task raised already closed', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "derivationKey","openDerivationKey","title","humanDescription",
           "responsibleCapability","status","createdAt","updatedAt")
        VALUES (${`${RUN}.bornclosed`}, ${TENANT}, ${ORG}, 'DOCUMENT_NOT_SIGNED',
                'DERIVED', 'SYSTEM_VERIFIED', 'k1', 'k1', 'т', 'о',
                'documents.sign', 'RESOLVED', now(), now())
      `,
    ).rejects.toThrow(/raised open/);
  });

  it('refuses a second open task for the same condition', async () => {
    const first = `${RUN}.dup.1`;
    await raiseDerived(first, 'DOCUMENT_NOT_SIGNED', 'SYSTEM_VERIFIED', {
      documentId: DOCUMENT,
    });

    await expect(
      prisma.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "derivationKey","openDerivationKey","title","humanDescription",
           "responsibleCapability","createdAt","updatedAt")
        VALUES (${`${RUN}.dup.2`}, ${TENANT}, ${ORG}, 'DOCUMENT_NOT_SIGNED',
                'DERIVED', 'SYSTEM_VERIFIED', ${`key:${first}`}, ${`key:${first}`},
                'т', 'о', 'documents.sign', now(), now())
      `,
      // The unique index answers, so the message names the pair it refused
      // rather than the index: organization plus the open condition.
    ).rejects.toThrow(/"organizationId", "openDerivationKey".*already exists/s);
  });

  it('lets the same condition raise a fresh task after the first one closed', async () => {
    // The signed version from the earlier test is still there, so this one
    // resolves and releases its key.
    const key = `${RUN}.recurring`;
    for (const suffix of ['a', 'b']) {
      await prisma.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "derivationKey","openDerivationKey","title","humanDescription",
           "responsibleCapability","documentId","createdAt","updatedAt")
        VALUES (${`${key}.${suffix}`}, ${TENANT}, ${ORG}, 'DOCUMENT_NOT_SIGNED',
                'DERIVED', 'SYSTEM_VERIFIED', ${key}, ${key}, 'т', 'о',
                'documents.sign', ${DOCUMENT}, now(), now())
      `;
      await prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "status" = 'RESOLVED', "version" = "version" + 1
        WHERE "id" = ${`${key}.${suffix}`}
      `;
    }

    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM public."accounting_work_tasks"
      WHERE "derivationKey" = ${key} AND "status" = 'RESOLVED'
    `;
    expect(Number(rows[0].count)).toBe(2);
  });

  it('does not reopen a closed task', async () => {
    const id = `${RUN}.reopen`;
    await raiseDerived(id, 'DOCUMENT_NOT_SIGNED', 'SYSTEM_VERIFIED', {
      documentId: DOCUMENT,
    });
    await prisma.$executeRaw`
      UPDATE public."accounting_work_tasks"
      SET "status" = 'RESOLVED', "version" = "version" + 1 WHERE "id" = ${id}
    `;

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "status" = 'IN_PROGRESS', "version" = "version" + 1 WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/does not reopen/);
  });

  it('refuses an update that does not advance the version', async () => {
    const id = `${RUN}.version`;
    await raiseDerived(id, 'DOCUMENT_NOT_SIGNED', 'SYSTEM_VERIFIED', {
      documentId: DOCUMENT,
    });

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "status" = 'IN_PROGRESS' WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/advance its version/);
  });

  it('refuses to move a task to another organization or another subject', async () => {
    const id = `${RUN}.immutable`;
    await raiseDerived(id, 'DOCUMENT_NOT_SIGNED', 'SYSTEM_VERIFIED', {
      documentId: DOCUMENT,
    });

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "taskType" = 'PAYMENT_NOT_MATCHED', "version" = "version" + 1
        WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/what a work task is about never changes/);

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "documentId" = NULL, "version" = "version" + 1 WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/what a work task is about never changes/);
  });

  it('refuses an open task that quietly releases its condition', async () => {
    const id = `${RUN}.release`;
    await raiseDerived(id, 'DOCUMENT_NOT_SIGNED', 'SYSTEM_VERIFIED', {
      documentId: DOCUMENT,
    });

    // Nulling the open key while the task stays open would let a second task
    // for the same condition slip past the unique index.
    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "openDerivationKey" = NULL, "version" = "version" + 1
        WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/keeps its condition open/);
  });

  it('refuses a manual task with no author and a derived one with one', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "derivationKey","openDerivationKey","title","humanDescription",
           "responsibleCapability","createdAt","updatedAt")
        VALUES (${`${RUN}.anonymous`}, ${TENANT}, ${ORG}, 'CALL_BUYER', 'MANUAL',
                'HUMAN_JUDGEMENT', NULL, NULL, 'т', 'о',
                'accounting.task.manage', now(), now())
      `,
    ).rejects.toThrow(/author_matches_origin/);

    await expect(
      prisma.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "derivationKey","openDerivationKey","title","humanDescription",
           "responsibleCapability","createdByMembershipId","createdAt","updatedAt")
        VALUES (${`${RUN}.authored`}, ${TENANT}, ${ORG}, 'DOCUMENT_NOT_SIGNED',
                'DERIVED', 'SYSTEM_VERIFIED', 'k2', 'k2', 'т', 'о',
                'documents.sign', ${MEMBERSHIP}, now(), now())
      `,
    ).rejects.toThrow(/author_matches_origin/);
  });

  it('refuses a manual note that squats on a condition slot', async () => {
    // A CHECK is violated only when it evaluates to FALSE. Comparing the open
    // key against a NULL derivation key evaluated to NULL, so the row was
    // admitted — and a hand-written note holding a condition slot keeps the
    // deriver from ever raising the real task for it.
    await expect(
      prisma.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "derivationKey","openDerivationKey","title","humanDescription",
           "responsibleCapability","createdByMembershipId","createdAt","updatedAt")
        VALUES (${`${RUN}.squat`}, ${TENANT}, ${ORG}, 'CALL_BUYER', 'MANUAL',
                'HUMAN_JUDGEMENT', NULL, 'document:someone-elses:unsigned',
                'т', 'о', 'accounting.task.manage', ${MEMBERSHIP}, now(), now())
      `,
    ).rejects.toThrow(/open_key_mirrors_derivation/);
  });

  it('refuses a task that says nothing to a human', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "derivationKey","openDerivationKey","title","humanDescription",
           "responsibleCapability","createdAt","updatedAt")
        VALUES (${`${RUN}.blank`}, ${TENANT}, ${ORG}, 'DOCUMENT_NOT_SIGNED',
                'DERIVED', 'SYSTEM_VERIFIED', 'k3', 'k3', '   ', 'о',
                'documents.sign', now(), now())
      `,
    ).rejects.toThrow(/speaks_to_a_human/);
  });

  it('lets a person close their own note and records who did', async () => {
    const id = `${RUN}.manual`;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_work_tasks"
        ("id","tenantId","organizationId","taskType","origin","resolutionMode",
         "title","humanDescription","responsibleCapability",
         "createdByMembershipId","createdAt","updatedAt")
      VALUES (${id}, ${TENANT}, ${ORG}, 'CALL_BUYER', 'MANUAL', 'HUMAN_JUDGEMENT',
              'Позвонить покупателю', 'Уточнить реквизиты',
              'accounting.task.manage', ${MEMBERSHIP}, now(), now())
    `;

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
        SET "status" = 'RESOLVED', "version" = "version" + 1 WHERE "id" = ${id}
      `,
    ).rejects.toThrow(/names who resolved it/);

    await prisma.$executeRaw`
      UPDATE public."accounting_work_tasks"
      SET "status" = 'RESOLVED', "resolvedByMembershipId" = ${MEMBERSHIP},
          "version" = "version" + 1
      WHERE "id" = ${id}
    `;
    expect(await statusOf(id)).toBe('RESOLVED');
  });
});
