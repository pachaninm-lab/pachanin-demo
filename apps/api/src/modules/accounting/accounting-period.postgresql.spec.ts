import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * What a closed period actually freezes, against a live PostgreSQL 16 and as
 * the migration owner.
 *
 * A close that only the application honours is a close that lasts until the
 * next script runs. So the checks here are all made from the strongest
 * principal the platform has, and it still cannot add a rendering to a closed
 * month, sign into one, reopen one, or close a month with work outstanding.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-per.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const USER = `${RUN}.user`;
const MEMBERSHIP = `${RUN}.membership`;

let prisma: PrismaService;

const WINDOW_START = new Date('2026-07-01T00:00:00.000Z');
const WINDOW_END = new Date('2026-08-01T00:00:00.000Z');

async function openPeriod(id: string, start: Date, end: Date): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public."accounting_periods"
      ("id","tenantId","organizationId","periodStart","periodEnd",
       "openedByMembershipId","createdAt","updatedAt")
    VALUES (${id}, ${TENANT}, ${ORG}, ${start}, ${end}, ${MEMBERSHIP},
            now(), now())
  `;
}

async function move(id: string, status: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE public."accounting_periods"
       SET "status" = ${status},
           "closedByMembershipId" = CASE WHEN ${status} = 'CLOSED'
                                    THEN ${MEMBERSHIP} ELSE "closedByMembershipId" END,
           "version" = "version" + 1
     WHERE "id" = ${id}
  `;
}

