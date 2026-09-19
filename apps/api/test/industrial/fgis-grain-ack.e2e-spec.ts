import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import type { ClaimedOutboxEntry } from '../../src/modules/integration-events/durable-outbox.worker';
import type { FgisGrainOutboundDispatchPayload } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract';
import {
  FGIS_GRAIN_ACK_COMMAND_SCHEMA,
  FGIS_GRAIN_ACK_POLICY,
  type GenerateFgisGrainAckCommand,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-ack.contract';
import { FgisGrainAckRepository } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-ack.repository';
import { FgisGrainExchangeReceiptRepository } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange-receipt.repository';

const describePostgres = process.env.PC_CROP_08I_POSTGRESQL === '1'
  ? describe
  : describe.skip;
const RUN_ID = `pc-crop-08i.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}.tenant-a`;
const TENANT_B = `${RUN_ID}.tenant-b`;
const ORG_A = `${RUN_ID}.org-a`;
const ORG_B = `${RUN_ID}.org-b`;
const CONFIG_A = `${RUN_ID}.provider-config-a`;
const MESSAGE_IDS = {
  required: 'f47ac10b-58cc-11cf-a447-001122334455',
  concurrent: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
  ackOfAck: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  invalid: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
} as const;

let prisma: PrismaService;
let acknowledgements: FgisGrainAckRepository;
let receipts: FgisGrainExchangeReceiptRepository;

function actor(
  tenantId: string,
  orgId: string,
  suffix: string,
  role: RequestUser['role'] = Role.ADMIN,
): RequestUser {
  return {
    id: `${RUN_ID}.user-${suffix}`,
    email: `${suffix}@ack.invalid`,
    role,
    tenantId,
    orgId,
    membershipId: `${RUN_ID}.membership-${suffix}`,
    sessionId: `${RUN_ID}.session-${suffix}`,
    mfaVerified: true,
  };
}

const USER_A = actor(TENANT_A, ORG_A, 'a');
const USER_B = actor(TENANT_B, ORG_B, 'b');

async function seedOrganizationAndUser(
  organizationId: string,
  tenantId: string,
  user: RequestUser,
  suffix: string,
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."organizations" (
      "id", "inn", "name", "status", "tenantId", "createdAt", "updatedAt"
    ) VALUES (
      ${organizationId}, ${`77${suffix.padStart(10, '0')}`}, ${`FGIS ACK ${suffix}`},
      'VERIFIED', ${tenantId}, clock_timestamp(), clock_timestamp()
    ) ON CONFLICT ("id") DO NOTHING
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."users" (
      "id", "email", "passwordHash", "fullName", "status", "mfaEnabled",
      "createdAt", "updatedAt"
    ) VALUES (
      ${user.id}, ${user.email}, 'not-used-in-acceptance', ${`ACK user ${suffix}`},
      'ACTIVE', true, clock_timestamp(), clock_timestamp()
    ) ON CONFLICT ("id") DO NOTHING
  `);
}

async function seedApprovedProviderConfiguration(): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."fgis_grain_provider_configurations" (
      "id", "tenantId", "organizationId", "adapterCode", "apiVersion",
      "mappingVersion", "signingPolicyVersion", "environment",
      "endpointReference", "tlsPolicyReference", "credentialReference",
      "signingKeyReference", "payloadStoreReference", "status", "version",
      "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
    ) VALUES (
      ${CONFIG_A}, ${TENANT_A}, ${ORG_A}, 'FGIS_ZERNO', '1.0.23',
      'fgis-zerno-1.0.23-catalog.v1', 'fgis-zerno-1.0.23-signing-policy.v1',
      'PRE_PRODUCTION', 'endpoint://fgis/preprod', 'tls://fgis/preprod',
      'credential://fgis/preprod', 'signing-key://fgis/preprod',
      'object-store://fgis/preprod', 'TEST_APPROVED', 0,
      ${USER_A.id}, ${USER_A.id}, clock_timestamp(), clock_timestamp()
    ) ON CONFLICT ("id") DO NOTHING
  `);
  for (const [index, gate] of ['OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS'].entries()) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."fgis_grain_provider_attestations" (
        "id", "configurationId", "tenantId", "organizationId", "gate",
        "decision", "configurationVersion", "actorUserId", "actorRole",
        "mfaVerified", "justification", "evidenceReference", "validUntil",
        "idempotencyKey", "correlationId", "hash", "prevHash", "createdAt"
      ) VALUES (
        ${`${RUN_ID}.attestation.${gate}`}, ${CONFIG_A}, ${TENANT_A}, ${ORG_A},
        ${gate}, 'APPROVED', 0, ${USER_A.id}, 'ADMIN', true,
        ${`Gate ${gate} approved for governed PRE_PRODUCTION ACK acceptance`},
        ${`evidence://fgis-ack/${gate.toLowerCase()}`},
        clock_timestamp() + interval '1 day',
        ${`${RUN_ID}.attestation-key.${index}`}, ${`${RUN_ID}.attestation-correlation.${index}`},
        ${String(index + 1).repeat(64).slice(0, 64)}, NULL, clock_timestamp()
      ) ON CONFLICT ("id") DO NOTHING
    `);
  }
}

interface InboxSeed {
  id: string;
  messageId: string;
  transportOperation: 'SendRequest' | 'SendResponse' | 'Ack';
  responseCode: 'success' | 'accepted' | 'queue-is-empty' | 'ignored';
  fingerprint: string;
  tenantId?: string;
  organizationId?: string;
  signatureStatus?: 'VERIFIED' | 'INVALID';
}

async function seedInbox(input: InboxSeed): Promise<void> {
  const tenantId = input.tenantId ?? TENANT_A;
  const organizationId = input.organizationId ?? ORG_A;
  const verification = {
    verified: input.signatureStatus !== 'INVALID',
    schemaVersion: '1.0.23',
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
    transportOperation: input.transportOperation,
    messageId: input.messageId,
    referenceMessageId: null,
    responseCode: input.responseCode,
    payloadFingerprint: input.fingerprint,
    signatureKeyReference: 'signing-key://fgis/preprod/ack-test',
  };
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."regulatory_integration_inbox_entries" (
      "id", "tenantId", "organizationId", "adapterCode", "adapterVersion",
      "provider", "externalEventId", "schemaVersion", "mappingVersion",
      "environment", "capabilities", "occurredAt", "receivedAt",
      "rawBodySha256", "evidenceReference", "signatureStatus",
      "signatureAlgorithm", "signatureAlgorithmUri", "signatureKeyReference",
      "signatureKeyVersion", "verificationResult", "state", "attempts",
      "leaseOwner", "leaseExpiresAt", "correlationId", "causationId",
      "version", "createdAt", "updatedAt"
    ) VALUES (
      ${input.id}, ${tenantId}, ${organizationId}, 'FGIS_ZERNO', '1.0.23',
      'FGIS_ZERNO', ${`${RUN_ID}.external.${input.id}`}, '1.0.23',
      'fgis-zerno-1.0.23-catalog.v1', 'PREPROD',
      CAST('["INBOUND_EVENTS","SIGNATURE_VERIFICATION","SCHEMA_MAPPING"]' AS jsonb),
      clock_timestamp(), clock_timestamp(), ${input.fingerprint},
      ${`evidence://fgis-ack/${input.id}`}, ${input.signatureStatus ?? 'VERIFIED'},
      'GOST3410_2012_256',
      'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256',
      'signing-key://fgis/preprod/ack-test', 'v1',
      CAST(${JSON.stringify(verification)} AS jsonb), 'PROCESSING', 0,
      ${`${RUN_ID}.inbox-worker`}, clock_timestamp() + interval '5 minutes',
      ${`${RUN_ID}.inbox-correlation.${input.id}`}, NULL, 3,
      clock_timestamp(), clock_timestamp()
    )
  `);
}

function command(input: {
  inboxEntryId: string;
  messageId: string;
  transportOperation: 'SendRequest' | 'SendResponse' | 'Ack';
  responseCode: 'success' | 'accepted' | 'queue-is-empty' | 'ignored';
  fingerprint: string;
  suffix: string;
}): GenerateFgisGrainAckCommand {
  const required = input.transportOperation !== 'Ack'
    && (input.responseCode === 'success' || input.responseCode === 'accepted');
  return {
    schemaVersion: FGIS_GRAIN_ACK_COMMAND_SCHEMA,
    inboxEntryId: input.inboxEntryId,
    expectedInboxVersion: '3',
    inboundTransportOperation: input.transportOperation,
    inboundMessageId: input.messageId,
    inboundReferenceMessageId: null,
    inboundResponseCode: input.responseCode,
    verifiedPayloadFingerprint: input.fingerprint,
    ackEnvelopeReference: required
      ? `object-store://${RUN_ID}/ack/${input.suffix}.xml`
      : null,
    ackEnvelopeSha256: required ? 'b'.repeat(64) : null,
    ackEnvelopeSizeBytes: required ? 256 : null,
    ackMessageDataId: required ? `ack-message-data-${input.suffix}` : null,
    providerConfigurationReference: required ? `config://${CONFIG_A}` : null,
    correlationId: `${RUN_ID}.ack-correlation.${input.suffix}`,
    causationId: `${RUN_ID}.ack-causation.${input.suffix}`,
    idempotencyKey: `${RUN_ID}.ack-key.${input.suffix}`,
    reason: 'Проверенное входящее сообщение обработано по pinned ACK policy authority',
  };
}

