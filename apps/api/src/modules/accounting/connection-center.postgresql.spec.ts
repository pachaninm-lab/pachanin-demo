import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { IntegrationCapabilityMaturity } from '../../../../../packages/domain-core/src';
import {
  ConnectionKind,
  MissingPrerequisite,
  type ConnectionState,
} from './connection-center.policy';
import { ConnectionAttestationRepository } from './connection-attestation.repository';
import { ConnectionCenterRepository } from './connection-center.repository';
import { WorkTaskRepository } from './work-task.repository';

/**
 * What the Connection Centre says, against a live PostgreSQL 16.
 *
 * The policy spec proves the ladder refuses to skip a rung. This proves the
 * thing that actually gets a platform into trouble: a receipt sitting in the
 * database does not turn a screen green. Somebody sent a document once, the far
 * side answered with its own identifier, the row is real — and the connection
 * is still not live, because no operator endpoint is configured, no credentials
 * were ever issued, and no test exchange was performed. A Connection Centre
 * that promoted itself on the strength of one row would be reporting a
 * capability the organization does not have.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-connections.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const OTHER_ORG = `${RUN}.other-org`;
const USER = `${RUN}.user`;
const MEMBERSHIP = `${RUN}.membership`;
const OTHER_MEMBERSHIP = `${RUN}.other-membership`;
const APPROVER = `${RUN}.approver`;
const APPROVER_MEMBERSHIP = `${RUN}.approver-membership`;
const OTHER_APPROVER_MEMBERSHIP = `${RUN}.other-approver-membership`;
const DOCUMENT = `${RUN}.document`;
const OTHER_DOCUMENT = `${RUN}.other-document`;

let prisma: PrismaService;
let repo: ConnectionCenterRepository;

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

function find(states: readonly ConnectionState[], kind: ConnectionKind): ConnectionState {
  const state = states.find((each) => each.kind === kind);
  if (state === undefined) {
    throw new Error(`the centre did not report ${kind} at all`);
  }
  return state;
}

/**
 * A delivered version, created the way the platform creates one.
 *
 * The database refuses a version that is born sent and refuses to send an
 * unsigned one, so this walks the same three steps a real delivery walks. A
 * fixture that reached in around those guards would be proving something about
 * a row shape that cannot occur.
 */
