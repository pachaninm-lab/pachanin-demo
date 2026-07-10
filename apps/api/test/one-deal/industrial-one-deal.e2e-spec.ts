import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { IndustrialDealCommandGateway } from '../../src/modules/deals/industrial-deal-command.gateway';
import { DealCommandService } from '../../src/modules/deals/deal-command.service';
import {
  CANONICAL_TEST_DEAL_ID,
  DEAL_ACTIONS,
  type DealActionId,
} from '../../src/modules/deals/deal-command.policy';
import {
  buildBankSignaturePayload,
  SettlementEngineController,
} from '../../src/modules/settlement-engine/settlement-engine.controller';

const TENANT_ID = 'tenant-canonical-test';
const BANK_SECRET = process.env.BANK_HMAC_SECRET ?? '';
const BANK_PARTNER_ID = process.env.BANK_PARTNER_ID ?? 'safe-deals';
const BANK_KEY_ID = process.env.BANK_HMAC_KEY_ID ?? 'primary';

type Workspace = Awaited<ReturnType<IndustrialDealCommandGateway['workspace']>>;

type MembershipRow = {
  user: { id: string; email: string; fullName: string };
  organization: { id: string; tenantId: string };
  role: string;
};

const actionRole: Record<Exclude<DealActionId, 'confirm_reserve' | 'confirm_release'>, Role> = {
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

function payload(actionId: DealActionId): Record<string, unknown> {
  switch (actionId) {
    case 'assign_logistics':
      return {
        carrierOrgId: 'org-canonical-logistics',
        driverUserId: 'driver-e2e',
        driverName: 'Тестовый водитель',
        vehicleNumber: 'А001АА77',
        routeFrom: 'Склад продавца',
        routeTo: 'Элеватор покупателя',
      };
    case 'confirm_loading':
      return { loadedTons: 150, note: 'Погрузка подтверждена' };
    case 'confirm_arrival':
      return { lat: 52.7212, lng: 41.4523 };
    case 'confirm_weight':
      return { weightActualTons: 149.6 };
    case 'finalize_lab':
      return { moisture: 12.4, protein: 13.2, gost: 'ГОСТ 9353-2016', protocol: 'LAB-E2E-001' };
    default:
      return {};
  }
}

function signedCallback(body: Record<string, unknown>) {
  const timestamp = Math.floor(Date.now() / 1000);
  const eventId = String(body.eventId);
  const signed = buildBankSignaturePayload({
    partnerId: BANK_PARTNER_ID,
    keyId: BANK_KEY_ID,
    timestamp,
    eventId,
    body,
  });
  return {
    timestamp: String(timestamp),
    eventId,
    partnerId: BANK_PARTNER_ID,
    keyId: BANK_KEY_ID,
    signature: `hmac-sha256=${createHmac('sha256', BANK_SECRET).update(signed).digest('hex')}`,
  };
}

describe('industrial one-deal PostgreSQL exploitation gate', () => {
  const prisma = new PrismaService();
  const rls = new RlsTransactionService(prisma);
  const commands = new DealCommandService(rls);
  const gateway = new IndustrialDealCommandGateway(prisma, rls, commands);
  const settlement = new SettlementEngineController({} as never, gateway);
  const usersByRole = new Map<Role, RequestUser>();

  beforeAll(async () => {
    if (!BANK_SECRET) throw new Error('BANK_HMAC_SECRET is required for signed callback fixtures.');
    await prisma.$connect();

    const memberships = await prisma.userOrg.findMany({
      where: { organization: { tenantId: TENANT_ID } },
      include: { user: true, organization: true },
      orderBy: { role: 'asc' },
    }) as MembershipRow[];

    for (const membership of memberships) {
      usersByRole.set(membership.role as Role, {
        id: membership.user.id,
        email: membership.user.email,
        fullName: membership.user.fullName,
        role: membership.role as Role,
        orgId: membership.organization.id,
        tenantId: membership.organization.tenantId,
        sessionId: `e2e-session-${membership.role.toLowerCase()}`,
        mfaVerified: true,
      });
    }

    expect(usersByRole.size).toBe(12);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function actor(role: Role): RequestUser {
    const user = usersByRole.get(role);
    if (!user) throw new Error(`Missing seeded membership for role ${role}`);
    return user;
  }

  async function workspace(role: Role): Promise<Workspace> {
    return gateway.workspace(CANONICAL_TEST_DEAL_ID, actor(role));
  }

  async function executeUserAction(
    actionId: Exclude<DealActionId, 'confirm_reserve' | 'confirm_release'>,
    options: { expectedUpdatedAt?: string; idempotencyKey?: string; commandId?: string } = {},
  ) {
    const role = actionRole[actionId];
    const current = await workspace(role);
    return gateway.executeUser(
      CANONICAL_TEST_DEAL_ID,
      actionId,
      {
        commandId: options.commandId ?? `command-${actionId}`,
        idempotencyKey: options.idempotencyKey ?? `idempotency-${actionId}`,
        expectedUpdatedAt: options.expectedUpdatedAt ?? current.deal.updatedAt,
        payload: payload(actionId),
      },
      actor(role),
    );
  }

  async function executeSignedBankCallback(operation: 'RESERVE' | 'RELEASE') {
    const operationId = operation === 'RESERVE'
      ? `bank-reserve:${CANONICAL_TEST_DEAL_ID}`
      : `bank-release:${CANONICAL_TEST_DEAL_ID}`;
    const eventId = operation === 'RESERVE' ? 'reserve-event-e2e' : 'release-event-e2e';
    const body = {
      dealId: CANONICAL_TEST_DEAL_ID,
      eventId,
      operation,
      status: 'SUCCESS',
      bankRef: operation === 'RESERVE' ? 'reserve-ref-e2e' : 'release-ref-e2e',
      operationId,
    };
    const signature = signedCallback(body);

    await expect(
      settlement.bankCallback(
        body,
        'hmac-sha256=invalid',
        signature.timestamp,
        signature.eventId,
        signature.partnerId,
        signature.keyId,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    return settlement.bankCallback(
      body,
      signature.signature,
      signature.timestamp,
      signature.eventId,
      signature.partnerId,
      signature.keyId,
    );
  }

  it('executes one factual deal through all roles, commands and bank callbacks', async () => {
    const roleViews = await Promise.all(
      [...usersByRole.keys()].map(async (role) => ({ role, view: await workspace(role) })),
    );
    expect(new Set(roleViews.map(({ view }) => view.deal.id))).toEqual(new Set([CANONICAL_TEST_DEAL_ID]));
    expect(new Set(roleViews.map(({ view }) => view.deal.status))).toEqual(new Set(['DRAFT']));

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

    const initial = await workspace(Role.COMPLIANCE_OFFICER);
    const approveDto = {
      commandId: 'command-approve',
      idempotencyKey: 'idempotency-approve',
      expectedUpdatedAt: initial.deal.updatedAt,
      payload: {},
    };
    const approval = await gateway.executeUser(
      CANONICAL_TEST_DEAL_ID,
      'approve_admission',
      approveDto,
      actor(Role.COMPLIANCE_OFFICER),
    );
    expect(approval).toMatchObject({ status: 'ADMISSION_APPROVED', duplicate: false });

    await expect(
      gateway.executeUser(
        CANONICAL_TEST_DEAL_ID,
        'approve_admission',
        approveDto,
        actor(Role.COMPLIANCE_OFFICER),
      ),
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
    const concurrent = await Promise.allSettled([
      gateway.executeUser(
        CANONICAL_TEST_DEAL_ID,
        'publish_auction',
        {
          commandId: 'command-auction-a',
          idempotencyKey: 'idempotency-auction-a',
          expectedUpdatedAt: auctionWorkspace.deal.updatedAt,
          payload: {},
        },
        actor(Role.FARMER),
      ),
      gateway.executeUser(
        CANONICAL_TEST_DEAL_ID,
        'publish_auction',
        {
          commandId: 'command-auction-b',
          idempotencyKey: 'idempotency-auction-b',
          expectedUpdatedAt: auctionWorkspace.deal.updatedAt,
          payload: {},
        },
        actor(Role.FARMER),
      ),
    ]);
    expect(concurrent.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((item) => item.status === 'rejected')).toHaveLength(1);

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

    await expect(executeSignedBankCallback('RESERVE')).resolves.toMatchObject({ status: 'RESERVED' });
    await executeUserAction('assign_logistics');
    await executeUserAction('confirm_loading');
    await executeUserAction('start_transit');
    await executeUserAction('confirm_arrival');
    await executeUserAction('confirm_weight');
    await executeUserAction('confirm_inspection');
    await executeUserAction('finalize_lab');
    await executeUserAction('accept_delivery');
    await executeUserAction('complete_documents');
    await executeUserAction('request_release');
    await expect(executeSignedBankCallback('RELEASE')).resolves.toMatchObject({ status: 'RELEASED' });
    await executeUserAction('close_deal');

    const operator = actor(Role.SUPPORT_MANAGER);
    const reconciled = await rls.withTrustedContext(operator, async (tx) => {
      const [deal, events, audits, outbox, documents, shipment, sample, acceptance, payment, bankOperations, ledger] = await Promise.all([
        tx.deal.findUnique({ where: { id: CANONICAL_TEST_DEAL_ID } }),
        tx.dealEvent.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { createdAt: 'asc' } }),
        tx.auditEvent.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { createdAt: 'asc' } }),
        tx.outboxEntry.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.dealDocument.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.shipment.findUnique({ where: { id: `shipment:${CANONICAL_TEST_DEAL_ID}` } }),
        tx.labSample.findUnique({ where: { id: `sample:${CANONICAL_TEST_DEAL_ID}` }, include: { tests: true } }),
        tx.acceptanceRecord.findUnique({ where: { id: `acceptance:${CANONICAL_TEST_DEAL_ID}` } }),
        tx.payment.findUnique({ where: { id: `payment:${CANONICAL_TEST_DEAL_ID}` } }),
        tx.bankOperation.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { type: 'asc' } }),
        tx.ledgerEntry.findMany({ where: { dealId: CANONICAL_TEST_DEAL_ID }, orderBy: { createdAt: 'asc' } }),
      ]);
      return { deal, events, audits, outbox, documents, shipment, sample, acceptance, payment, bankOperations, ledger };
    });

    expect(reconciled.deal).toMatchObject({ status: 'CLOSED', totalKopecks: 240_000_000 });
    expect(reconciled.events).toHaveLength(DEAL_ACTIONS.length);
    expect(reconciled.audits).toHaveLength(DEAL_ACTIONS.length);
    expect(reconciled.outbox.filter((item) => item.type === 'deal.command.receipt')).toHaveLength(DEAL_ACTIONS.length);
    expect(reconciled.documents.length).toBeGreaterThanOrEqual(6);
    expect(reconciled.documents.every((item) => item.status === 'SIGNED')).toBe(true);
    expect(reconciled.shipment).toMatchObject({ status: 'ARRIVED', vehicleNumber: 'А001АА77' });
    expect(reconciled.sample).toMatchObject({ status: 'DONE', protocol: 'LAB-E2E-001' });
    expect(reconciled.sample?.tests).toHaveLength(2);
    expect(reconciled.acceptance).toMatchObject({ status: 'ACCEPTED', qualityStatus: 'PASSED' });
    expect(reconciled.payment).toMatchObject({ status: 'RELEASED', callbackState: 'CONFIRMED', bankRef: 'release-ref-e2e' });
    expect(reconciled.bankOperations).toHaveLength(2);
    expect(reconciled.bankOperations.every((item) => item.status === 'DONE')).toBe(true);
    expect(reconciled.ledger.map((item) => item.entryType)).toEqual(['RESERVE', 'RELEASE']);

    process.stdout.write(`${JSON.stringify({
      e2e: 'passed',
      dealId: reconciled.deal?.id,
      status: reconciled.deal?.status,
      roles: usersByRole.size,
      actions: DEAL_ACTIONS.length,
      events: reconciled.events.length,
      audits: reconciled.audits.length,
      outbox: reconciled.outbox.length,
      documents: reconciled.documents.length,
      bankOperations: reconciled.bankOperations.length,
      ledgerEntries: reconciled.ledger.length,
    })}\n`);
  });
});
