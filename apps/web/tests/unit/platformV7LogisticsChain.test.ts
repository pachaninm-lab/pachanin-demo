import { describe, it, expect } from 'vitest';
import {
  isTransportGateCleared,
  buildLogisticsProjection,
  SANDBOX_LOGISTICS_ORDERS,
  SANDBOX_ROUTE_LEGS,
  SANDBOX_INCIDENTS,
  LOGISTICS_MATURITY,
  type TransportPack,
  type LogisticsOrder,
  type RouteLeg,
  type LogisticsIncident,
} from '@/lib/platform-v7/logistics-chain';

describe('Logistics Chain domain', () => {
  describe('isTransportGateCleared', () => {
    it('returns false when no ETRN document exists', () => {
      const pack: TransportPack = {
        id: 'tp1',
        logisticsOrderId: 'lo1',
        dealId: 'DL-0001',
        status: 'issued',
        documents: [
          {
            id: 'd1',
            type: 'ORDER_REQUEST',
            status: 'signed',
            signatories: ['carrier'],
            signedBy: ['carrier'],
            issuedAt: new Date().toISOString(),
            signedAt: new Date().toISOString(),
          },
        ],
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
      };
      expect(isTransportGateCleared(pack)).toBe(false);
    });

    it('returns false when ETRN is issued but not signed', () => {
      const pack: TransportPack = {
        id: 'tp2',
        logisticsOrderId: 'lo1',
        dealId: 'DL-0001',
        status: 'issued',
        documents: [
          {
            id: 'd2',
            type: 'ETRN',
            status: 'issued',
            signatories: ['seller', 'carrier', 'buyer'],
            signedBy: ['seller'],
          },
        ],
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
      };
      expect(isTransportGateCleared(pack)).toBe(false);
    });

    it('returns true when ETRN is signed', () => {
      const pack: TransportPack = {
        id: 'tp3',
        logisticsOrderId: 'lo1',
        dealId: 'DL-0001',
        status: 'fully_signed',
        documents: [
          {
            id: 'd3',
            type: 'ETRN',
            status: 'signed',
            signatories: ['seller', 'carrier', 'buyer'],
            signedBy: ['seller', 'carrier', 'buyer'],
            issuedAt: new Date().toISOString(),
            signedAt: new Date().toISOString(),
          },
        ],
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
      };
      expect(isTransportGateCleared(pack)).toBe(true);
    });
  });

  describe('buildLogisticsProjection', () => {
    const makeOrder = (id: string, dealId: string): LogisticsOrder => ({
      id,
      dealId,
      grain: 'Пшеница 4 кл.',
      volumeTons: 240,
      unit: 'т',
      originRegion: 'Тамбовская',
      destinationRegion: 'Воронежская',
      status: 'in_transit',
      routeLegIds: [],
      incidentIds: [],
      maturity: 'sandbox',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    it('computes correct active/completed leg counts', () => {
      const order = makeOrder('lo-test', 'DL-test');
      const legs: RouteLeg[] = [
        { id: 'l1', logisticsOrderId: 'lo-test', sequence: 1, originName: 'A', destinationName: 'B', originRegion: 'R1', destinationRegion: 'R2', status: 'active' },
        { id: 'l2', logisticsOrderId: 'lo-test', sequence: 2, originName: 'B', destinationName: 'C', originRegion: 'R2', destinationRegion: 'R3', status: 'completed' },
        { id: 'l3', logisticsOrderId: 'lo-test', sequence: 3, originName: 'C', destinationName: 'D', originRegion: 'R3', destinationRegion: 'R4', status: 'planned' },
      ];
      const proj = buildLogisticsProjection(order, legs, null, []);
      expect(proj.activeLegs).toBe(1);
      expect(proj.completedLegs).toBe(1);
      expect(proj.totalLegs).toBe(3);
    });

    it('counts open incidents correctly', () => {
      const order = makeOrder('lo-test', 'DL-test');
      const incidents: LogisticsIncident[] = [
        { id: 'i1', logisticsOrderId: 'lo-test', type: 'WEIGHT_DEVIATION', status: 'open', description: 'test', reportedAt: new Date().toISOString() },
        { id: 'i2', logisticsOrderId: 'lo-test', type: 'SLA_BREACH', status: 'resolved', description: 'test', reportedAt: new Date().toISOString() },
        { id: 'i3', logisticsOrderId: 'lo-test', type: 'ROUTE_DEVIATION', status: 'under_review', description: 'test', reportedAt: new Date().toISOString() },
      ];
      const proj = buildLogisticsProjection(order, [], null, incidents);
      expect(proj.openIncidents).toBe(2); // open + under_review
    });

    it('reports transport gate as cleared when ETRN is signed', () => {
      const order = makeOrder('lo-test', 'DL-test');
      const pack: TransportPack = {
        id: 'tp-signed',
        logisticsOrderId: 'lo-test',
        dealId: 'DL-test',
        status: 'fully_signed',
        documents: [
          { id: 'd1', type: 'ETRN', status: 'signed', signatories: ['seller'], signedBy: ['seller'] },
        ],
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
      };
      const proj = buildLogisticsProjection(order, [], pack, []);
      expect(proj.transportGateCleared).toBe(true);
    });

    it('reports transport gate as not cleared when pack is null', () => {
      const order = makeOrder('lo-test', 'DL-test');
      const proj = buildLogisticsProjection(order, [], null, []);
      expect(proj.transportGateCleared).toBe(false);
    });

    it('collects deviation notes from deviated legs', () => {
      const order = makeOrder('lo-test', 'DL-test');
      const legs: RouteLeg[] = [
        { id: 'l1', logisticsOrderId: 'lo-test', sequence: 1, originName: 'A', destinationName: 'B', originRegion: 'R1', destinationRegion: 'R2', status: 'deviated', deviationNote: 'Вес −1.2 т' },
        { id: 'l2', logisticsOrderId: 'lo-test', sequence: 2, originName: 'B', destinationName: 'C', originRegion: 'R2', destinationRegion: 'R3', status: 'active' },
      ];
      const proj = buildLogisticsProjection(order, legs, null, []);
      expect(proj.deviations).toContain('Вес −1.2 т');
      expect(proj.deviations.length).toBe(1);
    });
  });

  describe('maturity label', () => {
    it('LOGISTICS_MATURITY is sandbox', () => {
      expect(LOGISTICS_MATURITY).toBe('sandbox');
    });

    it('all sandbox fixtures carry maturity: sandbox', () => {
      SANDBOX_LOGISTICS_ORDERS.forEach((o) => {
        expect(o.maturity).toBe('sandbox');
      });
    });
  });

  describe('sandbox fixtures integrity', () => {
    it('has at least 3 logistics orders', () => {
      expect(SANDBOX_LOGISTICS_ORDERS.length).toBeGreaterThanOrEqual(3);
    });

    it('each route leg references an existing logistics order', () => {
      const orderIds = new Set(SANDBOX_LOGISTICS_ORDERS.map((o) => o.id));
      SANDBOX_ROUTE_LEGS.forEach((leg) => {
        expect(orderIds.has(leg.logisticsOrderId)).toBe(true);
      });
    });

    it('each incident references an existing logistics order', () => {
      const orderIds = new Set(SANDBOX_LOGISTICS_ORDERS.map((o) => o.id));
      SANDBOX_INCIDENTS.forEach((inc) => {
        expect(orderIds.has(inc.logisticsOrderId)).toBe(true);
      });
    });
  });
});
