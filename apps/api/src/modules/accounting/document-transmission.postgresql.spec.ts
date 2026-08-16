import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { AdapterMaturity, TransmissionRefusal } from './document-transmission.policy';
import {
  DocumentTransmissionRepository,
  SendOutcome,
  currentFreshness,
} from './document-transmission.repository';
import { FakeAccountingDocumentTransport } from './document-transport.fake';

/**
 * Sending, against a live PostgreSQL 16.
 *
 * The claims worth making here are about what survives a second attempt: a
 * delivery is recorded once, an outage leaves the version sendable, and a
 * receipt the platform issued to itself is refused by the database as well as
 * by the policy.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-send.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const USER = `${RUN}.user`;
const MEMBERSHIP = `${RUN}.membership`;
const DOCUMENT = `${RUN}.document`;
const VERSION = `${RUN}.version`;

let prisma: PrismaService;
let repo: DocumentTransmissionRepository;

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

function input() {
  return {
    versionId: VERSION,
    payload: '<upd/>',
    freshness: currentFreshness(),
    formatAllowed: true,
    formatReasons: [],
    adapterMaturity: AdapterMaturity.CONFIRMED_LIVE,
    counterpartyInn: '7701234567',
    formatRevision: 'UPD_FORMAT@2026-01-01',
  };
}

describePostgres('handing a signed version to an adapter', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);

    await prisma.$executeRaw`
      INSERT INTO public."organizations"
        ("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES (${ORG}, ${inn}, 'Send', 'LEGAL', 'VERIFIED', 'VERIFIED',
              ${TENANT}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."users"
        ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
      VALUES (${USER}, ${`${RUN}@industrial.invalid`}, 'hash', 'Send',
              'ACTIVE', now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      VALUES (${MEMBERSHIP}, ${USER}, ${ORG}, 'ADMIN', true, now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_documents"
        ("id","tenantId","organizationId","documentType","documentNumber","status",
         "createdByMembershipId","createdAt","updatedAt")
      VALUES (${DOCUMENT}, ${TENANT}, ${ORG}, 'UPD', 'УПД-2026-000114', 'ISSUED',
              ${MEMBERSHIP}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_document_versions"
        ("id","tenantId","organizationId","documentId","versionNumber",
         "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
      VALUES (${VERSION}, ${TENANT}, ${ORG}, ${DOCUMENT}, 1,
              'f'||repeat('0',63), '{}'::jsonb, ${MEMBERSHIP}, now())
    `;

    repo = new DocumentTransmissionRepository(new RlsTransactionService(prisma));
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."accounting_document_versions" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_documents" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."signing_authorities" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" = ${USER}`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "id" = ${ORG}`;
    await prisma.$disconnect();
  });

  it('reports readiness without a transport, and names what is missing', async () => {
    // The only transmission surface exposed today. It answers with the truth —
    // unsigned and no attested adapter — rather than with a button that would
    // imply somebody is connected.
    const readiness = await repo.describeReadiness(actor(), {
      versionId: VERSION,
      freshness: currentFreshness(),
      formatAllowed: true,
      formatReasons: [],
      adapterMaturity: AdapterMaturity.NOT_ATTESTED,
    });

    expect(readiness.found).toBe(true);
    expect(readiness.sendable).toBe(false);
    expect(readiness.refusals).toEqual(
      expect.arrayContaining([
        TransmissionRefusal.VERSION_NOT_SIGNED,
        TransmissionRefusal.ADAPTER_NOT_LIVE,
      ]),
    );
    expect(readiness.sentAt).toBeNull();
  });

  it('reports a version that is not there as not there', async () => {
    const readiness = await repo.describeReadiness(actor(), {
      versionId: `${RUN}.absent`,
      freshness: currentFreshness(),
      formatAllowed: true,
      formatReasons: [],
      adapterMaturity: AdapterMaturity.NOT_ATTESTED,
    });
    expect(readiness.found).toBe(false);
    expect(readiness.sendable).toBe(false);
  });

  it('refuses to send an unsigned version', async () => {
    const sent = await repo.send(actor(), new FakeAccountingDocumentTransport(), input());
    expect(sent.outcome).toBe(SendOutcome.REFUSED_BY_POLICY);
    expect(sent.refusals).toContain(TransmissionRefusal.VERSION_NOT_SIGNED);
  });

  it('refuses an adapter that is not confirmed live', async () => {
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
       WHERE "id" = ${VERSION}
    `;

    const sent = await repo.send(actor(), new FakeAccountingDocumentTransport(), {
      ...input(),
      adapterMaturity: AdapterMaturity.TEST,
    });
    expect(sent.outcome).toBe(SendOutcome.REFUSED_BY_POLICY);
    expect(sent.refusals).toContain(TransmissionRefusal.ADAPTER_NOT_LIVE);
  });

  it('leaves the version sendable after an outage', async () => {
    const transport = new FakeAccountingDocumentTransport();
    transport.failNext();

    const first = await repo.send(actor(), transport, input());
    expect(first.outcome).toBe(SendOutcome.TRANSPORT_UNAVAILABLE);

    const rows = await prisma.$queryRaw<{ sentAt: Date | null }[]>`
      SELECT "sentAt" FROM public."accounting_document_versions" WHERE "id" = ${VERSION}
    `;
    // Nothing was delivered, so nothing is recorded and the next attempt is
    // still a first attempt.
    expect(rows[0].sentAt).toBeNull();
  });

  it('records a rejection without marking the version sent', async () => {
    const transport = new FakeAccountingDocumentTransport();
    transport.rejectWith(['ИНН контрагента не найден']);

    const rejected = await repo.send(actor(), transport, input());
    expect(rejected.outcome).toBe(SendOutcome.REJECTED_BY_COUNTERPARTY);
    expect(rejected.rejectionReasons).toEqual(['ИНН контрагента не найден']);

    const rows = await prisma.$queryRaw<{ sentAt: Date | null }[]>`
      SELECT "sentAt" FROM public."accounting_document_versions" WHERE "id" = ${VERSION}
    `;
    expect(rows[0].sentAt).toBeNull();
  });

  it('records a delivery once and refuses a second send', async () => {
    const transport = new FakeAccountingDocumentTransport();
    const sent = await repo.send(actor(), transport, input());
    expect(sent.outcome).toBe(SendOutcome.SENT);
    expect(sent.externalReceiptId).toMatch(/^FAKE-/);

    const rows = await prisma.$queryRaw<
      { sentAt: Date | null; transportCode: string; externalReceiptIssuer: string }[]
    >`
      SELECT "sentAt","transportCode","externalReceiptIssuer"
        FROM public."accounting_document_versions" WHERE "id" = ${VERSION}
    `;
    expect(rows[0].sentAt).not.toBeNull();
    expect(rows[0].transportCode).toBe('FAKE_EDO');
    expect(rows[0].externalReceiptIssuer).toBe('FAKE_EDO_OPERATOR');

    const again = await repo.send(actor(), new FakeAccountingDocumentTransport(), input());
    expect(again.outcome).toBe(SendOutcome.ALREADY_SENT);
  });

  it('records a delivery once, and the database says so too', async () => {
    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_document_versions"
           SET "externalReceiptId" = 'REWRITTEN'
         WHERE "id" = ${VERSION}
      `,
    ).rejects.toThrow(/recorded once/);
  });

  it('refuses a receipt this platform issued to itself', async () => {
    await prisma.$executeRaw`
      INSERT INTO public."accounting_document_versions"
        ("id","tenantId","organizationId","documentId","versionNumber",
         "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
      VALUES (${`${VERSION}.2`}, ${TENANT}, ${ORG}, ${DOCUMENT}, 2,
              'e'||repeat('0',63), '{}'::jsonb, ${MEMBERSHIP}, now())
    `;
    await prisma.$executeRaw`
      UPDATE public."accounting_document_versions"
         SET "signedAt" = now(), "signedByMembershipId" = ${MEMBERSHIP},
             "signingAuthorityId" = ${`${RUN}.auth`},
             "signatureCertificateFingerprint" = ${`${RUN}.fp`}
       WHERE "id" = ${`${VERSION}.2`}
    `;

    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_document_versions"
           SET "sentAt" = now(), "transportCode" = 'X',
               "externalReceiptId" = 'R-1', "externalReceiptIssuer" = 'PC_CROP'
         WHERE "id" = ${`${VERSION}.2`}
      `,
    ).rejects.toThrow(/receipt_is_external/);
  });

  it('refuses a half-recorded delivery, which a NULL-valued CHECK let through', async () => {
    await expect(
      prisma.$executeRaw`
        UPDATE public."accounting_document_versions"
           SET "sentAt" = now()
         WHERE "id" = ${`${VERSION}.2`}
      `,
    ).rejects.toThrow(/receipt_complete/);
  });
});
