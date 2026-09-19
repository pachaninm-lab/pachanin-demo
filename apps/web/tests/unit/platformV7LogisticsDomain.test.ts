import { describe, expect, it } from 'vitest';
import {
  LOGISTICS_MATURITY,
  SANDBOX_INCIDENTS,
  SANDBOX_LOGISTICS_ORDERS,
  SANDBOX_ROUTE_LEGS,
  buildLogisticsProjection,
  isTransportGateCleared,
  type TransportPack,
} from '@/lib/platform-v7/logistics-chain';

describe('platform-v7 logistics domain smoke contract', () => {
  it('keeps logistics maturity sandbox-only', () => {
    expect(LOGISTICS_MATURITY).toBe('sandbox');
    expect(SANDBOX_LOGISTICS_ORDERS.every((item) => item.maturity === 'sandbox')).toBe(true);
  });

  it('keeps logistics references internally consistent', () => {
    const orderIds = new Set(SANDBOX_LOGISTICS_ORDERS.map((item) => item.id));

    expect(SANDBOX_ROUTE_LEGS.every((item) => orderIds.has(item.logisticsOrderId))).toBe(true);
    expect(SANDBOX_INCIDENTS.every((item) => orderIds.has(item.logisticsOrderId))).toBe(true);
  });

  it('computes logistics projection from seeded data', () => {
    const order = SANDBOX_LOGISTICS_ORDERS[1];
    const legs = SANDBOX_ROUTE_LEGS.filter((item) => item.logisticsOrderId === order.id);
    const incidents = SANDBOX_INCIDENTS.filter((item) => item.logisticsOrderId === order.id);
    const projection = buildLogisticsProjection(order, legs, null, incidents);

    expect(projection.orderId).toBe(order.id);
    expect(projection.dealId).toBe(order.dealId);
    expect(projection.totalLegs).toBe(1);
    expect(projection.openIncidents).toBe(1);
    expect(projection.transportGateCleared).toBe(false);
  });

  it('checks signed transport gate', () => {
    const pack: TransportPack = {
      id: 'tp-test',
      logisticsOrderId: 'lo-test',
      dealId: 'DL-test',
      status: 'fully_signed',
      documents: [{ id: 'doc-test', type: 'ETRN', status: 'signed', signatories: ['seller'], signedBy: ['seller'] }],
      maturity: 'sandbox',
      createdAt: '2026-04-27T00:00:00.000Z',
    };

    expect(isTransportGateCleared(pack)).toBe(true);
  });
});
