import { describe, expect, it } from 'vitest';
import {
  canPlatformV7AssignCarrier,
  canPlatformV7AssignTransport,
  canPlatformV7StartShipment,
  hasPlatformV7ShipmentDocuments,
  isPlatformV7ShipmentBlocked,
  type PlatformV7ShipmentOrder,
} from '@/lib/platform-v7/shipment-model';

const order: PlatformV7ShipmentOrder = {
  id: 'ship-1',
  dealId: 'deal-1',
  origin: 'Склад продавца',
  destination: 'Элеватор',
  loadingWindow: '2026-05-06',
  deliveryWindow: '2026-05-07',
  status: 'carrier_matching',
  documentIds: ['doc-1'],
  supportCaseIds: [],
};

describe('platform-v7 shipment model', () => {
  it('assigns carrier only while matching and before carrier is set', () => {
    expect(canPlatformV7AssignCarrier(order)).toBe(true);
    expect(canPlatformV7AssignCarrier({ ...order, carrierId: 'carrier-1' })).toBe(false);
    expect(canPlatformV7AssignCarrier({ ...order, status: 'carrier_assigned' })).toBe(false);
  });

  it('assigns transport only after carrier is assigned', () => {
    expect(canPlatformV7AssignTransport({ ...order, status: 'carrier_assigned', carrierId: 'carrier-1' })).toBe(true);
    expect(canPlatformV7AssignTransport({ ...order, status: 'carrier_assigned' })).toBe(false);
    expect(canPlatformV7AssignTransport({ ...order, status: 'carrier_assigned', carrierId: 'carrier-1', transportActorId: 'actor-1' })).toBe(false);
  });

  it('starts shipment only after actor, vehicle and trip are set', () => {
    expect(
      canPlatformV7StartShipment({
        ...order,
        status: 'transport_assigned',
        transportActorId: 'actor-1',
        vehicleId: 'vehicle-1',
        tripId: 'trip-1',
      })
    ).toBe(true);
    expect(canPlatformV7StartShipment({ ...order, status: 'transport_assigned', transportActorId: 'actor-1' })).toBe(false);
  });

  it('marks only deviation and cancelled shipment orders as blocked', () => {
    expect(isPlatformV7ShipmentBlocked({ ...order, status: 'deviation' })).toBe(true);
    expect(isPlatformV7ShipmentBlocked({ ...order, status: 'cancelled' })).toBe(true);
    expect(isPlatformV7ShipmentBlocked({ ...order, status: 'in_transit' })).toBe(false);
  });

  it('requires shipment documents to be visible as a separate condition', () => {
    expect(hasPlatformV7ShipmentDocuments(order)).toBe(true);
    expect(hasPlatformV7ShipmentDocuments({ ...order, documentIds: [] })).toBe(false);
  });
});
