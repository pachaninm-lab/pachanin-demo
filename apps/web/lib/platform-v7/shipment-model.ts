import type { PlatformV7EntityId, PlatformV7IsoDateTime } from './execution-model';

export type PlatformV7ShipmentStatus =
  | 'created'
  | 'carrier_matching'
  | 'carrier_assigned'
  | 'transport_assigned'
  | 'to_loading'
  | 'loading_started'
  | 'loaded'
  | 'in_transit'
  | 'arrived'
  | 'weighing'
  | 'unloading'
  | 'accepted'
  | 'completed'
  | 'deviation'
  | 'cancelled';

export interface PlatformV7ShipmentOrder {
  id: PlatformV7EntityId;
  dealId: PlatformV7EntityId;
  origin: string;
  destination: string;
  loadingWindow: string;
  deliveryWindow: string;
  carrierId?: PlatformV7EntityId;
  transportActorId?: PlatformV7EntityId;
  vehicleId?: PlatformV7EntityId;
  tripId?: PlatformV7EntityId;
  status: PlatformV7ShipmentStatus;
  eta?: PlatformV7IsoDateTime;
  documentIds: PlatformV7EntityId[];
  supportCaseIds: PlatformV7EntityId[];
}

export function canPlatformV7AssignCarrier(order: PlatformV7ShipmentOrder): boolean {
  return order.status === 'carrier_matching' && !order.carrierId;
}

export function canPlatformV7AssignTransport(order: PlatformV7ShipmentOrder): boolean {
  return order.status === 'carrier_assigned' && Boolean(order.carrierId) && !order.transportActorId;
}

export function canPlatformV7StartShipment(order: PlatformV7ShipmentOrder): boolean {
  return order.status === 'transport_assigned' && Boolean(order.transportActorId) && Boolean(order.vehicleId) && Boolean(order.tripId);
}

export function isPlatformV7ShipmentBlocked(order: PlatformV7ShipmentOrder): boolean {
  return order.status === 'deviation' || order.status === 'cancelled';
}

export function hasPlatformV7ShipmentDocuments(order: PlatformV7ShipmentOrder): boolean {
  return order.documentIds.length > 0;
}
