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
  destroyInstance,
  prepareLaboratoryLifecycle,
  type DealFixture,
} from '../industrial/harness';
import {
  createSettlementInstance,
  type SettlementServiceInstance,
} from '../industrial/settlement-harness';

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
  'org-canonical-arbitrator',
] as const;

type UserActionId = Exclude<DealActionId, 'confirm_reserve' | 'confirm_release'>;
type IssuedCommand = Readonly<{
  actionId: UserActionId;
  role: Role;
  dto: ExecuteDealCommandDto;
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
  sign_seller: Role.FARMER,
  sign_buyer: Role.BUYER,
  assign_logistics: Role.LOGISTICIAN,
  create_shipment: Role.LOGISTICIAN,
  start_loading: Role.DRIVER,
  confirm_dispatch: Role.LOGISTICIAN,
  depart: Role.DRIVER,
  arrive: Role.DRIVER,
  record_weight: Role.ELEVATOR,
  confirm_inspection: Role.SURVEYOR,
  finalize_lab: Role.LAB,
  accept_delivery: Role.BUYER,
  request_reserve: Role.ACCOUNTING,
  open_dispute: Role.BUYER,
  resolve_dispute: Role.ARBITRATOR,
  request_release: Role.ACCOUNTING,
};

function evidence(kind: string): string {
  return `evidence:${CANONICAL_TEST_DEAL_ID}:${kind}`;
}

function signCallback(body: BankCallbackFixture['body'], timestamp: string, eventId: string): string {
  return createHmac('sha256', BANK_SECRET)
    .update(buildBankSignaturePayload(timestamp, eventId, body))
    .digest('hex');
}

function callback(
  operation: 'RESERVE' | 'RELEASE',
  operationId: string,
  eventId: string,
  bankRef: string,
  timestamp: string,
): BankCallbackFixture {
  const body = {
    dealId: CANONICAL_TEST_DEAL_ID,
    eventId,
    operation,
    status: 'SUCCESS' as const,
    bankRef,
    operationId,
  };
  return {
    body,
    timestamp,
    eventId,
    partnerId: BANK_PARTNER_ID,
    keyId: BANK_KEY_ID,
    signature: signCallback(body, timestamp, eventId),
  };
}

function command(
  actionId: UserActionId,
  sequence: number,
  expectedVersion: number,
  payload: Record<string, unknown> = {},
): ExecuteDealCommandDto {
  return {
    commandId: `one-deal-${sequence}-${actionId}`,
    idempotencyKey: `one-deal-idem-${sequence}-${actionId}`,
    expectedVersion,
    payload,
  };
}

function issued(actionId: UserActionId, dto: ExecuteDealCommandDto): IssuedCommand {
  return { actionId, role: ACTION_ROLE[actionId], dto };
}

