import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import {
  AccountingDocumentIssuingRepository,
  IssueDocumentOutcome,
} from './accounting-document-issuing.repository';
import { NumberingDenyReason } from './accounting-document-numbering.policy';

/**
 * Numbering against a live PostgreSQL 16.
 *
 * Skipped unless PC_CROP_ACCOUNTING_POSTGRESQL=1, the convention the other
 * PostgreSQL acceptance specs in this repository already use. The claim under
 * test is the one no unit test can make: that two issuers racing for the same
 * sequence get two different numbers, and that an issue which rolls back
 * leaves no hole behind. Those are properties of a lock and a transaction, not
 * of a function.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-acct.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const USER = `${RUN}.user`;
const MEMBERSHIP = `${RUN}.membership`;

let prisma: PrismaService;
let issuing: AccountingDocumentIssuingRepository;

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

async function seedDocument(id: string, versionNumber = 1): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public."accounting_documents"
      ("id","tenantId","organizationId","documentType","status",
       "currentVersionNumber","createdByMembershipId","createdAt","updatedAt")
    VALUES (${id}, ${TENANT}, ${ORG}, 'UPD', 'DRAFT', ${versionNumber},
            ${MEMBERSHIP}, now(), now())
  `;
}

async function counterOrdinal(): Promise<number> {
  const rows = await prisma.$queryRaw<{ lastOrdinal: number }[]>`
    SELECT "lastOrdinal" FROM public."accounting_number_counters"
     WHERE "organizationId" = ${ORG}
       AND "documentType" = 'UPD'
       AND "periodYear" = 2026
  `;
  return rows[0].lastOrdinal;
}

async function numbersIssued(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ documentNumber: string }[]>`
    SELECT "documentNumber" FROM public."accounting_documents"
     WHERE "organizationId" = ${ORG}
       AND "documentNumber" IS NOT NULL
     ORDER BY "documentNumber"
  `;
  return rows.map((row) => row.documentNumber);
}

describePostgres('issuing an accounting document', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const inn = String(Date.now()).slice(-10);
    await prisma.$executeRaw`
      INSERT INTO public."organizations"
        ("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES (${ORG}, ${inn}, 'Acceptance', 'LEGAL', 'VERIFIED', 'VERIFIED',
              ${TENANT}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."users"
        ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
      VALUES (${USER}, ${`${RUN}@industrial.invalid`}, 'hash', 'Acceptance',
              'ACTIVE', now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      VALUES (${MEMBERSHIP}, ${USER}, ${ORG}, 'ADMIN', true, now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_number_counters"
        ("id","tenantId","organizationId","documentType","periodYear",
         "prefix","resetPolicy","padding","createdAt","updatedAt")
      VALUES (${`${RUN}.counter`}, ${TENANT}, ${ORG}, 'UPD', 2026,
              'УПД', 'ANNUAL', 6, now(), now())
    `;

    issuing = new AccountingDocumentIssuingRepository(
      new RlsTransactionService(prisma),
    );
  });

  afterAll(async () => {
    await prisma.$executeRaw`
      DELETE FROM public."accounting_documents" WHERE "organizationId" = ${ORG}
    `;
    await prisma.$executeRaw`
      DELETE FROM public."accounting_number_counters" WHERE "organizationId" = ${ORG}
    `;
    await prisma.$executeRaw`
      DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}
    `;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" = ${USER}`;
    await prisma.$executeRaw`
      DELETE FROM public."organizations" WHERE "id" = ${ORG}
    `;
    await prisma.$disconnect();
  });

  const base = {
    accountingYear: 2026,
    accountingPeriodClosed: false,
    issuedAt: new Date('2026-08-16T09:00:00.000Z'),
  };

  it('numbers a draft and moves the counter with it', async () => {
    const id = `${RUN}.doc-1`;
    await seedDocument(id);

    const result = await issuing.issue(actor(), { documentId: id, ...base });

    expect(result.outcome).toBe(IssueDocumentOutcome.ISSUED);
    expect(result.documentNumber).toBe('УПД-2026-000001');
    expect(await counterOrdinal()).toBe(1);
  });

  it('refuses to issue the same document twice', async () => {
    const id = `${RUN}.doc-1`;
    const result = await issuing.issue(actor(), { documentId: id, ...base });

    expect(result.outcome).toBe(IssueDocumentOutcome.REFUSED);
    expect(result.reasons).toContain(NumberingDenyReason.DOCUMENT_ALREADY_NUMBERED);
    // The refusal cost no number, which is the whole point of allocating at
    // issue rather than at creation.
    expect(await counterOrdinal()).toBe(1);
  });

  it('refuses a document that has never been rendered, and burns no number', async () => {
    const id = `${RUN}.doc-empty`;
    await seedDocument(id, 0);

    const result = await issuing.issue(actor(), { documentId: id, ...base });

    expect(result.outcome).toBe(IssueDocumentOutcome.REFUSED);
    expect(result.reasons).toContain(NumberingDenyReason.DOCUMENT_HAS_NO_VERSION);
    expect(await counterOrdinal()).toBe(1);
  });

  it('refuses to issue into a closed period', async () => {
    const id = `${RUN}.doc-closed`;
    await seedDocument(id);

    const result = await issuing.issue(actor(), {
      documentId: id,
      ...base,
      accountingPeriodClosed: true,
    });

    expect(result.outcome).toBe(IssueDocumentOutcome.REFUSED);
    expect(result.reasons).toContain(NumberingDenyReason.ACCOUNTING_PERIOD_CLOSED);
    expect(await counterOrdinal()).toBe(1);
  });

  it('reports a missing sequence rather than starting one', async () => {
    const id = `${RUN}.doc-2027`;
    await seedDocument(id);

    const result = await issuing.issue(actor(), {
      documentId: id,
      accountingYear: 2027,
      accountingPeriodClosed: false,
      issuedAt: new Date('2027-02-01T09:00:00.000Z'),
    });

    // Starting one implicitly would pick a numbering scheme on the
    // organization's behalf, and the scheme is fixed once it issues.
    expect(result.outcome).toBe(IssueDocumentOutcome.NO_SEQUENCE);
  });

  it('does not find a document belonging to another organization', async () => {
    const result = await issuing.issue(actor(), {
      documentId: `${RUN}.does-not-exist`,
      ...base,
    });
    expect(result.outcome).toBe(IssueDocumentOutcome.NOT_FOUND);
  });

  describe('under concurrency', () => {
    it('gives racing issuers different numbers and leaves no gap', async () => {
      const ids = Array.from({ length: 8 }, (_, i) => `${RUN}.race-${i}`);
      for (const id of ids) {
        await seedDocument(id);
      }

      const before = await counterOrdinal();
      const results = await Promise.all(
        ids.map((id) => issuing.issue(actor(), { documentId: id, ...base })),
      );

      const numbers = results
        .map((r) => r.documentNumber)
        .filter((n): n is string => n !== null);

      expect(results.every((r) => r.outcome === IssueDocumentOutcome.ISSUED)).toBe(
        true,
      );
      // Eight issuers, eight distinct numbers. A stale read shared between two
      // of them would show up here as a duplicate or as a failed insert.
      expect(new Set(numbers).size).toBe(ids.length);
      expect(await counterOrdinal()).toBe(before + ids.length);

      // And the sequence is contiguous: no ordinal was taken and dropped.
      const ordinals = numbers
        .map((n) => Number(n.slice(-6)))
        .sort((a, b) => a - b);
      expect(ordinals).toEqual(
        Array.from({ length: ids.length }, (_, i) => before + 1 + i),
      );
    });

    it('every issued number is unique across the whole sequence', async () => {
      const issued = await numbersIssued();
      expect(new Set(issued).size).toBe(issued.length);
    });
  });
});
