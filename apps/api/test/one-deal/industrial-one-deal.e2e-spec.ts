import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../src/common/types/request-user';
import { Role } from '../../src/common/types/request-user';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import {
  CANONICAL_TEST_DEAL_ID,
  DEAL_ACTIONS,
  type DealActionId,
} from '../../src/modules/deals/deal-command.policy';
import { BankKeyRegistryService } from '../../src/modules/settlement-engine/bank-key-registry.service';
import { IntegrationEventsService } from '../../src/modules/integration-events/integration-events.service';
import {
  buildBankSignaturePayload,
  SettlementEngineController,
} from '../../src/modules/settlement-engine/settlement-engine.controller';
import {
  createPersistentActorHarness,
  type PersistentActorHarness,
} from './persistent-auth-actors';
import {
  createInstance,
  destroyInstance,
  prepareLaboratoryLifecycle,
  type DealFixture,
  type ServiceInstance,
} from '../industrial/harness';

jest.setTimeout(300_000);

const BANK_SECRET = process.env.BANK_HMAC_SECRET ?? '';
const BANK_PARTNER_ID = process.env.BANK_PARTNER_ID ?? 'safe-deals';
const BANK_KEY_ID = process.env.BANK_HMAC_KEY_ID ?? 'primary';
const DEAL_AMOUNT_KOPECKS = 240_000_000n;
const SHIPMENT_ID = `shipment:${CANONICAL_TEST_DEAL_ID}`;
const ACCEPTANCE_ID = `acceptance:${CANONICAL_TEST_DEAL_ID}`;
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
type IssuedCommand = Readonly<{
  actionId: UserActionId;
  role: Role;
  dto: ExecuteDealCommandDto;
  receipt: Record<string, unknown>;
}>;

type BankCallbackFixture = Readonly<{
  body: {
    dealId: string;
    eventId: string;
    operation: 'RESERVE' | 'RELEASE';
    status: 'SUCCESS';
    bankRef: string;
    operationId: string;
  };
  timestamp: string;
  eventId: string;
  partnerId: string;
  keyId: string;
  signature: string;
}>;

