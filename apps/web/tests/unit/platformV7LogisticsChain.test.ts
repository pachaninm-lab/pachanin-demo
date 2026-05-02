import {
  LOGISTICS_MATURITY,
  SANDBOX_INCIDENTS,
  SANDBOX_LOGISTICS_ORDERS,
  SANDBOX_ROUTE_LEGS,
  buildLogisticsProjection,
  buildTransportDecision,
  isTransportGateCleared,
  type TransportPack,
} from '@/lib/platform-v7/logistics-chain';

describe('platform-v7 logistics chain domain', () => {
  it('keeps maturity sandbox-only', () => {
    expect(LOGISTICS_MATURITY).toBe('sandbox');
    expect(SANDBOX_LOGISTICS_ORDERS.every((order) => order.maturity === 'sandbox')).toBe(true);
  });

  it('clears transport gate only when ETRN is signed', () => {
    const signedPack: TransportPack = {
      id: 'tp-test-signed',
      logisticsOrderId: 'lo-test',
      dealId: 'DL-TEST',
      status: 'fully_signed',
      maturity: 'sandbox',
      createdAt: '2026-04-27T00:00:00.000Z',
      documents: [{ id: 'doc-1', type: 'ETRN', status: 'signed', signatories: ['driver'], signedBy: ['driver'] }],
    };
    const draftPack: TransportPack = {
      ...signedPack,
      id: 'tp-test-draft',
      status: 'draft',
      documents: [{ id: 'doc-2', type: 'ETRN', status: 'draft', signatories: ['driver'], signedBy: [] }],
    };

    expect(isTransportGateCleared(signedPack)).toBe(true);
    expect(isTransportGateCleared(draftPack)).toBe(false);
  });

  it('does not clear transport gate without ETRN', () => {
    const pack: TransportPack = {
      id: 'tp-test-no-etrn',
      logisticsOrderId: 'lo-test',
      dealId: 'DL-TEST',
      status: 'issued',
      maturity: 'sandbox',
      createdAt: '2026-04-27T00:00:00.000Z',
      documents: [{ id: 'doc-3', type: 'WAREHOUSE_RECEIPT', status: 'signed', signatories: ['warehouse'], signedBy: ['warehouse'] }],
    };

    expect(isTransportGateCleared(pack)).toBe(false);
  });

  it('builds projection with active/completed legs and open incidents', () => {
    const order = SANDBOX_LOGISTICS_ORDERS[1];
    const legs = SANDBOX_ROUTE_LEGS.filter((leg) => leg.logisticsOrderId === order.id);
    const incidents = SANDBOX_INCIDENTS.filter((incident) => incident.logisticsOrderId === order.id);
    const projection = buildLogisticsProjection(order, legs, null, incidents);

    expect(projection.orderId).toBe(order.id);
    expect(projection.dealId).toBe(order.dealId);
    expect(projection.totalLegs).toBe(1);
    expect(projection.completedLegs).toBe(1);
    expect(projection.openIncidents).toBe(1);
    expect(projection.transportGateCleared).toBe(false);
    expect(projection.deviations[0]).toContain('Вес');
  });

  it('uses transport pack to expose cleared gate in projection', () => {
    const order = SANDBOX_LOGISTICS_ORDERS[0];
    const legs = SANDBOX_ROUTE_LEGS.filter((leg) => leg.logisticsOrderId === order.id);
    const pack: TransportPack = {
      id: 'tp-test-projection',
      logisticsOrderId: order.id,
      dealId: order.dealId,
      status: 'fully_signed',
      maturity: 'sandbox',
      createdAt: '2026-04-27T00:00:00.000Z',
      documents: [{ id: 'doc-4', type: 'ETRN', status: 'signed', signatories: ['driver'], signedBy: ['driver'] }],
    };

    const projection = buildLogisticsProjection(order, legs, pack, []);

    expect(projection.transportGateCleared).toBe(true);
    expect(projection.activeLegs).toBe(1);
  });

  it('allows continuing when all transport conditions are clean', () => {
    const decision = buildTransportDecision({
      completedLegs: 2,
      totalLegs: 2,
      openIncidents: 0,
      transportGateCleared: true,
      deviations: [],
    });

    expect(decision.canContinue).toBe(true);
    expect(decision.stops).toEqual([]);
  });

  it('stops continuing when transport has unfinished legs, incidents, documents, or deviations', () => {
    const decision = buildTransportDecision({
      completedLegs: 0,
      totalLegs: 1,
      openIncidents: 1,
      transportGateCleared: false,
      deviations: ['Вес при сдаче ниже погрузки'],
    });

    expect(decision.canContinue).toBe(false);
    expect(decision.stops).toContain('LEGS_NOT_DONE');
    expect(decision.stops).toContain('DOCS_NOT_SIGNED');
    expect(decision.stops).toContain('INCIDENTS_OPEN');
    expect(decision.stops).toContain('DEVIATIONS');
  });
});