async function recordDelivery(input: {
  versionId: string;
  organizationId: string;
  documentId: string;
  membershipId: string;
  authorityId: string;
  approverMembershipId: string;
  payloadSeed: string;
  receiptId: string;
}): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public."signing_authorities"
      ("id","tenantId","organizationId","membershipId","authorityType",
       "validFrom","validTo","allowedDocumentTypes","certificateFingerprint",
       "allowedSigningModes","status","grantedByMembershipId","createdAt","updatedAt",
       "secondApprovalMembershipId")
    VALUES (${input.authorityId}, ${TENANT}, ${input.organizationId}, ${input.membershipId},
            'ORGANIZATION_HEAD', now() - interval '1 day', now() + interval '365 days',
            ARRAY['UPD'], ${`${input.authorityId}.fp`}, ARRAY['LOCAL_CSP'], 'ACTIVE',
            ${input.membershipId}, now(), now(), ${input.approverMembershipId})
  `;
  await prisma.$executeRaw`
    INSERT INTO public."accounting_document_versions"
      ("id","tenantId","organizationId","documentId","versionNumber",
       "payloadHash","recordedRevisions","createdByMembershipId","createdAt")
    VALUES (${input.versionId}, ${TENANT}, ${input.organizationId}, ${input.documentId}, 1,
            ${input.payloadSeed}||repeat('0',63), '{}'::jsonb, ${input.membershipId}, now())
  `;
  await prisma.$executeRaw`
    UPDATE public."accounting_document_versions"
       SET "signedAt" = now(), "signedByMembershipId" = ${input.membershipId},
           "signingAuthorityId" = ${input.authorityId},
           "signatureCertificateFingerprint" = ${`${input.authorityId}.fp`}
     WHERE "id" = ${input.versionId}
  `;
  // The issuer is the operator's own name. The database refuses PC_CROP,
  // PLATFORM, SELF and INTERNAL here, which is what stops the platform issuing
  // itself a receipt and calling the connection proven.
  await prisma.$executeRaw`
    UPDATE public."accounting_document_versions"
       SET "sentAt" = now(), "transportCode" = 'EDO_TEST',
           "externalReceiptId" = ${input.receiptId},
           "externalReceiptIssuer" = 'OPERATOR'
     WHERE "id" = ${input.versionId}
  `;
}

describePostgres('what the connection centre reports', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);
    const otherInn = String(Date.now() + 7).slice(-10);

    await prisma.$executeRaw`
      INSERT INTO public."organizations"
        ("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES (${ORG}, ${inn}, 'Connections', 'LEGAL', 'VERIFIED', 'VERIFIED',
              ${TENANT}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."organizations"
        ("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES (${OTHER_ORG}, ${otherInn}, 'Somebody else', 'LEGAL', 'VERIFIED', 'VERIFIED',
              ${TENANT}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."users"
        ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
      VALUES (${USER}, ${`${RUN}@industrial.invalid`}, 'hash', 'Connections',
              'ACTIVE', now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      VALUES (${MEMBERSHIP}, ${USER}, ${ORG}, 'ADMIN', true, now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      VALUES (${OTHER_MEMBERSHIP}, ${USER}, ${OTHER_ORG}, 'ADMIN', false, now())
    `;
    // An ACTIVE signing authority needs a second approver who is neither its
    // holder nor its granter, so the fixture needs a second person rather than
    // a second row for the same one.
    await prisma.$executeRaw`
      INSERT INTO public."users"
        ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
      VALUES (${APPROVER}, ${`${RUN}.approver@industrial.invalid`}, 'hash', 'Approver',
              'ACTIVE', now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      VALUES (${APPROVER_MEMBERSHIP}, ${APPROVER}, ${ORG}, 'ADMIN', true, now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      VALUES (${OTHER_APPROVER_MEMBERSHIP}, ${APPROVER}, ${OTHER_ORG}, 'ADMIN', false, now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_documents"
        ("id","tenantId","organizationId","documentType","documentNumber","status",
         "createdByMembershipId","createdAt","updatedAt")
      VALUES (${DOCUMENT}, ${TENANT}, ${ORG}, 'UPD', 'УПД-2026-000301', 'ISSUED',
              ${MEMBERSHIP}, now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."accounting_documents"
        ("id","tenantId","organizationId","documentType","documentNumber","status",
         "createdByMembershipId","createdAt","updatedAt")
      VALUES (${OTHER_DOCUMENT}, ${TENANT}, ${OTHER_ORG}, 'UPD', 'УПД-2026-000302', 'ISSUED',
              ${OTHER_MEMBERSHIP}, now(), now())
    `;

    const transactions = new RlsTransactionService(prisma);
    repo = new ConnectionCenterRepository(
      transactions,
      new ConnectionAttestationRepository(
        transactions,
        new WorkTaskRepository(transactions),
      ),
    );
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."accounting_document_versions" WHERE "tenantId" = ${TENANT}`;
    await prisma.$executeRaw`DELETE FROM public."accounting_documents" WHERE "tenantId" = ${TENANT}`;
    await prisma.$executeRaw`DELETE FROM public."signing_authorities" WHERE "tenantId" = ${TENANT}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "userId" IN (${USER}, ${APPROVER})`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" IN (${USER}, ${APPROVER})`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "tenantId" = ${TENANT}`;
    await prisma.$disconnect();
  });

  it('reports every kind it knows about, including the ones nobody has started', async () => {
    const states = await repo.describe(actor());

    // Omitting a kind would read as "does not apply here". Naming it as
    // NOT_ATTESTED with its prerequisites is the honest version of "not yet".
    expect(states.map((each) => each.kind).sort()).toEqual(
      [ConnectionKind.BANK_STATEMENT, ConnectionKind.EDO, ConnectionKind.ONE_C].sort(),
    );
    expect(states.every((each) => each.mayCarryRealTraffic === false)).toBe(true);
  });

  it('says 1С is not implemented rather than not configured', async () => {
    const oneC = find(await repo.describe(actor()), ConnectionKind.ONE_C);

    // The distinction matters to whoever reads it: "configure me" invites
    // somebody to go and look for a setting that does not exist.
    expect(oneC.maturity).toBe(IntegrationCapabilityMaturity.DISCOVERED);
    expect(oneC.missing).toContain(MissingPrerequisite.ADAPTER_NOT_IMPLEMENTED);
  });

  it('does not call the statement importer missing, and does not call it attested', async () => {
    const bank = find(await repo.describe(actor()), ConnectionKind.BANK_STATEMENT);

    // An importer exists and is routed, so ADAPTER_NOT_IMPLEMENTED would be
    // false. Nobody has put it in front of the four gates, so ADAPTER_READY
    // would be a claim about work nobody did.
    expect(bank.missing).not.toContain(MissingPrerequisite.ADAPTER_NOT_IMPLEMENTED);
    expect(bank.missing).toContain(MissingPrerequisite.CONTRACT_NOT_ATTESTED);
    expect(bank.maturity).toBe(IntegrationCapabilityMaturity.DISCOVERED);
  });

  it('does not call EDO attested when nobody has attested it', async () => {
    const edo = find(await repo.describe(actor()), ConnectionKind.EDO);

    // This file used to assert ADAPTER_READY here, on the strength of a
    // constant in the repository saying the contract was attested. A contour
    // asserting its own attestation is not an attestation, so the constant is
    // gone and the answer now comes from the four gates.
    expect(edo.maturity).toBe(IntegrationCapabilityMaturity.DISCOVERED);
    expect(edo.mayCarryRealTraffic).toBe(false);
    expect(edo.missing).toEqual(
      expect.arrayContaining([
        MissingPrerequisite.CONTRACT_NOT_ATTESTED,
        MissingPrerequisite.ENDPOINT_NOT_CONFIGURED,
        MissingPrerequisite.VENDOR_CREDENTIALS_NOT_ISSUED,
        MissingPrerequisite.TEST_EXCHANGE_NOT_PERFORMED,
        MissingPrerequisite.LIVE_RECEIPT_NOT_OBTAINED,
      ]),
    );
  });

  it('a real receipt in the database does not make the connection live', async () => {
    // Through the path a real delivery takes: created bare, signed, then
    // recorded as delivered. The database refuses a version born sent and
    // refuses an unsigned one being sent, so a receipt that exists at all is a
    // receipt that went the whole way.
    await recordDelivery({
      versionId: `${RUN}.version.receipt`,
      organizationId: ORG,
      documentId: DOCUMENT,
      membershipId: MEMBERSHIP,
      authorityId: `${RUN}.auth`,
      approverMembershipId: APPROVER_MEMBERSHIP,
      payloadSeed: 'a',
      receiptId: 'operator-receipt-77',
    });

    const edo = find(await repo.describe(actor()), ConnectionKind.EDO);

    // This is the whole point of the module. One successful exchange is not a
    // connection: nothing points at an operator, nobody issued credentials, and
    // no test exchange was ever recorded. Promoting on the receipt alone would
    // report a capability the organization does not have.
    expect(edo.maturity).not.toBe(IntegrationCapabilityMaturity.LIVE_ACCEPTED);
    expect(edo.mayCarryRealTraffic).toBe(false);
    expect(edo.missing).toEqual(
      expect.arrayContaining([
        MissingPrerequisite.ENDPOINT_NOT_CONFIGURED,
        MissingPrerequisite.VENDOR_CREDENTIALS_NOT_ISSUED,
        MissingPrerequisite.TEST_EXCHANGE_NOT_PERFORMED,
      ]),
    );
    // And the receipt itself is acknowledged rather than ignored: what is
    // missing is the rungs below it, not the receipt.
    expect(edo.missing).not.toContain(MissingPrerequisite.LIVE_RECEIPT_NOT_OBTAINED);
  });

  it('does not read somebody else’s receipt as this organization’s evidence', async () => {
    await recordDelivery({
      versionId: `${RUN}.version.other`,
      organizationId: OTHER_ORG,
      documentId: OTHER_DOCUMENT,
      membershipId: OTHER_MEMBERSHIP,
      authorityId: `${RUN}.other-auth`,
      approverMembershipId: OTHER_APPROVER_MEMBERSHIP,
      payloadSeed: 'b',
      receiptId: 'operator-receipt-99',
    });
    await prisma.$executeRaw`
      DELETE FROM public."accounting_document_versions" WHERE "id" = ${`${RUN}.version.receipt`}
    `;

    const edo = find(await repo.describe(actor()), ConnectionKind.EDO);

    // The two organizations share a tenant, so a query scoped only by tenant
    // would hand this organization a neighbour's evidence and report a
    // connection it has never had. The read is scoped by organization.
    expect(edo.missing).toContain(MissingPrerequisite.LIVE_RECEIPT_NOT_OBTAINED);
    expect(edo.maturity).toBe(IntegrationCapabilityMaturity.DISCOVERED);
  });
});