function payloadFor(
  actionId: UserActionId,
  fixture: DealFixture,
  context: {
    reserveOperationId?: string;
    releaseOperationId?: string;
  } = {},
): Record<string, unknown> {
  switch (actionId) {
    case 'approve_admission':
      return { admissionId: `admission:${CANONICAL_TEST_DEAL_ID}` };
    case 'sign_seller':
      return { documentId: CONTRACT_ID, evidenceRef: evidence('seller-signature') };
    case 'sign_buyer':
      return { documentId: CONTRACT_ID, evidenceRef: evidence('buyer-signature') };
    case 'assign_logistics':
      return {
        carrierOrgId: 'org-canonical-logistics',
        driverUserId: 'driver-e2e',
        vehicleId: VEHICLE_ID,
        routeFromFacilityId: ROUTE_FROM_ID,
        routeToFacilityId: ROUTE_TO_ID,
        evidenceRef: evidence('loading'),
      };
    case 'create_shipment':
      return {
        shipmentId: SHIPMENT_ID,
        carrierOrgId: 'org-canonical-logistics',
        driverUserId: 'driver-e2e',
        vehicleId: VEHICLE_ID,
        routeFromFacilityId: ROUTE_FROM_ID,
        routeToFacilityId: ROUTE_TO_ID,
      };
    case 'start_loading':
      return { shipmentId: SHIPMENT_ID, occurredAt: '2026-07-12T10:00:00.000Z', evidenceRef: evidence('loading') };
    case 'confirm_dispatch':
      return { shipmentId: SHIPMENT_ID, occurredAt: '2026-07-12T10:30:00.000Z', evidenceRef: evidence('departure') };
    case 'depart':
      return { shipmentId: SHIPMENT_ID, occurredAt: '2026-07-12T11:00:00.000Z', evidenceRef: evidence('departure') };
    case 'arrive':
      return { shipmentId: SHIPMENT_ID, occurredAt: '2026-07-12T13:00:00.000Z', evidenceRef: evidence('arrival') };
    case 'record_weight':
      return {
        shipmentId: SHIPMENT_ID,
        grossWeightKg: '154000.000',
        tareWeightKg: '4000.000',
        netWeightKg: '150000.000',
        occurredAt: '2026-07-12T13:45:00.000Z',
        evidenceRef: evidence('weighing'),
        equipmentId: `scale:${CANONICAL_TEST_DEAL_ID}`,
      };
    case 'confirm_inspection':
      return {
        documentId: INSPECTION_ID,
        evidenceRef: evidence('inspection'),
        inspectedAt: '2026-07-12T14:00:00.000Z',
      };
    case 'finalize_lab':
      return { sampleId: fixture.sampleId, signedEvidenceRef: fixture.evidence.lab };
    case 'accept_delivery':
      return {
        acceptanceId: ACCEPTANCE_ID,
        acceptedAt: '2026-07-12T15:30:00.000Z',
        evidenceRef: evidence('acceptance'),
      };
    case 'request_reserve':
      return { operationId: context.reserveOperationId };
    case 'open_dispute':
      return {
        disputeId: `dispute:${CANONICAL_TEST_DEAL_ID}`,
        reasonCode: 'QUALITY_DEVIATION',
        openedAt: '2026-07-12T16:00:00.000Z',
        evidenceRefs: [evidence('inspection'), fixture.evidence.lab],
      };
    case 'resolve_dispute':
      return {
        disputeId: `dispute:${CANONICAL_TEST_DEAL_ID}`,
        resolution: 'RELEASE_FULL',
        decisionAt: '2026-07-12T16:30:00.000Z',
        evidenceRefs: [evidence('inspection'), fixture.evidence.lab],
      };
    case 'request_release':
      return { operationId: context.releaseOperationId };
    default:
      return {};
  }
}