const ACTION_ROLE: Record<UserActionId, Role> = {
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

function callbackFixture(operation: 'RESERVE' | 'RELEASE'): BankCallbackFixture {
  const body = {
    dealId: CANONICAL_TEST_DEAL_ID,
    eventId: operation === 'RESERVE' ? 'reserve-event-e2e' : 'release-event-e2e',
    operation,
    status: 'SUCCESS' as const,
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

function settlement(instance: ServiceInstance): SettlementEngineController {
  return new SettlementEngineController(
    {} as never,
    instance.gateway,
    new BankKeyRegistryService(instance.prisma),
    new IntegrationEventsService(instance.prisma),
  );
}

async function submitCallback(
  controller: SettlementEngineController,
  fixture: BankCallbackFixture,
  proveInvalid = false,
) {
  if (proveInvalid) {
    await expect(controller.bankCallback(
      fixture.body,
      'hmac-sha256=invalid',
      fixture.timestamp,
      fixture.eventId,
      fixture.partnerId,
      fixture.keyId,
    )).rejects.toBeInstanceOf(UnauthorizedException);
  }
  return controller.bankCallback(
    fixture.body,
    fixture.signature,
    fixture.timestamp,
    fixture.eventId,
    fixture.partnerId,
    fixture.keyId,
  );
}

function payload(fixture: DealFixture, actionId: DealActionId): Prisma.InputJsonObject {
  switch (actionId) {
    case 'seller_sign_contract':
      return { documentId: CONTRACT_ID, signedAt: '2026-07-12T09:00:00.000Z', signatureEvidenceRef: evidence('seller-signature') };
    case 'buyer_sign_contract':
      return { documentId: CONTRACT_ID, signedAt: '2026-07-12T09:05:00.000Z', signatureEvidenceRef: evidence('buyer-signature') };
    case 'assign_logistics':
      return {
        carrierOrgId: 'org-canonical-logistics',
        driverUserId: fixture.users.driver.id,
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
      return { sampleId: fixture.sampleId, signedEvidenceRef: fixture.evidence.lab };
    case 'accept_delivery':
      return { acceptanceId: ACCEPTANCE_ID, acceptedAt: '2026-07-12T15:30:00.000Z', evidenceRef: evidence('acceptance') };
    default:
      return {};
  }
}

describe('persistent-auth-backed industrial one-deal exploitation and recovery gate', () => {
  let instance: ServiceInstance;
  let auth: PersistentActorHarness;
  let fixture: DealFixture;
  const users = new Map<Role, RequestUser>();
  const issued: IssuedCommand[] = [];

  function actor(role: Role): RequestUser {
    const user = users.get(role);
    if (!user) throw new Error(`Missing persistent actor for ${role}`);
    return user;
  }

  beforeAll(async () => {
    if (!BANK_SECRET) throw new Error('BANK_HMAC_SECRET is required.');
    instance = await createInstance();
    auth = await createPersistentActorHarness(CANONICAL_ORG_IDS);
    for (const [role, user] of auth.actorsByRole) users.set(role, user);
    expect(users.size).toBe(12);
    fixture = {
      dealId: CANONICAL_TEST_DEAL_ID,
      sellerOrgId: 'org-canonical-seller',
      buyerOrgId: 'org-canonical-buyer',
      serviceOrgId: 'org-canonical-lab',
      totalKopecks: DEAL_AMOUNT_KOPECKS,
      shipmentId: SHIPMENT_ID,
      acceptanceId: ACCEPTANCE_ID,
      sampleId: `unassigned:${CANONICAL_TEST_DEAL_ID}`,
      contractDocumentId: CONTRACT_ID,
      inspectionDocumentId: INSPECTION_ID,
      vehicleId: VEHICLE_ID,
      routeFromFacilityId: ROUTE_FROM_ID,
      routeToFacilityId: ROUTE_TO_ID,
      evidence: Object.fromEntries(
        ['seller-signature', 'buyer-signature', 'loading', 'departure', 'arrival', 'weighing', 'inspection', 'acceptance']
          .map((kind) => [kind, evidence(kind)]),
      ),
      users: {
        compliance: actor(Role.COMPLIANCE_OFFICER),
        farmer: actor(Role.FARMER),
        buyer: actor(Role.BUYER),
        logistician: actor(Role.LOGISTICIAN),
        driver: actor(Role.DRIVER),
        elevator: actor(Role.ELEVATOR),
        surveyor: actor(Role.SURVEYOR),
        lab: actor(Role.LAB),
        accounting: actor(Role.ACCOUNTING),
        operator: actor(Role.SUPPORT_MANAGER),
      },
    };
  });

  afterAll(async () => {
    await Promise.allSettled([destroyInstance(instance), auth?.disconnect()]);
  });

  async function execute(actionId: UserActionId) {
    const role = ACTION_ROLE[actionId];
    const user = actor(role);
    if (actionId === 'request_reserve' || actionId === 'request_release') {
      auth.primaryAuth.assertRecentFinancialMfa(user, Number(DEAL_AMOUNT_KOPECKS));
    }
    const workspace = await instance.gateway.workspace(CANONICAL_TEST_DEAL_ID, user);
    const dto: ExecuteDealCommandDto = {
      commandId: `command-${actionId}`,
      idempotencyKey: `idempotency-${actionId}`,
      expectedUpdatedAt: workspace.deal.updatedAt,
      expectedVersion: String(workspace.deal.version),
      payload: payload(fixture, actionId),
    };
    const receipt = await instance.gateway.executeUser(CANONICAL_TEST_DEAL_ID, actionId, dto, user) as Record<string, unknown>;
    expect(receipt).toMatchObject({ duplicate: false, actionId, commandId: dto.commandId });
    issued.push({ actionId, role, dto, receipt });
    return receipt;
  }

  it('executes one canonical factual Deal through PostgreSQL authority, restart and RLS denial', async () => {
    const roleViews = await Promise.all([...users.keys()].map((role) => instance.gateway.workspace(CANONICAL_TEST_DEAL_ID, actor(role))));
    expect(roleViews.every((view) => view.deal.id === CANONICAL_TEST_DEAL_ID)).toBe(true);
    expect(roleViews.every((view) => view.deal.status === 'DRAFT')).toBe(true);
    await auth.verifyWithFreshInstance();

    const wrongTenant = { ...actor(Role.BUYER), tenantId: 'tenant-other', sessionId: 'wrong-tenant' };
    await expect(instance.gateway.workspace(CANONICAL_TEST_DEAL_ID, wrongTenant)).rejects.toBeInstanceOf(ForbiddenException);

    const reserve = callbackFixture('RESERVE');
    const release = callbackFixture('RELEASE');
    await expect(submitCallback(settlement(instance), release)).rejects.toBeInstanceOf(ConflictException);

    for (const actionId of [
      'approve_admission',
      'publish_auction',
      'place_winning_bid',
      'seller_sign_contract',
      'buyer_sign_contract',
      'request_reserve',
    ] as const) await execute(actionId);

    await expect(submitCallback(settlement(instance), reserve, true)).resolves.toMatchObject({ status: 'RESERVED', duplicate: false });
    await expect(submitCallback(settlement(instance), reserve)).resolves.toMatchObject({ status: 'RESERVED', duplicate: true });

    for (const actionId of [
      'assign_logistics',
      'confirm_loading',
      'start_transit',
      'confirm_arrival',
      'confirm_weight',
      'confirm_inspection',
    ] as const) await execute(actionId);

    await prepareLaboratoryLifecycle(instance, fixture);
    await execute('finalize_lab');
    await execute('accept_delivery');
    await execute('complete_documents');
    await execute('request_release');

    await expect(submitCallback(settlement(instance), release, true)).resolves.toMatchObject({ status: 'RELEASED', duplicate: false });
    await expect(submitCallback(settlement(instance), release)).resolves.toMatchObject({ status: 'RELEASED', duplicate: true });
    await execute('close_deal');

    const operator = actor(Role.SUPPORT_MANAGER);
    const facts = await instance.rls.withTrustedContext(operator, async (tx) => {
      const [deal, participants, events, audits, outbox, ledger, operations, sample, protocols] = await Promise.all([
        tx.deal.findUniqueOrThrow({ where: { id: CANONICAL_TEST_DEAL_ID } }),
        tx.dealParticipant.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.dealEvent.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { createdAt: 'asc' } }),
        tx.auditEvent.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.outboxEntry.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.ledgerEntry.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { createdAt: 'asc' } }),
        tx.bankOperation.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.labSample.findUniqueOrThrow({ where: { id: fixture.sampleId }, include: { tests: true } }),
        tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM labs.protocols WHERE sample_id = ${fixture.sampleId}`),
      ]);
      return { deal, participants, events, audits, outbox, ledger, operations, sample, protocols };
    });

    expect(facts.deal).toMatchObject({ status: 'CLOSED', totalKopecks: DEAL_AMOUNT_KOPECKS });
    expect(facts.participants).toHaveLength(12);
    expect(facts.events).toHaveLength(DEAL_ACTIONS.length);
    expect(facts.events.slice(1).every((event, index) => event.prevHash === facts.events[index].hash)).toBe(true);
    expect(facts.ledger.map((entry) => entry.entryType)).toEqual(['RESERVE', 'RELEASE']);
    expect(facts.operations).toHaveLength(2);
    expect(facts.operations.every((operation) => operation.status === 'DONE')).toBe(true);
    expect(facts.sample.status).toBe('FINALIZED');
    expect(facts.sample.tests).toHaveLength(2);
    expect(facts.protocols).toHaveLength(1);
    expect(facts.audits.length).toBeGreaterThanOrEqual(DEAL_ACTIONS.length);
    expect(facts.outbox.filter((entry) => entry.type === 'deal.command.receipt')).toHaveLength(DEAL_ACTIONS.length);

    const outsider: RequestUser = {
      ...actor(Role.LAB),
      id: 'canonical-lab-outsider',
      orgId: 'org-canonical-outsider',
      sessionId: 'canonical-lab-outsider-session',
    };
    await expect(instance.labs.getById(fixture.sampleId, outsider)).rejects.toMatchObject({ status: 404 });

    const restarted = await createInstance();
    try {
      for (const command of issued) {
        await expect(restarted.gateway.executeUser(
          CANONICAL_TEST_DEAL_ID,
          command.actionId,
          command.dto,
          actor(command.role),
        )).resolves.toMatchObject({ duplicate: true, commandId: command.dto.commandId });
      }
      await expect(submitCallback(settlement(restarted), reserve)).resolves.toMatchObject({ duplicate: true });
      await expect(submitCallback(settlement(restarted), release)).resolves.toMatchObject({ duplicate: true });
    } finally {
      await destroyInstance(restarted);
    }

    const before = await instance.prisma.deal.findUniqueOrThrow({ where: { id: CANONICAL_TEST_DEAL_ID } });
    await expect(instance.rls.withTrustedContext(operator, async (tx) => {
      await tx.deal.update({ where: { id: CANONICAL_TEST_DEAL_ID }, data: { nextAction: 'rollback-probe' } });
      throw new Error('forced-rollback');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })).rejects.toThrow('forced-rollback');
    expect(await instance.prisma.deal.findUniqueOrThrow({ where: { id: CANONICAL_TEST_DEAL_ID } })).toEqual(before);

    process.stdout.write(`${JSON.stringify({
      e2e: 'passed',
      identity: 'persistent-postgresql',
      dealId: facts.deal.id,
      status: facts.deal.status,
      roles: users.size,
      actions: DEAL_ACTIONS.length,
      labSample: facts.sample.id,
      protocols: facts.protocols.length,
      ledgerEntries: facts.ledger.length,
    })}\n`);
  });
});