async function claimOutbox(
  outboxId: string,
  workerId: string,
  leaseToken: string,
): Promise<ClaimedOutboxEntry> {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    type: string;
    dealId: string | null;
    payload: unknown;
    retryCount: number;
    maxRetries: number;
    correlationId: string | null;
    idempotencyKey: string | null;
  }>>(Prisma.sql`
    UPDATE public."outbox_entries"
    SET "status" = 'PROCESSING',
        "leaseOwner" = ${workerId},
        "leaseToken" = ${leaseToken},
        "leaseExpiresAt" = clock_timestamp() + interval '5 minutes',
        "heartbeatAt" = clock_timestamp()
    WHERE "id" = ${outboxId}
    RETURNING "id", "type", "dealId", "payload", "retryCount", "maxRetries",
              "correlationId", "idempotencyKey"
  `);
  const row = rows[0];
  if (!row) throw new Error('unable to claim ACK outbox');
  return { ...row, leaseToken };
}

describePostgres('PC-CROP-08I durable outbound ACK authority', () => {
  jest.setTimeout(240_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await seedOrganizationAndUser(ORG_A, TENANT_A, USER_A, '701');
    await seedOrganizationAndUser(ORG_B, TENANT_B, USER_B, '702');
    await seedApprovedProviderConfiguration();
    const transactions = new RlsTransactionService(prisma);
    acknowledgements = new FgisGrainAckRepository(transactions);
    receipts = new FgisGrainExchangeReceiptRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates one ACK audit/event/dispatch/exchange and exact-replays it', async () => {
    const inboxId = `${RUN_ID}.inbox.required`;
    const fingerprint = 'a'.repeat(64);
    await seedInbox({
      id: inboxId,
      messageId: MESSAGE_IDS.required,
      transportOperation: 'SendRequest',
      responseCode: 'accepted',
      fingerprint,
    });
    const input = command({
      inboxEntryId: inboxId,
      messageId: MESSAGE_IDS.required,
      transportOperation: 'SendRequest',
      responseCode: 'accepted',
      fingerprint,
      suffix: 'required',
    });
    const created = await acknowledgements.generate(USER_A, input);
    expect(created).toMatchObject({
      kind: 'CREATED',
      state: 'ACK_DISPATCH_REQUESTED',
      decision: 'REQUIRED',
      reasonCode: 'ACK_REQUIRED_VERIFIED_MESSAGE',
      referenceMessageId: MESSAGE_IDS.required,
      policyHash: FGIS_GRAIN_ACK_POLICY.policyHash,
      operationalStatus: 'NOT_ATTESTED',
    });
    expect(created.messageId).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-8[\da-f]{3}-[\da-f]{12}$/u,
    );
    const replay = await acknowledgements.generate(USER_A, {
      ...input,
      correlationId: `${RUN_ID}.ack-correlation.required-replay`,
      idempotencyKey: `${RUN_ID}.ack-key.required-replay`,
    });
    expect(replay).toMatchObject({
      kind: 'REPLAY',
      acknowledgementId: created.acknowledgementId,
      outboxEntryId: created.outboxEntryId,
      exchangeId: created.exchangeId,
      messageId: created.messageId,
    });

    const evidence = await prisma.$queryRaw<Array<{
      ackCount: bigint;
      dispatchCount: bigint;
      exchangeCount: bigint;
      eventCount: bigint;
      transportOperation: string;
      businessOperationCode: string | null;
    }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."fgis_grain_acknowledgements" a
          WHERE a."inboxEntryId" = ${inboxId}) AS "ackCount",
        (SELECT count(*) FROM public."outbox_entries" o
          WHERE o."id" = ${created.outboxEntryId}) AS "dispatchCount",
        (SELECT count(*) FROM public."fgis_grain_exchanges" e
          WHERE e."id" = ${created.exchangeId}) AS "exchangeCount",
        (SELECT count(*) FROM public."outbox_entries" o
          WHERE o."type" = 'FGIS_GRAIN_ACK_REQUESTED'
            AND o."payload" ->> 'acknowledgementId' = ${created.acknowledgementId}) AS "eventCount",
        e."transportOperation", e."businessOperationCode"
      FROM public."fgis_grain_exchanges" e
      WHERE e."id" = ${created.exchangeId}
    `);
    expect(evidence).toEqual([{
      ackCount: 1n,
      dispatchCount: 1n,
      exchangeCount: 1n,
      eventCount: 1n,
      transportOperation: 'Ack',
      businessOperationCode: null,
    }]);
  });

  it('serializes concurrent first processors to one deterministic ACK authority', async () => {
    const inboxId = `${RUN_ID}.inbox.concurrent`;
    const fingerprint = 'c'.repeat(64);
    await seedInbox({
      id: inboxId,
      messageId: MESSAGE_IDS.concurrent,
      transportOperation: 'SendResponse',
      responseCode: 'success',
      fingerprint,
    });
    const input = command({
      inboxEntryId: inboxId,
      messageId: MESSAGE_IDS.concurrent,
      transportOperation: 'SendResponse',
      responseCode: 'success',
      fingerprint,
      suffix: 'concurrent',
    });
    const [left, right] = await Promise.all([
      acknowledgements.generate(USER_A, input),
      acknowledgements.generate(USER_A, {
        ...input,
        correlationId: `${RUN_ID}.ack-correlation.concurrent-right`,
        idempotencyKey: `${RUN_ID}.ack-key.concurrent-right`,
      }),
    ]);
    expect(new Set([left.acknowledgementId, right.acknowledgementId]).size).toBe(1);
    expect(new Set([left.outboxEntryId, right.outboxEntryId]).size).toBe(1);
    expect([left.kind, right.kind].sort()).toEqual(['CREATED', 'REPLAY']);
  });

  it('records ACK-of-ACK as NOT_REQUIRED without dispatch or exchange', async () => {
    const inboxId = `${RUN_ID}.inbox.ack-of-ack`;
    const fingerprint = 'd'.repeat(64);
    await seedInbox({
      id: inboxId,
      messageId: MESSAGE_IDS.ackOfAck,
      transportOperation: 'Ack',
      responseCode: 'success',
      fingerprint,
    });
    const result = await acknowledgements.generate(USER_A, command({
      inboxEntryId: inboxId,
      messageId: MESSAGE_IDS.ackOfAck,
      transportOperation: 'Ack',
      responseCode: 'success',
      fingerprint,
      suffix: 'ack-of-ack',
    }));
    expect(result).toMatchObject({
      kind: 'NOT_REQUIRED',
      state: 'NOT_REQUIRED',
      decision: 'NOT_REQUIRED',
      reasonCode: 'ACK_NOT_REQUIRED_ACK_OF_ACK',
      outboxEntryId: null,
      exchangeId: null,
    });
    const events = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*) AS "count"
      FROM public."outbox_entries"
      WHERE "type" = 'FGIS_GRAIN_ACK_NOT_REQUIRED'
        AND "payload" ->> 'acknowledgementId' = ${result.acknowledgementId}
    `);
    expect(events).toEqual([{ count: 1n }]);
  });

  it('moves ACK to TRANSPORT_ACCEPTED through the existing receipt-first exchange authority', async () => {
    const inboxId = `${RUN_ID}.inbox.transport`;
    const fingerprint = 'e'.repeat(64);
    const messageId = '550e8400-e29b-11d4-a716-446655440000';
    await seedInbox({
      id: inboxId,
      messageId,
      transportOperation: 'SendRequest',
      responseCode: 'accepted',
      fingerprint,
    });
    const ack = await acknowledgements.generate(USER_A, command({
      inboxEntryId: inboxId,
      messageId,
      transportOperation: 'SendRequest',
      responseCode: 'accepted',
      fingerprint,
      suffix: 'transport',
    }));
    const entry = await claimOutbox(
      ack.outboxEntryId!,
      `${RUN_ID}.outbox-worker.transport`,
      `${RUN_ID}.lease.transport`,
    );
    const payload = entry.payload as FgisGrainOutboundDispatchPayload;
    await expect(receipts.inspectBeforeDispatch(entry, payload)).resolves.toMatchObject({
      kind: 'SEND',
      exchangeId: ack.exchangeId,
    });
    await receipts.recordAccepted(entry, payload, {
      delivered: true,
      responseCode: 'accepted',
      providerMessageId: `${RUN_ID}.provider-ack-receipt`,
      responseBodySha256: 'f'.repeat(64),
      httpStatus: 200,
      durationMs: 11,
      faultCode: null,
      retryable: false,
    });
    const state = await prisma.$queryRaw<Array<{
      state: string;
      version: bigint;
      eventCount: bigint;
    }>>(Prisma.sql`
      SELECT a."state", a."version",
        (SELECT count(*) FROM public."outbox_entries" event
          WHERE event."type" = 'FGIS_GRAIN_ACK_TRANSPORT_ACCEPTED'
            AND event."payload" ->> 'acknowledgementId' = a."id") AS "eventCount"
      FROM public."fgis_grain_acknowledgements" a
      WHERE a."id" = ${ack.acknowledgementId}
    `);
    expect(state).toEqual([{
      state: 'ACK_TRANSPORT_ACCEPTED',
      version: 1n,
      eventCount: 1n,
    }]);
  });

  it('fails closed for wrong tenant, forbidden role, invalid signature and direct table mutation', async () => {
    const inboxId = `${RUN_ID}.inbox.invalid`;
    const fingerprint = '9'.repeat(64);
    await seedInbox({
      id: inboxId,
      messageId: MESSAGE_IDS.invalid,
      transportOperation: 'SendRequest',
      responseCode: 'accepted',
      fingerprint,
      signatureStatus: 'INVALID',
    });
    const input = command({
      inboxEntryId: inboxId,
      messageId: MESSAGE_IDS.invalid,
      transportOperation: 'SendRequest',
      responseCode: 'accepted',
      fingerprint,
      suffix: 'invalid',
    });
    await expect(acknowledgements.generate(USER_A, input)).rejects.toMatchObject({
      code: 'ACK_INBOX_AUTHORITY_INVALID',
    });
    await expect(acknowledgements.generate(USER_B, input)).rejects.toMatchObject({
      code: 'ACK_INBOX_AUTHORITY_MISSING',
    });
    await expect(acknowledgements.generate(
      actor(TENANT_A, ORG_A, 'buyer', Role.BUYER),
      input,
    )).rejects.toMatchObject({ code: 'ACK_MUTATION_FORBIDDEN' });

    await expect(prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE app_runtime');
      await tx.$executeRaw(Prisma.sql`
        SELECT set_config('app.current_tenant_id', ${TENANT_A}, true),
               set_config('app.current_org_id', ${ORG_A}, true),
               set_config('app.current_user_id', ${USER_A.id}, true),
               set_config('app.current_role', 'ADMIN', true)
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public."fgis_grain_acknowledgements" (
          "id", "tenantId", "organizationId", "inboxEntryId",
          "inboundTransportOperation", "inboundMessageId", "inboundResponseCode",
          "verifiedPayloadFingerprint", "ackPolicyVersion", "ackPolicyHash",
          "decision", "reasonCode", "state"
        ) VALUES (
          ${`${RUN_ID}.forbidden-direct-write`}, ${TENANT_A}, ${ORG_A}, ${inboxId},
          'Ack', ${MESSAGE_IDS.invalid}, 'ignored', ${fingerprint},
          'fgis-zerno-1.0.23-ack-policy.v1', ${FGIS_GRAIN_ACK_POLICY.policyHash},
          'NOT_REQUIRED', 'ACK_NOT_REQUIRED_POLICY', 'NOT_REQUIRED'
        )
      `);
    })).rejects.toThrow();
  });
});
