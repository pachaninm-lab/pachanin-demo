import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import {
  cleanTenant,
  createInstance,
  destroyInstance,
  payloadForAction,
  provisionDeal,
  type DealFixture,
  type ServiceInstance,
} from './harness';

jest.setTimeout(180_000);

let instance: ServiceInstance;

beforeAll(async () => {
  instance = await createInstance();
  await cleanTenant(instance.prisma);
});

afterAll(async () => {
  await cleanTenant(instance.prisma);
  await destroyInstance(instance);
});

async function execute(
  fixture: DealFixture,
  actionId: DealActionId,
  userKey: string,
  payload: Prisma.InputJsonObject = payloadForAction(fixture, actionId),
  suffix = '',
) {
  const deal = await instance.prisma.deal.findUniqueOrThrow({
    where: { id: fixture.dealId },
    select: { updatedAt: true, version: true },
  });
  const dto: ExecuteDealCommandDto = {
    commandId: `no-fake:${fixture.dealId}:${actionId}${suffix}`,
    idempotencyKey: `no-fake-idem:${fixture.dealId}:${actionId}${suffix}`,
    expectedUpdatedAt: deal.updatedAt.toISOString(),
    expectedVersion: deal.version.toString(),
    payload,
  };
  return instance.commands.execute(fixture.dealId, actionId, dto, fixture.users[userKey]);
}

async function throughReserve(fixture: DealFixture) {
  for (const [actionId, userKey] of [
    ['approve_admission', 'compliance'],
    ['publish_auction', 'farmer'],
    ['place_winning_bid', 'buyer'],
    ['seller_sign_contract', 'farmer'],
    ['buyer_sign_contract', 'buyer'],
    ['request_reserve', 'buyer'],
  ] as Array<[DealActionId, string]>) await execute(fixture, actionId, userKey);

  await instance.gateway.executeBankCallback({
    dealId: fixture.dealId,
    eventId: `no-fake-bank-${fixture.dealId}-reserve`,
    operation: 'RESERVE',
    status: 'SUCCESS',
    bankRef: `NO-FAKE-RESERVE-${fixture.dealId}`,
    operationId: `bank-reserve:${fixture.dealId}`,
    partnerId: 'safe-deals',
  });
}

async function advance(
  fixture: DealFixture,
  sequence: Array<[DealActionId, string]>,
) {
  for (const [actionId, userKey] of sequence) await execute(fixture, actionId, userKey);
}

async function snapshot(fixture: DealFixture, actionId: DealActionId) {
  return {
    deal: await instance.prisma.deal.findUniqueOrThrow({
      where: { id: fixture.dealId },
      select: { status: true, version: true },
    }),
    events: await instance.prisma.dealEvent.count({ where: { dealId: fixture.dealId } }),
    successAudit: await instance.prisma.auditEvent.count({
      where: { dealId: fixture.dealId, action: `deal.command.${actionId}`, outcome: 'SUCCESS' },
    }),
    outbox: await instance.prisma.outboxEntry.count({ where: { dealId: fixture.dealId } }),
  };
}

async function removeDocumentFixture(documentId: string) {
  await instance.prisma.$transaction(async (tx) => {
    // The production principal cannot bypass RLS or the append-only trigger.
    // This isolated admin-only setup removes an existing fixture so the test
    // can prove that command execution never manufactures missing evidence.
    await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
    await tx.dealDocument.delete({ where: { id: documentId } });
  });
}

function mutablePayload(fixture: DealFixture, actionId: DealActionId): Record<string, Prisma.InputJsonValue> {
  return { ...payloadForAction(fixture, actionId) };
}

function expectUnprocessable(promise: Promise<unknown>, field: string) {
  return expect(promise).rejects.toMatchObject({
    status: 422,
    response: expect.objectContaining({ code: 'UNPROCESSABLE_ENTITY', field }),
  });
}

