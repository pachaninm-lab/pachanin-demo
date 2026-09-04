import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { IntegrationCapabilityMaturity } from '../../../../../packages/domain-core/src';
import {
  AttestationDecision,
  AttestationGate,
} from './connection-attestation.policy';
import {
  AttestationOutcome,
  ConnectionAttestationRepository,
  SubjectOutcome,
} from './connection-attestation.repository';
import { ConnectionKind, MissingPrerequisite } from './connection-center.policy';
import { ConnectionCenterRepository } from './connection-center.repository';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Attesting a connection, against a live PostgreSQL 16.
 *
 * The governance artefact is the platform's existing four-gate attestation,
 * extended to be about something other than an FGIS provider configuration
 * rather than copied. What is worth proving here is that the extension did not
 * become a softer version of the thing it extends: four gates still means four
 * different people, an approval is still bound to the version it was about, and
 * the connection centre's green tick is now downstream of all of that instead of
 * a constant in a file.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-attest.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;

interface Person {
  userId: string;
  membershipId: string;
}

const PEOPLE: Record<string, Person> = {
  owner: { userId: `${RUN}.owner`, membershipId: `${RUN}.owner-m` },
  security: { userId: `${RUN}.security`, membershipId: `${RUN}.security-m` },
  legal: { userId: `${RUN}.legal`, membershipId: `${RUN}.legal-m` },
  operations: { userId: `${RUN}.ops`, membershipId: `${RUN}.ops-m` },
};

let prisma: PrismaService;
let attestations: ConnectionAttestationRepository;
let connections: ConnectionCenterRepository;

function actor(person: Person, mfaVerified = true): RequestUser {
  return {
    id: person.userId,
    email: `${person.userId}@industrial.invalid`,
    role: Role.ADMIN,
    orgId: ORG,
    tenantId: TENANT,
    membershipId: person.membershipId,
    sessionId: `${RUN}.session.${person.userId}`,
    mfaVerified,
  };
}

let keys = 0;
function answer(person: Person, gate: AttestationGate, subjectId: string) {
  keys += 1;
  return attestations.attest(actor(person), {
    subjectId,
    gate,
    decision: AttestationDecision.APPROVED,
    justification: `${gate} reviewed the operator contract`,
    evidenceReference: `evidence://edo/${gate.toLowerCase()}`,
    validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    idempotencyKey: `${RUN}.key.${keys}`,
    correlationId: `${RUN}.correlation.${keys}`,
  });
}

