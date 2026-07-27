import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import type { ClaimedOutboxEntry } from '../../src/modules/integration-events/durable-outbox.worker';
import {
  FGIS_GRAIN_OUTBOX_EVENT_TYPE,
  type FgisGrainOutboundDispatchPayload,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract';
import {
  FGIS_GRAIN_RESPONSE_CORRELATION_COMMAND_SCHEMA,
  type FgisGrainResponseCorrelationCommand,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange.contract';
import { FgisGrainExchangeCorrelationRepository } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange-correlation.repository';
import { FgisGrainExchangeReceiptRepository } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange-receipt.repository';
import {
  FgisGrainDispatchRepository,
  type EnqueueFgisGrainDispatchCommand,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-dispatch.repository';

const describePostgres = process.env.PC_CROP_08H_POSTGRESQL === '1'
  ? describe
  : describe.skip;
const RUN_ID = `pc-crop-08h.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}.tenant-a`;
const TENANT_B = `${RUN_ID}.tenant-b`;
const ORG_A = `${RUN_ID}.org-a`;
const ORG_B = `${RUN_ID}.org-b`;
const USER_A = actor(TENANT_A, ORG_A, 'a');
const USER_B = actor(TENANT_B, ORG_B, 'b');
const MESSAGE_IDS = {
  receipt: 'f47ac10b-58cc-11cf-a447-001122334455',
  correlation: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
  crossTenant: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
} as const;

let prisma: PrismaService;
let dispatches: FgisGrainDispatchRepository;
let receipts: FgisGrainExchangeReceiptRepository;
let correlations: FgisGrainExchangeCorrelationRepository;

function actor(tenantId: string, orgId: string, suffix: string): RequestUser {
  return {
    id: `${RUN_ID}.user-${suffix}`,
    email: `${suffix}@exchange.invalid`,
    role: Role.ADMIN,
    tenantId,
    orgId,
    membershipId: `${RUN_ID}.membership-${suffix}`,
    sessionId: `${RUN_ID}.session-${suffix}`,
    mfaVerified: true,
  };
}

async function seedOrganization(id: string, tenantId: string, suffix: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."organizations" (
      "id", "inn", "name", "status", "tenantId", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${`76${suffix.padStart(10, '0')}`}, ${`FGIS Exchange ${suffix}`},
      'VERIFIED', ${tenantId}, clock_timestamp(), clock_timestamp()
    ) ON CONFLICT ("id") DO NOTHING
  `);
}

function dispatchCommand(
  suffix: string,
  messageId: string,
): EnqueueFgisGrainDispatchCommand {
  return {
    commandId: `${RUN_ID}.command.${suffix}`,
    idempotencyKey: `${RUN_ID}.dispatch.${suffix}`,
    reason: 'Передача ФГИС подготовлена после серверной проверки полномочий и контракта',
    transportOperation: 'SendRequest',
    businessOperationCode: 'CREATE_SDIZ',
    messageId,
    referenceMessageId: messageId,
    messageDataId: `message-data-${suffix}`,
    unsignedEnvelopeReference: `object-store://${RUN_ID}/${suffix}/unsigned.xml`,
    unsignedEnvelopeSha256: suffix.charCodeAt(0).toString(16).padStart(2, '0').repeat(32),
    unsignedEnvelopeSizeBytes: 512,
    messageDataSha256: 'b'.repeat(64),
    providerConfigurationReference: `config://${RUN_ID}/${suffix}/provider`,
    correlationId: `${RUN_ID}.dispatch-correlation.${suffix}`,
    causationId: `${RUN_ID}.dispatch-causation.${suffix}`,
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
  if (!row) throw new Error('unable to claim test outbox');
  return { ...row, leaseToken };
}

async function prepareAcceptedExchange(
  suffix: string,
  messageId: string,
  user = USER_A,
): Promise<{
  outboxId: string;
  exchangeId: string;
  payload: FgisGrainOutboundDispatchPayload;
}> {
  const dispatched = await dispatches.enqueue(user, dispatchCommand(suffix, messageId));
  const workerId = `${RUN_ID}.outbox-worker.${suffix}`;
  const leaseToken = `${RUN_ID}.lease.${suffix}`;
  const entry = await claimOutbox(dispatched.outboxId, workerId, leaseToken);
  const payload = entry.payload as FgisGrainOutboundDispatchPayload;
  const decision = await receipts.inspectBeforeDispatch(entry, payload);
  expect(decision).toMatchObject({ kind: 'SEND', state: 'DISPATCH_PENDING' });
  await receipts.recordAccepted(entry, payload, {
    delivered: true,
    responseCode: 'accepted',
    providerMessageId: `${RUN_ID}.provider-receipt.${suffix}`,
    responseBodySha256: 'f'.repeat(64),
    httpStatus: 200,
    durationMs: 12,
    faultCode: null,
    retryable: false,
  });
  return {
    outboxId: dispatched.outboxId,
    exchangeId: decision.exchangeId,
    payload,
  };
}

interface SeedInboxInput {
  id: string;
  tenantId: string;
  organizationId: string;
  providerMessageId: string;
  referenceMessageId: string;
  rawBodySha256: string;
  occurredAt: Date;
  workerId: string;
  signatureStatus?: 'VERIFIED' | 'INVALID';
}

async function seedVerifiedInbox(input: SeedInboxInput): Promise<void> {
  const verification = input.signatureStatus === 'INVALID'
    ? { verified: false, errorCode: 'SIGNATURE_INVALID' }
    : {
        verified: true,
        schemaVersion: '1.0.23',
        mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
        signatureKeyReference: 'signing-key://fgis/preprod/exchange-test',
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
      ${input.id}, ${input.tenantId}, ${input.organizationId}, 'FGIS_ZERNO', '1.0.23',
      'FGIS_ZERNO', ${input.providerMessageId}, '1.0.23',
      'fgis-zerno-1.0.23-catalog.v1', 'PREPROD',
      CAST('["INBOUND_EVENTS","SIGNATURE_VERIFICATION","SCHEMA_MAPPING"]' AS jsonb),
      ${input.occurredAt}, clock_timestamp(), ${input.rawBodySha256},
      ${`evidence://fgis-zerno/${input.id}`}, ${input.signatureStatus ?? 'VERIFIED'},
      'GOST3410_2012_256',
      'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256',
      'signing-key://fgis/preprod/exchange-test', 'v1',
      CAST(${JSON.stringify(verification)} AS jsonb), 'PROCESSING', 0,
      ${input.workerId}, clock_timestamp() + interval '5 minutes',
      ${`${RUN_ID}.inbox-correlation.${input.id}`}, ${input.referenceMessageId},
      3, clock_timestamp(), clock_timestamp()
    )
  `);
}

function correlationCommand(input: {
  inboxEntryId: string;
  workerId: string;
  providerMessageId: string;
  referenceMessageId: string;
  rawBodySha256: string;
  responseFingerprint: string;
  occurredAt: Date;
  suffix: string;
}): FgisGrainResponseCorrelationCommand {
  return {
    schemaVersion: FGIS_GRAIN_RESPONSE_CORRELATION_COMMAND_SCHEMA,
    inboxEntryId: input.inboxEntryId,
    workerId: input.workerId,
    expectedInboxVersion: '3',
    providerMessageId: input.providerMessageId,
    referenceMessageId: input.referenceMessageId,
    rawBodySha256: input.rawBodySha256,
    responseFingerprint: input.responseFingerprint,
    providerOccurredAt: input.occurredAt.toISOString(),
    correlationId: `${RUN_ID}.response-correlation.${input.suffix}`,
    idempotencyKey: `${RUN_ID}.response.${input.suffix}`,
    reason: 'Проверенный ответ ФГИС сопоставлен с исходящим сообщением по referenceMessageId',
  };
}

describePostgres('PC-CROP-08H durable FGIS exchange authority', () => {
  jest.setTimeout(180_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await seedOrganization(ORG_A, TENANT_A, '601');
    await seedOrganization(ORG_B, TENANT_B, '602');
    const transactions = new RlsTransactionService(prisma);
    dispatches = new FgisGrainDispatchRepository(transactions);
    receipts = new FgisGrainExchangeReceiptRepository(prisma);
    correlations = new FgisGrainExchangeCorrelationRepository(transactions);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists accepted transport before SENT and suppresses a second provider call after crash', async () => {
    const accepted = await prepareAcceptedExchange('receipt', MESSAGE_IDS.receipt);
    const evidence = await prisma.$queryRaw<Array<{
      state: string;
      providerMessageId: string | null;
      transportAcceptedAt: Date | null;
      version: bigint;
      eventCount: bigint;
      outboxStatus: string;
    }>>(Prisma.sql`
      SELECT e."state", e."providerMessageId", e."transportAcceptedAt", e."version",
        (SELECT count(*) FROM public."outbox_entries" event
          WHERE event."type" = 'FGIS_GRAIN_TRANSPORT_RECEIPT_ACCEPTED'
            AND event."payload" ->> 'exchangeId' = e."id") AS "eventCount",
        o."status" AS "outboxStatus"
      FROM public."fgis_grain_exchanges" e
      JOIN public."outbox_entries" o ON o."id" = e."outboundOutboxEntryId"
      WHERE e."id" = ${accepted.exchangeId}
    `);
    expect(evidence).toEqual([expect.objectContaining({
      state: 'TRANSPORT_ACCEPTED',
      providerMessageId: `${RUN_ID}.provider-receipt.receipt`,
      transportAcceptedAt: expect.any(Date),
      version: 1n,
      eventCount: 1n,
      outboxStatus: 'PROCESSING',
    })]);

    await prisma.$executeRaw(Prisma.sql`
      UPDATE public."outbox_entries"
      SET "status" = 'PENDING', "leaseOwner" = NULL, "leaseToken" = NULL,
          "leaseExpiresAt" = NULL, "heartbeatAt" = NULL,
          "nextRetryAt" = clock_timestamp()
      WHERE "id" = ${accepted.outboxId}
    `);
    const replayEntry = await claimOutbox(
      accepted.outboxId,
      `${RUN_ID}.outbox-worker.receipt-retry`,
      `${RUN_ID}.lease.receipt-retry`,
    );
    await expect(receipts.inspectBeforeDispatch(replayEntry, accepted.payload))
      .resolves.toMatchObject({
        kind: 'SKIP_TRANSPORT',
        exchangeId: accepted.exchangeId,
        state: 'TRANSPORT_ACCEPTED',
      });
  });

  it('correlates one verified response atomically and exact-replays after lease consumption', async () => {
    const accepted = await prepareAcceptedExchange('correlation', MESSAGE_IDS.correlation);
    const inboxId = `${RUN_ID}.inbox.correlation`;
    const workerId = `${RUN_ID}.inbox-worker.correlation`;
    const occurredAt = new Date('2026-07-27T17:00:00.000Z');
    const providerMessageId = `${RUN_ID}.provider-response.correlation`;
    const rawBodySha256 = 'c'.repeat(64);
    const responseFingerprint = 'd'.repeat(64);
    await seedVerifiedInbox({
      id: inboxId,
      tenantId: TENANT_A,
      organizationId: ORG_A,
      providerMessageId,
      referenceMessageId: MESSAGE_IDS.correlation,
      rawBodySha256,
      occurredAt,
      workerId,
    });
    const command = correlationCommand({
      inboxEntryId: inboxId,
      workerId,
      providerMessageId,
      referenceMessageId: MESSAGE_IDS.correlation,
      rawBodySha256,
      responseFingerprint,
      occurredAt,
      suffix: 'correlation',
    });

    const correlated = await correlations.correlateVerifiedResponse(USER_A, command);
    expect(correlated).toMatchObject({
      kind: 'CORRELATED',
      exchangeId: accepted.exchangeId,
      inboxEntryId: inboxId,
      reasonCode: null,
      operationalStatus: 'NOT_ATTESTED',
    });
    const replay = await correlations.correlateVerifiedResponse(USER_A, command);
    expect(replay).toEqual({ ...correlated, kind: 'REPLAY' });

    const evidence = await prisma.$queryRaw<Array<{
      exchangeState: string;
      responseInboxEntryId: string | null;
      responseFingerprint: string | null;
      inboxState: string;
      linkedDomainOperationType: string | null;
      linkedDomainOperationId: string | null;
      eventCount: bigint;
    }>>(Prisma.sql`
      SELECT e."state" AS "exchangeState", e."responseInboxEntryId",
             e."responseFingerprint", i."state" AS "inboxState",
             i."linkedDomainOperationType", i."linkedDomainOperationId",
        (SELECT count(*) FROM public."outbox_entries" event
          WHERE event."type" = 'FGIS_GRAIN_VERIFIED_RESPONSE_CORRELATED'
            AND event."payload" ->> 'exchangeId' = e."id") AS "eventCount"
      FROM public."fgis_grain_exchanges" e
      JOIN public."regulatory_integration_inbox_entries" i
        ON i."id" = e."responseInboxEntryId"
      WHERE e."id" = ${accepted.exchangeId}
    `);
    expect(evidence).toEqual([{
      exchangeState: 'RESPONSE_RECEIVED',
      responseInboxEntryId: inboxId,
      responseFingerprint,
      inboxState: 'PROCESSED',
      linkedDomainOperationType: 'FGIS_GRAIN_EXCHANGE',
      linkedDomainOperationId: accepted.exchangeId,
      eventCount: 1n,
    }]);
  });

  it('quarantines an unknown reference without creating or overwriting an exchange', async () => {
    const inboxId = `${RUN_ID}.inbox.unknown`;
    const workerId = `${RUN_ID}.inbox-worker.unknown`;
    const occurredAt = new Date('2026-07-27T17:10:00.000Z');
    const providerMessageId = `${RUN_ID}.provider-response.unknown`;
    await seedVerifiedInbox({
      id: inboxId,
      tenantId: TENANT_A,
      organizationId: ORG_A,
      providerMessageId,
      referenceMessageId: 'a8098c1a-f86e-11da-bd1a-00112444be1e',
      rawBodySha256: 'e'.repeat(64),
      occurredAt,
      workerId,
    });
    const result = await correlations.correlateVerifiedResponse(USER_A, correlationCommand({
      inboxEntryId: inboxId,
      workerId,
      providerMessageId,
      referenceMessageId: 'a8098c1a-f86e-11da-bd1a-00112444be1e',
      rawBodySha256: 'e'.repeat(64),
      responseFingerprint: '9'.repeat(64),
      occurredAt,
      suffix: 'unknown',
    }));
    expect(result).toMatchObject({
      kind: 'RECONCILIATION_REQUIRED',
      exchangeId: null,
      reasonCode: 'UNKNOWN_OUTBOUND_MESSAGE',
    });
    const rows = await prisma.$queryRaw<Array<{
      state: string;
      lastErrorCode: string | null;
      exchangeCount: bigint;
    }>>(Prisma.sql`
      SELECT i."state", i."lastErrorCode",
        (SELECT count(*) FROM public."fgis_grain_exchanges" e
          WHERE e."messageId" = 'a8098c1a-f86e-11da-bd1a-00112444be1e') AS "exchangeCount"
      FROM public."regulatory_integration_inbox_entries" i
      WHERE i."id" = ${inboxId}
    `);
    expect(rows).toEqual([{
      state: 'QUARANTINED',
      lastErrorCode: 'UNKNOWN_OUTBOUND_MESSAGE',
      exchangeCount: 0n,
    }]);
  });

  it('does not correlate a valid reference across tenant or organization boundaries', async () => {
    const accepted = await prepareAcceptedExchange('cross-tenant', MESSAGE_IDS.crossTenant);
    const inboxId = `${RUN_ID}.inbox.cross-tenant`;
    const workerId = `${RUN_ID}.inbox-worker.cross-tenant`;
    const occurredAt = new Date('2026-07-27T17:20:00.000Z');
    const providerMessageId = `${RUN_ID}.provider-response.cross-tenant`;
    await seedVerifiedInbox({
      id: inboxId,
      tenantId: TENANT_B,
      organizationId: ORG_B,
      providerMessageId,
      referenceMessageId: MESSAGE_IDS.crossTenant,
      rawBodySha256: '7'.repeat(64),
      occurredAt,
      workerId,
    });
    const result = await correlations.correlateVerifiedResponse(USER_B, correlationCommand({
      inboxEntryId: inboxId,
      workerId,
      providerMessageId,
      referenceMessageId: MESSAGE_IDS.crossTenant,
      rawBodySha256: '7'.repeat(64),
      responseFingerprint: '8'.repeat(64),
      occurredAt,
      suffix: 'cross-tenant',
    }));
    expect(result).toMatchObject({
      kind: 'RECONCILIATION_REQUIRED',
      exchangeId: null,
      reasonCode: 'UNKNOWN_OUTBOUND_MESSAGE',
    });
    const protectedExchange = await prisma.$queryRaw<Array<{
      state: string;
      responseInboxEntryId: string | null;
    }>>(Prisma.sql`
      SELECT "state", "responseInboxEntryId"
      FROM public."fgis_grain_exchanges"
      WHERE "id" = ${accepted.exchangeId}
    `);
    expect(protectedExchange).toEqual([{
      state: 'TRANSPORT_ACCEPTED',
      responseInboxEntryId: null,
    }]);
  });

  it('keeps restricted principals read/function scoped with no direct exchange writes', async () => {
    const privileges = await prisma.$queryRaw<Array<{
      runtimeSelect: boolean;
      runtimeInsert: boolean;
      runtimeUpdate: boolean;
      runtimeDelete: boolean;
      runtimeCorrelate: boolean;
      outboxInspect: boolean;
      outboxRecord: boolean;
      outboxTablePrivilege: boolean;
    }>>(Prisma.sql`
      SELECT
        has_table_privilege('app_runtime', 'public.fgis_grain_exchanges', 'SELECT') AS "runtimeSelect",
        has_table_privilege('app_runtime', 'public.fgis_grain_exchanges', 'INSERT') AS "runtimeInsert",
        has_table_privilege('app_runtime', 'public.fgis_grain_exchanges', 'UPDATE') AS "runtimeUpdate",
        has_table_privilege('app_runtime', 'public.fgis_grain_exchanges', 'DELETE') AS "runtimeDelete",
        has_function_privilege(
          'app_runtime',
          'public.correlate_fgis_grain_exchange_response(text,text,bigint,text,text,text,text,timestamp with time zone,text,text,text)',
          'EXECUTE'
        ) AS "runtimeCorrelate",
        has_function_privilege(
          'app_outbox',
          'public.inspect_fgis_grain_exchange_dispatch(text,text,text)',
          'EXECUTE'
        ) AS "outboxInspect",
        has_function_privilege(
          'app_outbox',
          'public.record_fgis_grain_transport_receipt(text,text,text,text,text,integer,text,timestamp with time zone)',
          'EXECUTE'
        ) AS "outboxRecord",
        has_table_privilege('app_outbox', 'public.fgis_grain_exchanges', 'SELECT,INSERT,UPDATE,DELETE')
          AS "outboxTablePrivilege"
    `);
    expect(privileges).toEqual([{
      runtimeSelect: true,
      runtimeInsert: false,
      runtimeUpdate: false,
      runtimeDelete: false,
      runtimeCorrelate: true,
      outboxInspect: true,
      outboxRecord: true,
      outboxTablePrivilege: false,
    }]);
  });
});