describe('Deal command no-fake-live PostgreSQL gate', () => {
  it('rejects incomplete logistics without state, event, audit, outbox or shipment changes', async () => {
    const fixture = await provisionDeal(instance.prisma, 'nofake-logistics', 240_000_000n);
    await throughReserve(fixture);
    const before = await snapshot(fixture, 'assign_logistics');
    const payload = mutablePayload(fixture, 'assign_logistics');
    delete payload.driverUserId;

    await expectUnprocessable(
      execute(fixture, 'assign_logistics', 'logistician', payload, ':missing-driver'),
      'driverUserId',
    );
    expect(await snapshot(fixture, 'assign_logistics')).toEqual(before);
    expect(await instance.prisma.shipment.count({ where: { dealId: fixture.dealId } })).toBe(0);
  });

  it('does not create driver, vehicle or route from unverified strings', async () => {
    const fixture = await provisionDeal(instance.prisma, 'nofake-assets', 240_000_000n);
    await throughReserve(fixture);
    await expectUnprocessable(execute(fixture, 'assign_logistics', 'logistician', {
      carrierOrgId: fixture.serviceOrgId,
      driverUserId: 'driver-not-in-basis',
      vehicleId: 'vehicle-not-in-basis',
      routeFromFacilityId: 'facility-not-in-basis',
      routeToFacilityId: fixture.routeToFacilityId,
    }, ':forged-assets'), 'driverUserId');
    expect(await instance.prisma.shipment.count({ where: { dealId: fixture.dealId } })).toBe(0);
    expect(await instance.prisma.user.count({ where: { id: 'driver-not-in-basis' } })).toBe(0);
  });

  it('rejects loading without evidence and preserves the assigned state', async () => {
    const fixture = await provisionDeal(instance.prisma, 'nofake-loading', 240_000_000n);
    await throughReserve(fixture);
    await execute(fixture, 'assign_logistics', 'logistician');
    const before = await snapshot(fixture, 'confirm_loading');
    const payload = mutablePayload(fixture, 'confirm_loading');
    delete payload.evidenceRef;

    await expectUnprocessable(execute(fixture, 'confirm_loading', 'driver', payload, ':missing-evidence'), 'evidenceRef');
    expect(await snapshot(fixture, 'confirm_loading')).toEqual(before);
    expect((await instance.prisma.shipment.findUniqueOrThrow({ where: { id: fixture.shipmentId } })).status)
      .toBe('DRIVER_ASSIGNED');
    expect(await instance.prisma.checkpoint.count({ where: { shipmentId: fixture.shipmentId } })).toBe(0);
  });

  it('checks exact gross minus tare equals net without recording a mismatched weight', async () => {
    const fixture = await provisionDeal(instance.prisma, 'nofake-weight', 240_000_000n);
    await throughReserve(fixture);
    await advance(fixture, [
      ['assign_logistics', 'logistician'],
      ['confirm_loading', 'driver'],
      ['start_transit', 'driver'],
      ['confirm_arrival', 'driver'],
    ]);
    const before = await snapshot(fixture, 'confirm_weight');

    await expectUnprocessable(execute(fixture, 'confirm_weight', 'elevator', {
      ...payloadForAction(fixture, 'confirm_weight'),
      netTons: '149.500000',
    }, ':bad-net'), 'netTons');
    expect(await snapshot(fixture, 'confirm_weight')).toEqual(before);
    expect(await instance.prisma.acceptanceRecord.count({ where: { dealId: fixture.dealId } })).toBe(0);
  });

  it('does not create laboratory indicators or PASSED without complete signed input', async () => {
    const fixture = await provisionDeal(instance.prisma, 'nofake-lab', 240_000_000n);
    await throughReserve(fixture);
    await advance(fixture, [
      ['assign_logistics', 'logistician'],
      ['confirm_loading', 'driver'],
      ['start_transit', 'driver'],
      ['confirm_arrival', 'driver'],
      ['confirm_weight', 'elevator'],
      ['confirm_inspection', 'surveyor'],
    ]);
    const before = await snapshot(fixture, 'finalize_lab');

    await expectUnprocessable(execute(fixture, 'finalize_lab', 'lab', {}, ':empty-lab'), 'sampleId');
    expect(await snapshot(fixture, 'finalize_lab')).toEqual(before);
    expect(await instance.prisma.labTest.count({ where: { sampleId: fixture.sampleId } })).toBe(0);
    expect((await instance.prisma.labSample.findUniqueOrThrow({ where: { id: fixture.sampleId } })).status)
      .toBe('PENDING');
    expect((await instance.prisma.acceptanceRecord.findUniqueOrThrow({ where: { id: fixture.acceptanceId } })).qualityStatus)
      .toBe('PENDING');
  });

  it('does not create a missing contract as already signed', async () => {
    const fixture = await provisionDeal(instance.prisma, 'nofake-contract', 240_000_000n);
    await removeDocumentFixture(fixture.contractDocumentId);
    await advance(fixture, [
      ['approve_admission', 'compliance'],
      ['publish_auction', 'farmer'],
      ['place_winning_bid', 'buyer'],
    ]);

    await expectUnprocessable(execute(fixture, 'seller_sign_contract', 'farmer'), 'documentId');
    expect(await instance.prisma.dealDocument.findUnique({ where: { id: fixture.contractDocumentId } })).toBeNull();
    expect((await instance.prisma.deal.findUniqueOrThrow({ where: { id: fixture.dealId } })).status)
      .toBe('AUCTION_WON');
  });

  it('does not set bankAcceptance when signatures are recorded', async () => {
    const fixture = await provisionDeal(instance.prisma, 'nofake-bank-doc', 240_000_000n);
    await instance.prisma.dealDocument.update({
      where: { id: fixture.contractDocumentId },
      data: { bankAcceptance: 'PENDING' },
    });
    await advance(fixture, [
      ['approve_admission', 'compliance'],
      ['publish_auction', 'farmer'],
      ['place_winning_bid', 'buyer'],
      ['seller_sign_contract', 'farmer'],
      ['buyer_sign_contract', 'buyer'],
    ]);

    const document = await instance.prisma.dealDocument.findUniqueOrThrow({
      where: { id: fixture.contractDocumentId },
    });
    expect(document.status).toBe('SIGNED');
    expect(document.bankAcceptance).toBe('PENDING');
  });

  it('complete_documents validates an existing set and creates nothing', async () => {
    const fixture = await provisionDeal(instance.prisma, 'nofake-docs', 240_000_000n);
    await throughReserve(fixture);
    await advance(fixture, [
      ['assign_logistics', 'logistician'],
      ['confirm_loading', 'driver'],
      ['start_transit', 'driver'],
      ['confirm_arrival', 'driver'],
      ['confirm_weight', 'elevator'],
      ['confirm_inspection', 'surveyor'],
      ['finalize_lab', 'lab'],
      ['accept_delivery', 'buyer'],
    ]);
    await removeDocumentFixture(`ttn:${fixture.dealId}`);
    const beforeCount = await instance.prisma.dealDocument.count({ where: { dealId: fixture.dealId } });
    const before = await snapshot(fixture, 'complete_documents');

    await expectUnprocessable(execute(fixture, 'complete_documents', 'farmer', {}, ':missing-ttn'), 'documents');
    expect(await snapshot(fixture, 'complete_documents')).toEqual(before);
    expect(await instance.prisma.dealDocument.count({ where: { dealId: fixture.dealId } })).toBe(beforeCount);
    expect(await instance.prisma.dealDocument.findUnique({ where: { id: `ttn:${fixture.dealId}` } })).toBeNull();
  });

  it('source scan forbids synthetic defaults and production test-deal fallback', () => {
    const apiRoot = resolve(__dirname, '../..');
    const webRoot = resolve(__dirname, '../../../web');
    const productionSources = [
      readFileSync(resolve(apiRoot, 'src/modules/deals/deal-command.service.ts'), 'utf8'),
      readFileSync(resolve(webRoot, 'components/platform-v7/CanonicalDealWorkspace.tsx'), 'utf8'),
      readFileSync(resolve(webRoot, 'components/platform-v7/DealCommandForm.tsx'), 'utf8'),
      readFileSync(resolve(webRoot, 'components/platform-v7/RoleIntentDashboard.tsx'), 'utf8'),
    ].join('\n');

    for (const forbidden of [
      'user-driver-001',
      'Тестовый водитель',
      'А001АА77',
      'Склад продавца',
      'Элеватор покупателя',
      'ГОСТ 9353-2016',
      "qualityStatus: 'PASSED'",
      'passed: true',
      "bankAcceptance: 'ACCEPTED'",
      'commandPayload(',
    ]) expect(productionSources).not.toContain(forbidden);

    const productionUi = [
      readFileSync(resolve(webRoot, 'components/platform-v7/CanonicalDealWorkspace.tsx'), 'utf8'),
      readFileSync(resolve(webRoot, 'components/platform-v7/RoleIntentDashboard.tsx'), 'utf8'),
      readFileSync(resolve(webRoot, 'components/platform-v7/DealCommandForm.tsx'), 'utf8'),
    ].join('\n');
    expect(productionUi).not.toContain('DEAL-INDUSTRIAL-001');
    expect(productionUi).not.toContain('actorId');
    expect(productionUi).not.toContain('operatorUserId');
    expect(productionUi).not.toContain('declaredResult');
  });
});