/** A document raised inside the window, with one unsigned version. */
async function documentInWindow(id: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public."accounting_documents"
      ("id","tenantId","organizationId","documentType","status",
       "createdByMembershipId","createdAt","updatedAt")
    VALUES (${id}, ${TENANT}, ${ORG}, 'UPD', 'DRAFT', ${MEMBERSHIP},
            '2026-07-15T00:00:00Z', now())
  `;
  await prisma.$executeRaw`
    INSERT INTO public."accounting_document_versions"
      ("id","tenantId","organizationId","documentId","versionNumber",
       "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
    VALUES (${`${id}.v1`}, ${TENANT}, ${ORG}, ${id}, 1,
            'b'||repeat('0',63), '{}'::jsonb, ${MEMBERSHIP}, now())
  `;
}

describePostgres('a closed accounting period', () => {
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
    // Raised inside the window and left unsigned, while the period is still
    // open. Signing it after the close is the case a freeze that only covered
    // inserts would miss, and signing is the more consequential half.
    await documentInWindow(`${RUN}.unsigned`);
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."accounting_work_tasks" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" DISABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."accounting_deal_services" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`ALTER TABLE public."accounting_deal_services" ENABLE TRIGGER accounting_deal_services_guard`;
    await prisma.$executeRaw`DELETE FROM public."deals" WHERE "tenantId" = ${TENANT}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_periods" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_document_versions" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_documents" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" = ${USER}`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "id" = ${ORG}`;
    await prisma.$disconnect();
  });

  it('refuses two periods covering one instant', async () => {
    await openPeriod(`${RUN}.jul`, WINDOW_START, WINDOW_END);

    await expect(
      openPeriod(
        `${RUN}.overlap`,
        new Date('2026-07-15T00:00:00.000Z'),
        new Date('2026-08-15T00:00:00.000Z'),
      ),
    ).rejects.toThrow(/do not overlap/);
  });

  it('accepts a successor beginning exactly where the last one ended', async () => {
    await openPeriod(`${RUN}.aug`, WINDOW_END, new Date('2026-09-01T00:00:00.000Z'));
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM public."accounting_periods"
       WHERE "organizationId" = ${ORG}
    `;
    expect(Number(rows[0].count)).toBe(2);
  });

  it('refuses a close that skips the closing step', async () => {
    await expect(move(`${RUN}.jul`, 'CLOSED')).rejects.toThrow(
      /closed from CLOSING/,
    );
  });

  it('refuses a close while a derived task for the period is open', async () => {
    await documentInWindow(`${RUN}.doc`);
    await prisma.$executeRaw`
      INSERT INTO public."accounting_work_tasks"
        ("id","tenantId","organizationId","taskType","origin","resolutionMode",
         "derivationKey","openDerivationKey","title","humanDescription",
         "responsibleCapability","documentId","createdAt","updatedAt")
      VALUES (${`${RUN}.task`}, ${TENANT}, ${ORG}, 'DOCUMENT_NOT_SIGNED',
              'DERIVED', 'SYSTEM_VERIFIED', ${`${RUN}.k`}, ${`${RUN}.k`},
              'Нужна ваша подпись', 'УПД не подписан', 'documents.sign',
              ${`${RUN}.doc`}, now(), now())
    `;

    await move(`${RUN}.jul`, 'CLOSING');
    await expect(move(`${RUN}.jul`, 'CLOSED')).rejects.toThrow(
      /outstanding derived task/,
    );
  });

  it('refuses a close while a service line for the period is undecided', async () => {
    // A month of its own, so the July flow the other cases drive stays put.
    const other = `${RUN}.counterparty`;
    const deal = `${RUN}.deal`;
    await prisma.$executeRaw`
      INSERT INTO public."organizations"
        ("id","inn","name","type","status","kycStatus","tenantId","createdAt",
         "updatedAt")
      VALUES (${other}, ${String(Date.now()).slice(-10)}, 'Counterparty',
              'LEGAL', 'VERIFIED', 'VERIFIED', ${TENANT}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."deals"
        ("id","tenantId","sellerOrgId","buyerOrgId","status","currency",
         "dealNumber","totalKopecks","pricePerTonDec","culture","cropClass",
         "gost","createdAt","updatedAt")
      VALUES (${deal}, ${TENANT}, ${other}, ${ORG}, 'SIGNED', 'RUB',
              ${`СД-${RUN}`}, 12500000, 5000.000000, 'Пшеница', '3',
              'ГОСТ 9353-2016', now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_periods"
        ("id","tenantId","organizationId","periodStart","periodEnd","status",
         "openedByMembershipId","createdAt","updatedAt")
      VALUES (${`${RUN}.sep`}, ${TENANT}, ${ORG}, '2026-09-01T00:00:00Z',
              '2026-10-01T00:00:00Z', 'OPEN', ${MEMBERSHIP}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_deal_services"
        ("id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
         "unit","quantityMilliUnits","rateKopecks","amountKopecks","currency",
         "renderedAt","status","recordedByMembershipId","idempotencyKey",
         "createdAt","updatedAt")
      VALUES (${`${RUN}.svc`}, ${TENANT}, ${ORG}, ${deal}, ${other},
              'TRANSSHIPMENT', 'TON', 100000, 300, 30000, 'RUB',
              '2026-09-10T00:00:00Z', 'RENDERED', ${MEMBERSHIP},
              ${`${RUN}.svc.key`}, now(), now())
    `;

    await move(`${RUN}.sep`, 'CLOSING');
    // Not tidiness: an approval whose line falls in a closed month is refused,
    // so closing over this line would discard the charge rather than defer it.
    await expect(move(`${RUN}.sep`, 'CLOSED')).rejects.toThrow(
      /undecided service line/,
    );
  });

  it('refuses to re-cut the window of a period being closed', async () => {
    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_periods"
           SET "periodEnd" = '2026-07-15T00:00:00Z', "version" = "version" + 1
         WHERE "id" = ${`${RUN}.jul`}
      `,
    ).rejects.toThrow(/no longer moves/);
  });

  it('closes once the work is done, and stamps the time itself', async () => {
    // Sign the document, which is what the task was about, then resolve it.
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
       WHERE "id" = ${`${RUN}.doc.v1`}
    `;
    await prisma.$executeRaw`
      UPDATE public."accounting_work_tasks"
         SET "status" = 'RESOLVED', "version" = "version" + 1
       WHERE "id" = ${`${RUN}.task`}
    `;

    await move(`${RUN}.jul`, 'CLOSED');

    const rows = await prisma.$queryRaw<{ status: string; closedAt: Date | null }[]>`
      SELECT "status", "closedAt" FROM public."accounting_periods"
       WHERE "id" = ${`${RUN}.jul`}
    `;
    expect(rows[0].status).toBe('CLOSED');
    expect(rows[0].closedAt).not.toBeNull();
  });

  it('admits no new rendering of a document raised inside it', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO public."accounting_document_versions"
          ("id","tenantId","organizationId","documentId","versionNumber",
           "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
        VALUES (${`${RUN}.doc.v2`}, ${TENANT}, ${ORG}, ${`${RUN}.doc`}, 2,
                'c'||repeat('0',63), '{}'::jsonb, ${MEMBERSHIP}, now())
      `,
    ).rejects.toThrow(/period this document belongs to is closed/);
  });

  it('admits no signature into it either', async () => {
    // Signing is an update, so a freeze that only covered inserts would leave
    // the more consequential half of the month open.
    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_document_versions"
           SET "signedAt" = now(), "signedByMembershipId" = ${MEMBERSHIP},
               "signingAuthorityId" = ${`${RUN}.auth`},
               "signatureCertificateFingerprint" = ${`${RUN}.fp`}
         WHERE "id" = ${`${RUN}.unsigned.v1`}
      `,
    ).rejects.toThrow(/period this document belongs to is closed/);
  });

  it('closes the ready-to-close task only once the period is actually closed', async () => {
    // The second verified condition, and the one somebody most wants to tick
    // off: the work is done and the close is the last step. Raised against the
    // August period, which is still open.
    await prisma.$executeRaw`
      INSERT INTO public."accounting_work_tasks"
        ("id","tenantId","organizationId","taskType","origin","resolutionMode",
         "derivationKey","openDerivationKey","title","humanDescription",
         "responsibleCapability","periodId","createdAt","updatedAt")
      VALUES (${`${RUN}.close`}, ${TENANT}, ${ORG}, 'PERIOD_READY_TO_CLOSE',
              'DERIVED', 'SYSTEM_VERIFIED', ${`${RUN}.pk`}, ${`${RUN}.pk`},
              'Месяц готов к закрытию', 'Все документы за август подписаны.',
              'accounting.package.close', ${`${RUN}.aug`}, now(), now())
    `;

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_work_tasks"
           SET "status" = 'RESOLVED', "version" = "version" + 1
         WHERE "id" = ${`${RUN}.close`}
      `,
    ).rejects.toThrow(/period this task is about is not closed yet/);

    await move(`${RUN}.aug`, 'CLOSING');
    await move(`${RUN}.aug`, 'CLOSED');

    await prisma.$executeRaw`
      UPDATE public."accounting_work_tasks"
         SET "status" = 'RESOLVED', "version" = "version" + 1
       WHERE "id" = ${`${RUN}.close`}
    `;
    const rows = await prisma.$queryRaw<{ status: string }[]>`
      SELECT "status" FROM public."accounting_work_tasks"
       WHERE "id" = ${`${RUN}.close`}
    `;
    expect(rows[0].status).toBe('RESOLVED');
  });

  it('refuses a task pointing at another organization’s month', async () => {
    // Every foreign key on such a row is satisfied; only the guard catches it.
    await prisma.$executeRaw`
      INSERT INTO public."organizations"
        ("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES (${`${ORG}.other`}, ${String(Date.now()).slice(-10)}, 'Other',
              'LEGAL', 'VERIFIED', 'VERIFIED', ${TENANT}, now(), now())
    `;
    await expect(
      prisma.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "derivationKey","openDerivationKey","title","humanDescription",
           "responsibleCapability","periodId","createdAt","updatedAt")
        VALUES (${`${RUN}.stolen`}, ${TENANT}, ${`${ORG}.other`},
                'PERIOD_READY_TO_CLOSE', 'DERIVED', 'SYSTEM_VERIFIED',
                ${`${RUN}.sk`}, ${`${RUN}.sk`}, 'т', 'о',
                'accounting.package.close', ${`${RUN}.aug`}, now(), now())
      `,
    ).rejects.toThrow(/must belong to that period/);
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "id" = ${`${ORG}.other`}`;
  });

  it('does not reopen', async () => {
    await expect(move(`${RUN}.jul`, 'OPEN')).rejects.toThrow(/does not reopen/);
    await expect(move(`${RUN}.jul`, 'CLOSING')).rejects.toThrow(/does not reopen/);
  });

  it('leaves a document raised outside every closed window alone', async () => {
    const outside = `${RUN}.outside`;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_documents"
        ("id","tenantId","organizationId","documentType","status",
         "createdByMembershipId","createdAt","updatedAt")
      -- September: no period covers it, so nothing here is frozen. August was
      -- closed by the test above, which is exactly why this date is not August.
      VALUES (${outside}, ${TENANT}, ${ORG}, 'UPD', 'DRAFT', ${MEMBERSHIP},
              '2026-09-15T00:00:00Z', now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_document_versions"
        ("id","tenantId","organizationId","documentId","versionNumber",
         "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
      VALUES (${`${outside}.v1`}, ${TENANT}, ${ORG}, ${outside}, 1,
              'd'||repeat('0',63), '{}'::jsonb, ${MEMBERSHIP}, now())
    `;

    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM public."accounting_document_versions"
       WHERE "documentId" = ${outside}
    `;
    expect(Number(rows[0].count)).toBe(1);
  });
});
