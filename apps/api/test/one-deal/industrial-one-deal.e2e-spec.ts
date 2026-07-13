import { ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { IndustrialDealCommandGateway } from '../../src/modules/deals/industrial-deal-command.gateway';
import { DealCommandService } from '../../src/modules/deals/deal-command.service';
import { PrismaShipmentRepository } from '../../src/modules/logistics/prisma-shipment.repository';
import { BankKeyRegistryService } from '../../src/modules/settlement-engine/bank-key-registry.service';
import { IntegrationEventsService } from '../../src/modules/integration-events/integration-events.service';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import {
  CANONICAL_TEST_DEAL_ID,
  DEAL_ACTIONS,
  type DealActionId,
} from '../../src/modules/deals/deal-command.policy';
import {
  buildBankSignaturePayload,
  SettlementEngineController,
} from '../../src/modules/settlement-engine/settlement-engine.controller';
import {
  createPersistentActorHarness,
  type PersistentActorHarness,
} from './persistent-auth-actors';

const BANK_SECRET = process.env.BANK_HMAC_SECRET ?? '';
const BANK_PARTNER_ID = process.env.BANK_PARTNER_ID ?? 'safe-deals';
const BANK_KEY_ID = process.env.BANK_HMAC_KEY_ID ?? 'primary';
const DEAL_AMOUNT_KOPECKS = 240_000_000;
const FACT_AT = '2026-07-12T09:00:00.000Z';
const SHIPMENT_ID = `shipment:${CANONICAL_TEST_DEAL_ID}`;
const ACCEPTANCE_ID = `acceptance:${CANONICAL_TEST_DEAL_ID}`;
const SAMPLE_ID = `sample:${CANONICAL_TEST_DEAL_ID}`;
const CONTRACT_ID = `contract:${CANONICAL_TEST_DEAL_ID}`;
const INSPECTION_ID = `inspection:${CANONICAL_TEST_DEAL_ID}`;
const VEHICLE_ID = `vehicle:${CANONICAL_TEST_DEAL_ID}`;
const ROUTE_FROM_ID = 'facility:org-canonical-seller:dispatch';
const ROUTE_TO_ID = 'facility:org-canonical-buyer:acceptance';
const CANONICAL_ORG_IDS = [
  'org-canonical-seller',
  'org-canonical-buyer',
  'org-canonical-logistics',
  'org-canonical-surveyor',
  'org-canonical-elevator',
  'org-canonical-lab',
  'org-canonical-bank',
  'org-canonical-platform',
] as const;

type UserActionId = Exclude<DealActionId, 'confirm_reserve' | 'confirm_release'>;
type Workspace = Awaited<ReturnType<IndustrialDealCommandGateway['workspace']>>;
type CommandReceipt = {
  duplicate: boolean;
  commandId: string;
  actionId: DealActionId;
  eventId: string;
  auditId: string;
  status: string;
  updatedAt: string;
};
type IssuedUserCommand = {
  actionId: UserActionId;
  role: Role;
  dto: ExecuteDealCommandDto;
  receipt: CommandReceipt;
};
type BankCallbackBody = {
  dealId: string;
  eventId: string;
  operation: 'RESERVE' | 'RELEASE';
  status: 'SUCCESS';
  bankRef: string;
  operationId: string;
};
type BankCallbackFixture = {
  body: BankCallbackBody;
  timestamp: string;
  eventId: string;
  partnerId: string;
  keyId: string;
  signature: string;
};

const actionRole: Record<UserActionId, Role> = {
  approve_admission: Role.COMPLIANCE_OFFICER,
  publish_auction: Role.FARMER,
  place_winning_bid: Role.BUYER,
  seller_sign_contract: Role.FARMER,
  buyer_sign_contract: Role.BUYER,
  request_reserve: Role.BUYER,
  assign_logistics: Role.LOGISTICIAN,
  confirm_loading: Role.DRIVER,
  start_transit: Role.DRIVER,
  confirm_arrival: Role.DRIVER,
  confirm_weight: Role.ELEVATOR,
  confirm_inspection: Role.SURVEYOR,
  finalize_lab: Role.LAB,
  accept_delivery: Role.BUYER,
  complete_documents: Role.FARMER,
  request_release: Role.ACCOUNTING,
  close_deal: Role.SUPPORT_MANAGER,
};

function evidence(kind: string): string {
  return `evidence:${CANONICAL_TEST_DEAL_ID}:${kind}`;
}

function payload(actionId: DealActionId): Prisma.InputJsonObject {
  switch (actionId) {
    case 'seller_sign_contract':
      return { documentId: CONTRACT_ID, signedAt: FACT_AT, signatureEvidenceRef: evidence('seller-signature') };
    case 'buyer_sign_contract':
      return { documentId: CONTRACT_ID, signedAt: '2026-07-12T09:05:00.000Z', signatureEvidenceRef: evidence('buyer-signature') };
    case 'assign_logistics':
      return {
        carrierOrgId: 'org-canonical-logistics',
        driverUserId: 'driver-e2e',
        vehicleId: VEHICLE_ID,
        routeFromFacilityId: ROUTE_FROM_ID,
        routeToFacilityId: ROUTE_TO_ID,
      };
    case 'confirm_loading':
      return {
        shipmentId: SHIPMENT_ID,
        actualWeightTons: '150.000000',
        occurredAt: '2026-07-12T10:00:00.000Z',
        basis: 'WEIGHING_TICKET',
        evidenceRef: evidence('loading'),
        unit: 'TON',
      };
    case 'start_transit':
      return {
        shipmentId: SHIPMENT_ID,
        occurredAt: '2026-07-12T10:15:00.000Z',
        basis: 'DRIVER_CONFIRMATION',
        evidenceRef: evidence('departure'),
      };
    case 'confirm_arrival':
      return {
        shipmentId: SHIPMENT_ID,
        occurredAt: '2026-07-12T13:30:00.000Z',
        confirmationMethod: 'ELEVATOR_CHECKPOINT',
        evidenceRef: evidence('arrival'),
        lat: 52.7212,
        lng: 41.4523,
      };
    case 'confirm_weight':
      return {
        shipmentId: SHIPMENT_ID,
        grossTons: '180.000000',
        tareTons: '30.400000',
        netTons: '149.600000',
        weighingSource: 'ELEVATOR_SCALE',
        occurredAt: '2026-07-12T13:45:00.000Z',
        evidenceRef: evidence('weighing'),
        equipmentId: `scale:${CANONICAL_TEST_DEAL_ID}`,
      };
    case 'confirm_inspection':
      return { documentId: INSPECTION_ID, evidenceRef: evidence('inspection'), inspectedAt: '2026-07-12T14:00:00.000Z' };
    case 'finalize_lab':
      return {
        sampleId: SAMPLE_ID,
        protocolNumber: `PROTOCOL-${CANONICAL_TEST_DEAL_ID}`,
        labId: 'org-canonical-lab',
        accreditationRef: 'ACCREDITATION-ORG-CANONICAL-LAB',
        applicableStandard: 'CONTROLLED-STANDARD-E2E',
        finalizedAt: '2026-07-12T15:00:00.000Z',
        signedEvidenceRef: evidence('lab'),
        indicators: [
          { parameter: 'moisture', value: '12.400000', unit: '%', normMax: '14.000000' },
          { parameter: 'protein', value: '13.200000', unit: '%', normMin: '12.500000' },
        ],
      };
    case 'accept_delivery':
      return { acceptanceId: ACCEPTANCE_ID, acceptedAt: '2026-07-12T15:30:00.000Z', evidenceRef: evidence('acceptance') };
    default:
      return {};
  }
}

function createRuntime() {
  const prisma = new PrismaService();
  const rls = new RlsTransactionService(prisma);
  const commands = new DealCommandService(rls);
  const gateway = new IndustrialDealCommandGateway(prisma, rls, commands);
  const bankKeys = new BankKeyRegistryService(prisma);
  const integrationEvents = new IntegrationEventsService(prisma);
  const settlement = new SettlementEngineController({} as never, gateway, bankKeys, integrationEvents);
  return { prisma, rls, gateway, settlement };
}

type Runtime = ReturnType<typeof createRuntime>;

function requireReceipt(value: unknown): CommandReceipt {
  expect(value).toMatchObject({
    duplicate: expect.any(Boolean),
    commandId: expect.any(String),
    actionId: expect.any(String),
    eventId: expect.any(String),
    auditId: expect.any(String),
    status: expect.any(String),
    updatedAt: expect.any(String),
  });
  return value as CommandReceipt;
}

function bankCallbackFixture(operation: 'RESERVE' | 'RELEASE'): BankCallbackFixture {
  const body: BankCallbackBody = {
    dealId: CANONICAL_TEST_DEAL_ID,
    eventId: operation === 'RESERVE' ? 'reserve-event-e2e' : 'release-event-e2e',
    operation,
    status: 'SUCCESS',
    bankRef: operation === 'RESERVE' ? 'reserve-ref-e2e' : 'release-ref-e2e',
    operationId: operation === 'RESERVE'
      ? `bank-reserve:${CANONICAL_TEST_DEAL_ID}`
      : `bank-release:${CANONICAL_TEST_DEAL_ID}`,
  };
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = buildBankSignaturePayload({
    partnerId: BANK_PARTNER_ID,
    keyId: BANK_KEY_ID,
    timestamp,
    eventId: body.eventId,
    body,
  });
  return {
    body,
    timestamp: String(timestamp),
    eventId: body.eventId,
    partnerId: BANK_PARTNER_ID,
    keyId: BANK_KEY_ID,
    signature: `hmac-sha256=${createHmac('sha256', BANK_SECRET).update(signed).digest('hex')}`,
  };
}

async function submitBankCallback(
  target: SettlementEngineController,
  fixture: BankCallbackFixture,
  options: { proveInvalidSignature?: boolean } = {},
) {
  if (options.proveInvalidSignature) {
    await expect(
      target.bankCallback(
        fixture.body,
        'hmac-sha256=invalid',
        fixture.timestamp,
        fixture.eventId,
        fixture.partnerId,
        fixture.keyId,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  }

  return target.bankCallback(
    fixture.body,
    fixture.signature,
    fixture.timestamp,
    fixture.eventId,
    fixture.partnerId,
    fixture.keyId,
  );
}

describe('persistent-auth-backed industrial one-deal exploitation and recovery gate', () => {
  const primary = createRuntime();
  const { prisma, rls, gateway, settlement } = primary;
  const usersByRole = new Map<Role, RequestUser>();
  const issuedUserCommands: IssuedUserCommand[] = [];
  let authHarness: PersistentActorHarness;

  beforeAll(async () => {
    if (!BANK_SECRET) throw new Error('BANK_HMAC_SECRET is required for signed callback fixtures.');
    await prisma.$connect();
    authHarness = await createPersistentActorHarness(CANONICAL_ORG_IDS);
    for (const [role, authenticatedActor] of authHarness.actorsByRole) usersByRole.set(role, authenticatedActor);
    expect(usersByRole.size).toBe(12);
  });

  afterAll(async () => {
    await Promise.allSettled([
      prisma.$disconnect(),
      authHarness?.disconnect(),
    ]);
  });

  function actor(role: Role): RequestUser {
    const user = usersByRole.get(role);
    if (!user) throw new Error(`Missing persistent authenticated actor for role ${role}`);
    return user;
  }

  async function withFreshRuntime<T>(work: (fresh: Runtime) => Promise<T>): Promise<T> {
    const fresh = createRuntime();
    await fresh.prisma.$connect();
    try {
      return await work(fresh);
    } finally {
      await fresh.prisma.$disconnect();
    }
  }

  async function workspace(role: Role, target = gateway): Promise<Workspace> {
    return target.workspace(CANONICAL_TEST_DEAL_ID, actor(role));
  }

  async function executeUserAction(
    actionId: UserActionId,
    options: { expectedUpdatedAt?: string; idempotencyKey?: string; commandId?: string } = {},
  ) {
    const role = actionRole[actionId];
    const authenticatedActor = actor(role);
    if (actionId === 'request_reserve' || actionId === 'request_release') {
      authHarness.primaryAuth.assertRecentFinancialMfa(authenticatedActor, DEAL_AMOUNT_KOPECKS);
    }
    const current = await workspace(role);
    const dto: ExecuteDealCommandDto = {
      commandId: options.commandId ?? `command-${actionId}`,
      idempotencyKey: options.idempotencyKey ?? `idempotency-${actionId}`,
      expectedUpdatedAt: options.expectedUpdatedAt ?? current.deal.updatedAt,
      payload: payload(actionId),
    };
    const raw = await gateway.executeUser(CANONICAL_TEST_DEAL_ID, actionId, dto, authenticatedActor);
    const receipt = requireReceipt(raw);
    issuedUserCommands.push({ actionId, role, dto, receipt });
    return receipt;
  }

  async function evidenceSnapshot(targetRls: RlsTransactionService, user: RequestUser) {
    return targetRls.withTrustedContext(user, async (tx) => {
      const [deal, participants, events, audits, outbox, ledger, bankOperations] = await Promise.all([
        tx.deal.findUnique({
          where: { id: CANONICAL_TEST_DEAL_ID },
          select: { id: true, status: true, nextAction: true, updatedAt: true, closedAt: true },
        }),
        tx.dealParticipant.findMany({
          where: { dealId: CANONICAL_TEST_DEAL_ID },
          select: { id: true, userId: true, organizationId: true, role: true, accessLevel: true, status: true },
          orderBy: { id: 'asc' },
        }),
        tx.dealEvent.findMany({
          where: { dealId: CANONICAL_TEST_DEAL_ID },
          select: { id: true, eventType: true, hash: true, prevHash: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        tx.auditEvent.findMany({
          where: { dealId: CANONICAL_TEST_DEAL_ID },
          select: { id: true, action: true, hash: true, prevHash: true, correlationId: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        tx.outboxEntry.findMany({
          where: { dealId: CANONICAL_TEST_DEAL_ID },
          select: { id: true, type: true, status: true, idempotencyKey: true, correlationId: true, auditId: true },
          orderBy: { id: 'asc' },
        }),
        tx.ledgerEntry.findMany({
          where: { dealId: CANONICAL_TEST_DEAL_ID },
          select: { id: true, entryType: true, amountKopecks: true, idempotencyKey: true, reference: true },
          orderBy: { id: 'asc' },
        }),
        tx.bankOperation.findMany({
          where: { dealId: CANONICAL_TEST_DEAL_ID },
          select: { id: true, type: true, status: true, bankRef: true, idempotencyKey: true },
          orderBy: { id: 'asc' },
        }),
      ]);
      return { deal, participants, events, audits, outbox, ledger, bankOperations };
    });
  }

  async function proveForcedRollback(): Promise<void> {
    const accounting = actor(Role.ACCOUNTING);
    const marker = 'forced-recovery-rollback';
    const before = await evidenceSnapshot(rls, accounting);

    await expect(
      rls.withTrustedContext(
        accounting,
        async (tx) => {
          await tx.deal.update({
            where: { id: CANONICAL_TEST_DEAL_ID },
            data: { nextAction: marker },
          });
          await tx.dealEvent.create({
            data: {
              id: `event:${marker}`,
              dealId: CANONICAL_TEST_DEAL_ID,
              eventType: 'FORCED_ROLLBACK_PROBE',
              actorId: accounting.id,
              actorRole: String(accounting.role),
              tenantId: accounting.tenantId,
              payload: { marker },
              hash: `hash:${marker}:event`,
            },
          });
          await tx.auditEvent.create({
            data: {
              id: `audit:${marker}`,
              action: 'recovery.rollback.probe',
              actorUserId: accounting.id,
              actorRole: String(accounting.role),
              tenantId: accounting.tenantId,
              orgId: accounting.orgId,
              dealId: CANONICAL_TEST_DEAL_ID,
              objectType: 'deal',
              objectId: CANONICAL_TEST_DEAL_ID,
              outcome: 'FORCED_FAILURE',
              correlationId: marker,
              hash: `hash:${marker}:audit`,
            },
          });
          await tx.ledgerEntry.create({
            data: {
              id: `ledger:${marker}`,
              dealId: CANONICAL_TEST_DEAL_ID,
              entryType: 'ROLLBACK_PROBE',
              debitAccount: accounting.orgId,
              creditAccount: `escrow:${CANONICAL_TEST_DEAL_ID}`,
              amountKopecks: 1,
              idempotencyKey: `ledger:${marker}`,
              createdByUserId: accounting.id,
            },
          });
          await tx.outboxEntry.create({
            data: {
              id: `outbox:${marker}`,
              type: 'recovery.rollback.probe',
              dealId: CANONICAL_TEST_DEAL_ID,
              payload: { marker },
              status: 'PENDING',
              idempotencyKey: `outbox:${marker}`,
              correlationId: marker,
              auditId: `audit:${marker}`,
            },
          });
          throw new Error(marker);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    ).rejects.toThrow(marker);

    expect(await evidenceSnapshot(rls, accounting)).toEqual(before);
  }

  async function proveLogisticsAuthority(): Promise<void> {
    const logistician = actor(Role.LOGISTICIAN);
    const driver = actor(Role.DRIVER);
    const issued = issuedUserCommands.find((item) => item.actionId === 'assign_logistics');
    if (!issued) throw new Error('assign_logistics receipt is missing');

    const repository = new PrismaShipmentRepository(rls);
    const publicShipment = await repository.getById(SHIPMENT_ID, driver);
    expect(publicShipment).not.toHaveProperty('driverPinHash');

    const authority = await rls.withTrustedContext(logistician, async (tx) => {
      const admissions = await tx.$queryRaw<Array<{ status: string; consumed_by_command_id: string }>>(Prisma.sql`
        SELECT status, consumed_by_command_id
        FROM logistics.deal_admissions
        WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
      `);
      const bindings = await tx.$queryRaw<Array<{ shipment_id: string; command_id: string }>>(Prisma.sql`
        SELECT shipment_id, command_id
        FROM logistics.shipment_bindings
        WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
      `);
      return { admissions, bindings };
    });
    expect(authority.admissions).toEqual([{ status: 'CONSUMED', consumed_by_command_id: issued.dto.commandId }]);
    expect(authority.bindings).toEqual([{ shipment_id: SHIPMENT_ID, command_id: issued.dto.commandId }]);

    await expect(gateway.executeUser(
      CANONICAL_TEST_DEAL_ID,
      'assign_logistics',
      issued.dto,
      logistician,
    )).resolves.toMatchObject({ duplicate: true, commandId: issued.dto.commandId });

    const gpsCommand = {
      commandId: 'command-logistics-gps-1',
      idempotencyKey: 'idempotency-logistics-gps-1',
      expectedVersion: publicShipment.version.toString(),
      recordedAt: '2026-07-12T09:45:00.000Z',
      lat: 52.7212,
      lng: 41.4523,
      speedKmh: 42,
      accuracyM: 5,
    };
    const gps = await repository.recordGps(SHIPMENT_ID, gpsCommand, driver);
    expect(gps).toMatchObject({ duplicate: false, gpsPoint: { shipmentId: SHIPMENT_ID } });
    await expect(repository.recordGps(SHIPMENT_ID, gpsCommand, driver)).resolves.toMatchObject({
      duplicate: true,
      gpsPoint: { id: gps.gpsPoint?.id },
    });

    await expect(repository.recordCheckpoint(SHIPMENT_ID, {
      commandId: 'command-logistics-stale-checkpoint',
      idempotencyKey: 'idempotency-logistics-stale-checkpoint',
      expectedVersion: publicShipment.version.toString(),
      type: 'DRIVER_CONFIRMED',
      occurredAt: '2026-07-12T09:46:00.000Z',
    }, driver)).rejects.toBeInstanceOf(ConflictException);

    const afterGps = await repository.getById(SHIPMENT_ID, driver);
    const checkpointCommand = {
      commandId: 'command-logistics-checkpoint-1',
      idempotencyKey: 'idempotency-logistics-checkpoint-1',
      expectedVersion: afterGps.version.toString(),
      type: 'DRIVER_CONFIRMED',
      occurredAt: '2026-07-12T09:46:00.000Z',
    };
    const checkpoint = await repository.recordCheckpoint(SHIPMENT_ID, checkpointCommand, driver);
    await expect(repository.recordCheckpoint(SHIPMENT_ID, checkpointCommand, driver)).resolves.toMatchObject({
      duplicate: true,
      checkpoint: { id: checkpoint.checkpoint?.id },
    });

    const afterCheckpoint = await repository.getById(SHIPMENT_ID, driver);
    const pinCommand = {
      commandId: 'command-logistics-pin-1',
      idempotencyKey: 'idempotency-logistics-pin-1',
      expectedVersion: afterCheckpoint.version.toString(),
      pin: '246810',
    };
    const pin = await repository.verifyPin(SHIPMENT_ID, pinCommand, driver);
    expect(pin).toMatchObject({ duplicate: false, valid: true, shipment: { pinVerified: true } });
    await expect(repository.verifyPin(SHIPMENT_ID, pinCommand, driver)).resolves.toMatchObject({
      duplicate: true,
      valid: true,
    });

    const sameTenantOutsider: RequestUser = {
      ...logistician,
      id: 'same-tenant-logistics-outsider',
      sessionId: 'same-tenant-logistics-outsider-session',
    };
    await expect(repository.getById(SHIPMENT_ID, sameTenantOutsider)).rejects.toBeInstanceOf(NotFoundException);
    await expect(repository.getById(SHIPMENT_ID, { ...driver, tenantId: 'tenant-other' })).rejects.toBeInstanceOf(NotFoundException);

    await expect(rls.withTrustedContext(logistician, (tx) => tx.shipment.update({
      where: { id: SHIPMENT_ID },
      data: { vehicleNumber: 'vehicle-forged-reassignment' },
    }))).rejects.toThrow(/immutable/i);

    await withFreshRuntime(async (fresh) => {
      const freshRepository = new PrismaShipmentRepository(fresh.rls);
      const workspace = await freshRepository.workspace(SHIPMENT_ID, driver);
      expect(workspace.gpsTrack).toEqual([expect.objectContaining({ id: gps.gpsPoint?.id })]);
      expect(workspace.checkpoints).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: checkpoint.checkpoint?.id }),
      ]));
      expect(workspace.shipment).toMatchObject({ pinVerified: true });
      expect(workspace.shipment).not.toHaveProperty('driverPinHash');
    });

    const atomic = await rls.withTrustedContext(logistician, async (tx) => ({
      gpsAudit: await tx.auditEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, action: 'shipment.gps.record' } }),
      gpsOutbox: await tx.outboxEntry.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, type: 'shipment.gps.recorded', status: 'PENDING' } }),
      checkpointAudit: await tx.auditEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, action: 'shipment.checkpoint.record' } }),
      checkpointOutbox: await tx.outboxEntry.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, type: 'shipment.checkpoint.recorded', status: 'PENDING' } }),
      pinAudit: await tx.auditEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, action: 'shipment.pin.verify' } }),
      pinOutbox: await tx.outboxEntry.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, type: 'shipment.pin.verification.recorded', status: 'PENDING' } }),
    }));
    expect(atomic).toEqual({
      gpsAudit: 1,
      gpsOutbox: 1,
      checkpointAudit: 1,
      checkpointOutbox: 1,
      pinAudit: 1,
      pinOutbox: 1,
    });
  }

  async function proveRlsPoolIsolation(): Promise<void> {
    const valid = actor(Role.BUYER);
    const wrongTenant = { ...valid, tenantId: 'tenant-other', sessionId: 'rls-wrong-tenant' };

    const probe = async (user: RequestUser) => rls.withTrustedContext(user, async (tx) => {
      const dealCount = await tx.deal.count({ where: { id: CANONICAL_TEST_DEAL_ID } });
      const settings = await tx.$queryRaw<Array<{
        user_id: string | null;
        org_id: string | null;
        tenant_id: string | null;
        role_id: string | null;
        session_id: string | null;
      }>>(Prisma.sql`
        SELECT
          NULLIF(current_setting('app.current_user_id', true), '') AS user_id,
          NULLIF(current_setting('app.current_org_id', true), '') AS org_id,
          NULLIF(current_setting('app.current_tenant_id', true), '') AS tenant_id,
          NULLIF(current_setting('app.current_role', true), '') AS role_id,
          NULLIF(current_setting('app.current_session_id', true), '') AS session_id
      `);
      return { dealCount, settings: settings[0] };
    });

    const sequentialValid = await probe(valid);
    expect(sequentialValid.dealCount).toBe(1);
    expect(sequentialValid.settings).toMatchObject({
      user_id: valid.id,
      org_id: valid.orgId,
      tenant_id: valid.tenantId,
      role_id: String(valid.role),
      session_id: valid.sessionId,
    });

    const sequentialWrong = await probe(wrongTenant);
    expect(sequentialWrong.dealCount).toBe(0);
    expect(sequentialWrong.settings?.tenant_id).toBe('tenant-other');

    const sequentialValidAgain = await probe(valid);
    expect(sequentialValidAgain.dealCount).toBe(1);
    expect(sequentialValidAgain.settings?.tenant_id).toBe(valid.tenantId);

    const parallel = await Promise.all(
      Array.from({ length: 16 }, (_, index) => {
        const allowed = index % 2 === 0;
        const user = allowed
          ? { ...valid, sessionId: `parallel-valid-${index}` }
          : { ...wrongTenant, sessionId: `parallel-wrong-${index}` };
        return probe(user).then((result) => ({ allowed, user, result }));
      }),
    );

    for (const item of parallel) {
      expect(item.result.dealCount).toBe(item.allowed ? 1 : 0);
      expect(item.result.settings).toMatchObject({
        user_id: item.user.id,
        org_id: item.user.orgId,
        tenant_id: item.user.tenantId,
        role_id: String(item.user.role),
        session_id: item.user.sessionId,
      });
    }

    const ambient = await prisma.$queryRaw<Array<{
      user_id: string | null;
      org_id: string | null;
      tenant_id: string | null;
      role_id: string | null;
      session_id: string | null;
    }>>(Prisma.sql`
      SELECT
        NULLIF(current_setting('app.current_user_id', true), '') AS user_id,
        NULLIF(current_setting('app.current_org_id', true), '') AS org_id,
        NULLIF(current_setting('app.current_tenant_id', true), '') AS tenant_id,
        NULLIF(current_setting('app.current_role', true), '') AS role_id,
        NULLIF(current_setting('app.current_session_id', true), '') AS session_id
    `);
    expect(ambient[0]).toEqual({
      user_id: null,
      org_id: null,
      tenant_id: null,
      role_id: null,
      session_id: null,
    });
  }

  it('executes one factual deal with persistent identity, MFA, recovery and RLS isolation', async () => {
    const roleViews = await Promise.all(
      [...usersByRole.keys()].map(async (role) => ({ role, view: await workspace(role) })),
    );
    expect(new Set(roleViews.map(({ view }) => view.deal.id))).toEqual(new Set([CANONICAL_TEST_DEAL_ID]));
    expect(new Set(roleViews.map(({ view }) => view.deal.status))).toEqual(new Set(['DRAFT']));

    await authHarness.verifyWithFreshInstance();

    const sellerWithSpoofedOrg = { ...actor(Role.FARMER), orgId: 'org-canonical-buyer' };
    await expect(gateway.workspace(CANONICAL_TEST_DEAL_ID, sellerWithSpoofedOrg)).resolves.toMatchObject({
      deal: { id: CANONICAL_TEST_DEAL_ID, sellerOrgId: 'org-canonical-seller' },
    });

    const wrongTenant = { ...actor(Role.BUYER), tenantId: 'tenant-other' };
    await expect(gateway.workspace(CANONICAL_TEST_DEAL_ID, wrongTenant)).rejects.toBeInstanceOf(ForbiddenException);

    const rawCrossTenant = { ...actor(Role.BUYER), tenantId: 'tenant-other', sessionId: 'cross-tenant-session' };
    await expect(
      rls.withTrustedContext(rawCrossTenant, (tx) => tx.deal.findMany({ where: { id: CANONICAL_TEST_DEAL_ID } })),
    ).resolves.toEqual([]);

    await proveRlsPoolIsolation();
    await proveForcedRollback();

    const releaseCallback = bankCallbackFixture('RELEASE');
    const beforeOutOfOrderRelease = await evidenceSnapshot(rls, actor(Role.ACCOUNTING));
    await expect(submitBankCallback(settlement, releaseCallback)).rejects.toBeInstanceOf(ConflictException);
    expect(await evidenceSnapshot(rls, actor(Role.ACCOUNTING))).toEqual(beforeOutOfOrderRelease);

    const initial = await workspace(Role.COMPLIANCE_OFFICER);
    const approveDto: ExecuteDealCommandDto = {
      commandId: 'command-approve',
      idempotencyKey: 'idempotency-approve',
      expectedUpdatedAt: initial.deal.updatedAt,
      payload: {},
    };
    const approvalReceipt = requireReceipt(await gateway.executeUser(
      CANONICAL_TEST_DEAL_ID,
      'approve_admission',
      approveDto,
      actor(Role.COMPLIANCE_OFFICER),
    ));
    issuedUserCommands.push({
      actionId: 'approve_admission',
      role: Role.COMPLIANCE_OFFICER,
      dto: approveDto,
      receipt: approvalReceipt,
    });
    expect(approvalReceipt).toMatchObject({ status: 'ADMISSION_APPROVED', duplicate: false });

    await expect(
      gateway.executeUser(CANONICAL_TEST_DEAL_ID, 'approve_admission', approveDto, actor(Role.COMPLIANCE_OFFICER)),
    ).resolves.toMatchObject({ status: 'ADMISSION_APPROVED', duplicate: true });

    await expect(
      gateway.executeUser(
        CANONICAL_TEST_DEAL_ID,
        'publish_auction',
        { ...approveDto, commandId: 'different-command' },
        actor(Role.FARMER),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const auctionWorkspace = await workspace(Role.FARMER);
    const auctionDtos: ExecuteDealCommandDto[] = [
      {
        commandId: 'command-auction-a',
        idempotencyKey: 'idempotency-auction-a',
        expectedUpdatedAt: auctionWorkspace.deal.updatedAt,
        payload: {},
      },
      {
        commandId: 'command-auction-b',
        idempotencyKey: 'idempotency-auction-b',
        expectedUpdatedAt: auctionWorkspace.deal.updatedAt,
        payload: {},
      },
    ];
    const concurrent = await Promise.allSettled(
      auctionDtos.map((dto) => gateway.executeUser(
        CANONICAL_TEST_DEAL_ID,
        'publish_auction',
        dto,
        actor(Role.FARMER),
      )),
    );
    const winners = concurrent.flatMap((item, index) => item.status === 'fulfilled'
      ? [{ index, receipt: requireReceipt(item.value) }]
      : []);
    expect(winners).toHaveLength(1);
    expect(concurrent.filter((item) => item.status === 'rejected')).toHaveLength(1);
    const auctionWinner = winners[0];
    if (!auctionWinner) throw new Error('Concurrent auction command produced no winner.');
    issuedUserCommands.push({
      actionId: 'publish_auction',
      role: Role.FARMER,
      dto: auctionDtos[auctionWinner.index],
      receipt: auctionWinner.receipt,
    });

    await expect(
      executeUserAction('place_winning_bid', {
        expectedUpdatedAt: auctionWorkspace.deal.updatedAt,
        idempotencyKey: 'idempotency-stale-bid',
        commandId: 'command-stale-bid',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    await executeUserAction('place_winning_bid');
    await executeUserAction('seller_sign_contract');
    await executeUserAction('buyer_sign_contract');
    await executeUserAction('request_reserve');

    const reservePending = await workspace(Role.ACCOUNTING);
    await expect(
      gateway.executeUser(
        CANONICAL_TEST_DEAL_ID,
        'confirm_reserve',
        {
          commandId: 'human-reserve-confirm',
          idempotencyKey: 'human-reserve-confirm',
          expectedUpdatedAt: reservePending.deal.updatedAt,
          payload: { bankRef: 'human-ref' },
        },
        actor(Role.ACCOUNTING),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const reserveCallback = bankCallbackFixture('RESERVE');
    await withFreshRuntime(async (fresh) => {
      expect((await workspace(Role.ACCOUNTING, fresh.gateway)).deal.status).toBe('RESERVE_REQUESTED');
      const durablePending = await fresh.rls.withTrustedContext(actor(Role.ACCOUNTING), async (tx) => {
        const [operation, pendingOutbox, receipt] = await Promise.all([
          tx.bankOperation.findUnique({ where: { id: `bank-reserve:${CANONICAL_TEST_DEAL_ID}` } }),
          tx.outboxEntry.findFirst({
            where: {
              dealId: CANONICAL_TEST_DEAL_ID,
              correlationId: 'command-request_reserve',
              status: 'PENDING',
            },
          }),
          tx.outboxEntry.findFirst({
            where: {
              dealId: CANONICAL_TEST_DEAL_ID,
              correlationId: 'command-request_reserve',
              type: 'deal.command.receipt',
              status: 'CONFIRMED',
            },
          }),
        ]);
        return { operation, pendingOutbox, receipt };
      });
      expect(durablePending.operation).toMatchObject({ type: 'RESERVE', status: 'PENDING' });
      expect(durablePending.pendingOutbox).not.toBeNull();
      expect(durablePending.receipt).not.toBeNull();
      await expect(
        submitBankCallback(fresh.settlement, reserveCallback, { proveInvalidSignature: true }),
      ).resolves.toMatchObject({ status: 'RESERVED', duplicate: false });
    });

    expect((await workspace(Role.ACCOUNTING)).deal.status).toBe('RESERVED');
    const beforeReserveReplay = await evidenceSnapshot(rls, actor(Role.ACCOUNTING));
    await expect(submitBankCallback(settlement, reserveCallback)).resolves.toMatchObject({
      status: 'RESERVED',
      duplicate: true,
    });
    expect(await evidenceSnapshot(rls, actor(Role.ACCOUNTING))).toEqual(beforeReserveReplay);

    await executeUserAction('assign_logistics');
    await proveLogisticsAuthority();
    await executeUserAction('confirm_loading');
    await executeUserAction('start_transit');
    await executeUserAction('confirm_arrival');
    await executeUserAction('confirm_weight');
    await executeUserAction('confirm_inspection');
    await executeUserAction('finalize_lab');
    await executeUserAction('accept_delivery');
    await executeUserAction('complete_documents');
    await executeUserAction('request_release');

    await withFreshRuntime(async (fresh) => {
      expect((await workspace(Role.ACCOUNTING, fresh.gateway)).deal.status).toBe('RELEASE_REQUESTED');
      await expect(
        submitBankCallback(fresh.settlement, releaseCallback, { proveInvalidSignature: true }),
      ).resolves.toMatchObject({ status: 'RELEASED', duplicate: false });
    });

    const beforeReleaseReplay = await evidenceSnapshot(rls, actor(Role.ACCOUNTING));
    await expect(submitBankCallback(settlement, releaseCallback)).resolves.toMatchObject({
      status: 'RELEASED',
      duplicate: true,
    });
    expect(await evidenceSnapshot(rls, actor(Role.ACCOUNTING))).toEqual(beforeReleaseReplay);

    await executeUserAction('close_deal');

    const operator = actor(Role.SUPPORT_MANAGER);
    const reconciled = await rls.withTrustedContext(operator, async (tx) => {
      const [
        deal,
        participants,
        events,
        audits,
        outbox,
        documents,
        shipment,
        sample,
        acceptance,
        payment,
        bankOperations,
        ledger,
      ] = await Promise.all([
        tx.deal.findUnique({ where: { id: CANONICAL_TEST_DEAL_ID } }),
        tx.dealParticipant.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { id: 'asc' } }),
        tx.dealEvent.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { createdAt: 'asc' } }),
        tx.auditEvent.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { createdAt: 'asc' } }),
        tx.outboxEntry.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.dealDocument.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.shipment.findUnique({ where: { id: SHIPMENT_ID } }),
        tx.labSample.findUnique({ where: { id: SAMPLE_ID }, include: { tests: true } }),
        tx.acceptanceRecord.findUnique({ where: { id: ACCEPTANCE_ID } }),
        tx.payment.findUnique({ where: { id: `payment:${CANONICAL_TEST_DEAL_ID}` } }),
        tx.bankOperation.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { type: 'asc' } }),
        tx.ledgerEntry.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { createdAt: 'asc' } }),
      ]);
      return {
        deal,
        participants,
        events,
        audits,
        outbox,
        documents,
        shipment,
        sample,
        acceptance,
        payment,
        bankOperations,
        ledger,
      };
    });

    // Money columns are BIGINT: raw reads return bigint kopecks.
    expect(reconciled.deal).toMatchObject({ status: 'CLOSED', totalKopecks: BigInt(DEAL_AMOUNT_KOPECKS) });
    expect(reconciled.participants).toHaveLength(12);
    expect(reconciled.participants.filter((item) => item.role === Role.EXECUTIVE)).toEqual([
      expect.objectContaining({ accessLevel: 'READ', status: 'ACTIVE' }),
    ]);
    expect(reconciled.events).toHaveLength(DEAL_ACTIONS.length);
    expect(reconciled.audits).toHaveLength(DEAL_ACTIONS.length);
    expect(reconciled.outbox.filter((item) => item.type === 'deal.command.receipt')).toHaveLength(DEAL_ACTIONS.length);
    expect(reconciled.documents.length).toBeGreaterThanOrEqual(6);
    const requiredReleaseTypes = new Set(['CONTRACT', 'TTN', 'WEIGHING_ACT', 'LAB_PROTOCOL', 'ACCEPTANCE_ACT']);
    expect(reconciled.documents.filter((item) => requiredReleaseTypes.has(item.type)).every((item) => item.status === 'SIGNED')).toBe(true);
    expect(reconciled.documents.find((item) => item.type === 'INSPECTION_REPORT')).toMatchObject({ status: 'VALIDATED' });
    expect(reconciled.shipment).toMatchObject({ status: 'ARRIVED', vehicleNumber: VEHICLE_ID, driverUserId: 'driver-e2e' });
    expect(reconciled.sample).toMatchObject({ status: 'DONE', protocol: `PROTOCOL-${CANONICAL_TEST_DEAL_ID}` });
    expect(reconciled.sample?.tests).toHaveLength(2);
    expect(reconciled.acceptance).toMatchObject({ status: 'ACCEPTED', qualityStatus: 'PASSED' });
    expect(reconciled.payment).toMatchObject({
      status: 'RELEASED',
      callbackState: 'CONFIRMED',
      bankRef: 'release-ref-e2e',
    });
    expect(reconciled.bankOperations).toHaveLength(2);
    expect(reconciled.bankOperations.every((item) => item.status === 'DONE')).toBe(true);
    expect(reconciled.ledger.map((item) => item.entryType)).toEqual(['RESERVE', 'RELEASE']);

    const beforeFullRecoveryReplay = await evidenceSnapshot(rls, operator);
    await withFreshRuntime(async (fresh) => {
      for (const issued of issuedUserCommands) {
        const replay = requireReceipt(await fresh.gateway.executeUser(
          CANONICAL_TEST_DEAL_ID,
          issued.actionId,
          issued.dto,
          actor(issued.role),
        ));
        expect(replay).toMatchObject({
          duplicate: true,
          commandId: issued.receipt.commandId,
          actionId: issued.actionId,
          eventId: issued.receipt.eventId,
          auditId: issued.receipt.auditId,
        });
      }
      await expect(submitBankCallback(fresh.settlement, reserveCallback)).resolves.toMatchObject({
        status: 'RESERVED',
        duplicate: true,
      });
      await expect(submitBankCallback(fresh.settlement, releaseCallback)).resolves.toMatchObject({
        status: 'RELEASED',
        duplicate: true,
      });
    });
    expect(await evidenceSnapshot(rls, operator)).toEqual(beforeFullRecoveryReplay);

    const executive = actor(Role.EXECUTIVE);
    const executiveToken = authHarness.accessTokensByRole.get(Role.EXECUTIVE);
    if (!executive.membershipId || !executiveToken) throw new Error('Executive persistent session proof is incomplete');
    await authHarness.primaryPrisma.userOrg.update({
      where: { id: executive.membershipId },
      data: { role: Role.GUEST },
    });
    await expect(authHarness.verifierAuth.verifyAccessToken(executiveToken)).rejects.toThrow(/revoked|not active/i);
    await authHarness.primaryPrisma.userOrg.update({
      where: { id: executive.membershipId },
      data: { role: Role.EXECUTIVE },
    });

    process.stdout.write(`${JSON.stringify({
      e2e: 'passed',
      identity: 'persistent-postgresql',
      mfa: 'passed',
      authRestart: 'passed',
      membershipRevocation: 'passed',
      recovery: 'passed',
      dealId: reconciled.deal?.id,
      status: reconciled.deal?.status,
      roles: usersByRole.size,
      actions: DEAL_ACTIONS.length,
      replayedUserCommands: issuedUserCommands.length,
      events: reconciled.events.length,
      audits: reconciled.audits.length,
      outbox: reconciled.outbox.length,
      documents: reconciled.documents.length,
      bankOperations: reconciled.bankOperations.length,
      ledgerEntries: reconciled.ledger.length,
    })}\n`);
  });
});