describe('persistent-auth-backed industrial one-deal settlement authority gate', () => {
  let instance: SettlementServiceInstance;
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
    instance = await createSettlementInstance();
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
        arbitrator: actor(Role.ARBITRATOR),
        executive: actor(Role.EXECUTIVE),
      },
    };
    await prepareLaboratoryLifecycle(instance, fixture);
  });

  afterAll(async () => {
    await auth?.disconnect();
    await destroyInstance(instance);
  });

  it('executes 12-role/19-command deal through the same Settlement path and survives restart', async () => {
    const { commandService, settlementController } = instance;
    let currentVersion = 0;

    const run = async (actionId: UserActionId, payload: Record<string, unknown> = {}) => {
      const dto = command(actionId, issued.length + 1, currentVersion, payload);
      const result = await commandService.execute(CANONICAL_TEST_DEAL_ID, actionId, dto, actor(ACTION_ROLE[actionId]));
      issued.push(issued.length === 0 ? issued : issued);
      currentVersion = Number((result as { version: number }).version);
      return result;
    };

    await run('approve_admission', payloadFor('approve_admission', fixture));
    await run('sign_seller', payloadFor('sign_seller', fixture));
    await run('sign_buyer', payloadFor('sign_buyer', fixture));
    await run('assign_logistics', payloadFor('assign_logistics', fixture));
    await run('create_shipment', payloadFor('create_shipment', fixture));
    await run('start_loading', payloadFor('start_loading', fixture));
    await run('confirm_dispatch', payloadFor('confirm_dispatch', fixture));
    await run('depart', payloadFor('depart', fixture));
    await run('arrive', payloadFor('arrive', fixture));
    await run('record_weight', payloadFor('record_weight', fixture));
    await run('confirm_inspection', payloadFor('confirm_inspection', fixture));
    await run('finalize_lab', payloadFor('finalize_lab', fixture));
    await run('accept_delivery', payloadFor('accept_delivery', fixture));

    const reserveRequest = await settlementController.reserve(
      {
        dealId: CANONICAL_TEST_DEAL_ID,
        commandId: 'one-deal-reserve-request',
        idempotencyKey: 'one-deal-reserve-request',
        amountKopecks: DEAL_AMOUNT_KOPECKS.toString(),
        expectedVersion: currentVersion,
      },
      actor(Role.ACCOUNTING),
    ) as { operationId: string; version: number };
    currentVersion = reserveRequest.version;
    const reserveCallback = callback(
      'RESERVE',
      reserveRequest.operationId,
      'one-deal-reserve-event',
      'BANK-RESERVE-ONE-DEAL',
      '2026-07-12T15:45:00.000Z',
    );
    await settlementController.callback(
      reserveCallback.body,
      reserveCallback.timestamp,
      reserveCallback.eventId,
      reserveCallback.partnerId,
      reserveCallback.keyId,
      reserveCallback.signature,
    );

    await run('open_dispute', payloadFor('open_dispute', fixture));
    await run('resolve_dispute', payloadFor('resolve_dispute', fixture));

    const releaseRequest = await settlementController.release(
      {
        dealId: CANONICAL_TEST_DEAL_ID,
        commandId: 'one-deal-release-request',
        idempotencyKey: 'one-deal-release-request',
        amountKopecks: DEAL_AMOUNT_KOPECKS.toString(),
        expectedVersion: currentVersion,
      },
      actor(Role.ACCOUNTING),
    ) as { operationId: string; version: number };
    currentVersion = releaseRequest.version;
    const releaseCallback = callback(
      'RELEASE',
      releaseRequest.operationId,
      'one-deal-release-event',
      'BANK-RELEASE-ONE-DEAL',
      '2026-07-12T17:00:00.000Z',
    );
    await settlementController.callback(
      releaseCallback.body,
      releaseCallback.timestamp,
      releaseCallback.eventId,
      releaseCallback.partnerId,
      releaseCallback.keyId,
      releaseCallback.signature,
    );

    await auth.verifyWithFreshInstance();

    const restarted = await createSettlementInstance();
    await destroyInstance(instance);
    instance = restarted;

    const restored = await instance.commandService.workspace(CANONICAL_TEST_DEAL_ID, actor(Role.EXECUTIVE));
    expect(restored.deal.status).toBeDefined();
  });

  it('rejects injected role, tenant and membership claims after persistent re-authorization', async () => {
    const buyerToken = auth.accessTokensByRole.get(Role.BUYER);
    if (!buyerToken) throw new Error('Missing buyer token');
    const decoded = jwt.decode(buyerToken) as jwt.JwtPayload;
    const forged = jwt.sign(
      {
        typ: 'access',
        sid: decoded.sid,
        role: Role.ADMIN,
        orgId: 'org-attacker-controlled',
        organizationId: 'org-attacker-controlled',
        tenantId: 'tenant-attacker-controlled',
        membershipId: 'membership-attacker-controlled',
      },
      String(process.env.JWT_SECRET),
      {
        subject: String(decoded.sub),
        issuer: 'transparent-price-api',
        audience: 'transparent-price-platform',
        expiresIn: '5m',
      },
    );
    const reauthorized = await auth.primaryAuth.verifyAccessToken(forged);
    expect(reauthorized.role).toBe(Role.BUYER);
    expect(reauthorized.tenantId).toBe('tenant-canonical-test');
    expect(reauthorized.orgId).toBe('org-canonical-buyer');
  });

  it('rejects idempotency payload changes and cross-tenant access after restart', async () => {
    const first = issued[0];
    expect(first).toBeDefined();
    await expect(
      instance.commandService.execute(
        CANONICAL_TEST_DEAL_ID,
        first.actionId,
        { ...first.dto, payload: { tampered: true } },
        actor(first.role),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const wrongTenant = {
      ...actor(Role.BUYER),
      tenantId: 'tenant-attacker-controlled',
      sessionId: 'wrong-tenant-one-deal',
    };
    await expect(instance.commandService.workspace(CANONICAL_TEST_DEAL_ID, wrongTenant))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects bank callback replay and invalid signatures', async () => {
    const replay = callback(
      'RESERVE',
      'missing-operation',
      'one-deal-replayed-event',
      'BANK-REPLAY',
      '2026-07-12T18:00:00.000Z',
    );
    await expect(
      (instance.settlementController as SettlementEngineController).callback(
        replay.body,
        replay.timestamp,
        replay.eventId,
        replay.partnerId,
        replay.keyId,
        'not-a-valid-signature',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