describePostgres('attesting a connection', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);

    await prisma.$executeRaw`
      INSERT INTO public."organizations"
        ("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES (${ORG}, ${inn}, 'Attestation', 'LEGAL', 'VERIFIED', 'VERIFIED',
              ${TENANT}, now(), now())
    `;
    for (const person of Object.values(PEOPLE)) {
      await prisma.$executeRaw`
        INSERT INTO public."users"
          ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
        VALUES (${person.userId}, ${`${person.userId}@industrial.invalid`}, 'hash',
                'Attester', 'ACTIVE', now(), now())
      `;
      // CHIEF_ACCOUNTANT is the profile that already carries
      // integrations.configure. No new capability is minted for attesting: the
      // guarantee that matters is four *different* people, and the database
      // enforces that whatever capability the caller holds.
      await prisma.$executeRaw`
        INSERT INTO public."user_orgs"
          ("id","userId","organizationId","role","isDefault","joinedAt","job_profile")
        VALUES (${person.membershipId}, ${person.userId}, ${ORG}, 'ADMIN', true,
                now(), 'CHIEF_ACCOUNTANT')
      `;
    }

    const transactions = new RlsTransactionService(prisma);
    const tasks = new WorkTaskRepository(transactions);
    attestations = new ConnectionAttestationRepository(transactions, tasks);
    connections = new ConnectionCenterRepository(transactions, attestations);
  });

  afterAll(async () => {
    // Nothing is torn down, and that is the point rather than an oversight.
    //
    // The attestation table refuses every DELETE — it did so before this scope
    // touched it, and the extension inherits that rather than carving out an
    // exception for its own rows. The subject refuses deletion too, because a
    // subject with approvals against it is the thing those approvals are about.
    // The organization is then pinned by both, since the foreign keys RESTRICT.
    //
    // So a governance record, once written, outlives the run that wrote it.
    // Deleting it here would have meant either a table-wide DISABLE TRIGGER —
    // which damages every suite jest runs in parallel against the same database
    // — or a carve-out that makes the append-only guarantee conditional on who
    // is asking. Rows are namespaced per run, and CI builds the database from
    // the migration chain each time.
    await prisma.$disconnect();
  });

  it('registers a subject once, and says so the second time', async () => {
    const first = await attestations.register(actor(PEOPLE.owner), {
      connectionKind: ConnectionKind.EDO,
      providerCode: 'diadoc',
      environment: 'PRE_PRODUCTION',
    });
    expect(first.outcome).toBe(SubjectOutcome.REGISTERED);

    // Normalized: the same operator typed differently is the same operator, and
    // two subjects would be two approval histories for one connection.
    const again = await attestations.register(actor(PEOPLE.owner), {
      connectionKind: ConnectionKind.EDO,
      providerCode: 'DiaDoc',
      environment: 'PRE_PRODUCTION',
    });
    expect(again.outcome).toBe(SubjectOutcome.ALREADY_REGISTERED);
    expect(again.subjectId).toBe(first.subjectId);
  });

  it('refuses an attestation from an actor with no verified second factor', async () => {
    const [subject] = await attestations.list(actor(PEOPLE.owner));
    const refused = await attestations.attest(actor(PEOPLE.owner, false), {
      subjectId: subject.id,
      gate: AttestationGate.OWNER,
      decision: AttestationDecision.APPROVED,
      justification: 'No second factor',
      evidenceReference: 'evidence://edo/owner',
      validUntil: new Date(Date.now() + 3600_000),
      idempotencyKey: `${RUN}.key.mfa`,
      correlationId: `${RUN}.correlation.mfa`,
    });

    expect(refused.outcome).toBe(AttestationOutcome.REFUSED_BY_POLICY);
    expect(refused.refusal).toBe('MFA_REQUIRED');
  });

  it('refuses a second gate from the person who answered the first', async () => {
    const [subject] = await attestations.list(actor(PEOPLE.owner));
    expect((await answer(PEOPLE.owner, AttestationGate.OWNER, subject.id)).outcome)
      .toBe(AttestationOutcome.RECORDED);

    const refused = await answer(PEOPLE.owner, AttestationGate.SECURITY, subject.id);

    // This is the whole reason there are four gates. The database refuses it,
    // so no writer — this repository or any future one — can turn four-eyes
    // into two by forgetting the rule.
    expect(refused.outcome).toBe(AttestationOutcome.REFUSED_BY_DATABASE);
    expect(refused.refusal).toContain('already answered');
  });

  it('is not attested on three of four, and is on four', async () => {
    const [subject] = await attestations.list(actor(PEOPLE.owner));
    await answer(PEOPLE.security, AttestationGate.SECURITY, subject.id);
    await answer(PEOPLE.legal, AttestationGate.LEGAL, subject.id);

    const partway = (await attestations.list(actor(PEOPLE.owner)))[0];
    expect(partway.state.attested).toBe(false);
    expect(partway.state.awaiting).toEqual([AttestationGate.OPERATIONS]);

    await answer(PEOPLE.operations, AttestationGate.OPERATIONS, subject.id);

    const complete = (await attestations.list(actor(PEOPLE.owner)))[0];
    expect(complete.state.attested).toBe(true);
    expect(complete.state.awaiting).toEqual([]);
  });

  it('lifts the connection centre off NOT_ATTESTED, and no further', async () => {
    const edo = (await connections.describe(actor(PEOPLE.owner))).find(
      (each) => each.kind === ConnectionKind.EDO,
    );

    // The green tick is now downstream of four people rather than a constant.
    // And it lifts the connection exactly one rung: an attested contract is not
    // a configured endpoint, issued credentials or a test exchange, and the
    // centre still says so.
    expect(edo?.maturity).toBe(IntegrationCapabilityMaturity.ADAPTER_IMPLEMENTED);
    expect(edo?.mayCarryRealTraffic).toBe(false);
    expect(edo?.missing).not.toContain(MissingPrerequisite.CONTRACT_NOT_ATTESTED);
    expect(edo?.missing).toEqual(
      expect.arrayContaining([
        MissingPrerequisite.ENDPOINT_NOT_CONFIGURED,
        MissingPrerequisite.VENDOR_CREDENTIALS_NOT_ISSUED,
        MissingPrerequisite.TEST_EXCHANGE_NOT_PERFORMED,
        MissingPrerequisite.LIVE_RECEIPT_NOT_OBTAINED,
      ]),
    );
  });

  it('drops the attestation when the subject moves to a new version', async () => {
    const [subject] = await attestations.list(actor(PEOPLE.owner));
    // Something about the connection changed — a new endpoint, a new contract
    // revision. The approvals were about the version before it.
    await prisma.$executeRaw`
      UPDATE public."connection_attestation_subjects"
         SET "version" = "version" + 1
       WHERE "id" = ${subject.id}
    `;

    const after = (await attestations.list(actor(PEOPLE.owner)))[0];
    expect(after.state.attested).toBe(false);
    expect(after.state.awaiting).toEqual([
      AttestationGate.OWNER,
      AttestationGate.SECURITY,
      AttestationGate.LEGAL,
      AttestationGate.OPERATIONS,
    ]);

    const edo = (await connections.describe(actor(PEOPLE.owner))).find(
      (each) => each.kind === ConnectionKind.EDO,
    );
    // And the centre follows it back down. An approval that survived the thing
    // it approved being changed would be the most expensive kind of stale.
    expect(edo?.maturity).toBe(IntegrationCapabilityMaturity.DISCOVERED);
  });
});
