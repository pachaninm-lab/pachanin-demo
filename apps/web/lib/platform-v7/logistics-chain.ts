/**
 * Logistics Chain domain layer.
 * Source: clean-transfer from Claude Code PR #209.
 * Maturity: sandbox. No live GPS, carrier, EDO, or SberKorus calls are claimed here.
 */

import type { DriverRef, EntityId, IsoDateTime, MoneyAmount, VehicleRef } from './domain/types';
import type { MaturityStatus } from './domain/canonical';

export const LOGISTICS_MATURITY: MaturityStatus = 'sandbox';

export type LogisticsOrderStatus =
  | 'draft'
  | 'carrier_matching'
  | 'carrier_assigned'
  | 'loading_scheduled'
  | 'loading_started'
  | 'loading_done'
  | 'in_transit'
  | 'arrived'
  | 'unloading'
  | 'completed'
  | 'incident'
  | 'cancelled';

export type CargoUnit = 'т' | 'кг' | 'м³';

export interface LogisticsOrder {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly grain: string;
  readonly volumeTons: number;
  readonly unit: CargoUnit;
  readonly originElevatorId?: EntityId;
  readonly destinationElevatorId?: EntityId;
  readonly originRegion: string;
  readonly destinationRegion: string;
  readonly plannedLoadDate?: IsoDateTime;
  readonly plannedDeliveryDate?: IsoDateTime;
  readonly actualDeliveryDate?: IsoDateTime;
  readonly status: LogisticsOrderStatus;
  readonly carrierId?: EntityId;
  readonly carrierName?: string;
  readonly transportPackId?: EntityId;
  readonly routeLegIds: readonly EntityId[];
  readonly incidentIds: readonly EntityId[];
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type TransportPackStatus = 'draft' | 'issued' | 'partially_signed' | 'fully_signed' | 'disputed' | 'archived';
export type TransportDocType = 'ETRN' | 'ORDER_REQUEST' | 'FORWARDER_ORDER' | 'FORWARDER_RECEIPT' | 'WAREHOUSE_RECEIPT';

export interface TransportDocument {
  readonly id: EntityId;
  readonly type: TransportDocType;
  readonly status: 'draft' | 'issued' | 'signed' | 'rejected';
  readonly signatories: readonly string[];
  readonly signedBy: readonly string[];
  readonly issuedAt?: IsoDateTime;
  readonly signedAt?: IsoDateTime;
  readonly sberkorus?: boolean;
}

export interface TransportPack {
  readonly id: EntityId;
  readonly logisticsOrderId: EntityId;
  readonly dealId: EntityId;
  readonly status: TransportPackStatus;
  readonly documents: readonly TransportDocument[];
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
}

export function isTransportGateCleared(pack: TransportPack): boolean {
  const etrn = pack.documents.find((document) => document.type === 'ETRN');
  return etrn?.status === 'signed';
}

export type RouteLegStatus = 'planned' | 'active' | 'completed' | 'deviated' | 'cancelled';

export interface GeoPoint {
  readonly lat: number;
  readonly lon: number;
  readonly capturedAt: IsoDateTime;
  readonly offline?: boolean;
}

export interface RouteLeg {
  readonly id: EntityId;
  readonly logisticsOrderId: EntityId;
  readonly sequence: number;
  readonly originName: string;
  readonly destinationName: string;
  readonly originRegion: string;
  readonly destinationRegion: string;
  readonly driverRef?: DriverRef;
  readonly vehicleRef?: VehicleRef;
  readonly distanceKm?: number;
  readonly plannedEta?: IsoDateTime;
  readonly actualArrival?: IsoDateTime;
  readonly status: RouteLegStatus;
  readonly deviationNote?: string;
  readonly lastGeo?: GeoPoint;
}

export type DriverTaskType =
  | 'DEPART'
  | 'ARRIVE_LOADING'
  | 'LOADING_PHOTO'
  | 'WEIGH_IN'
  | 'SAMPLE_TAKEN'
  | 'DEPART_LOADED'
  | 'ARRIVE_DESTINATION'
  | 'UNLOADING_PHOTO'
  | 'WEIGH_OUT'
  | 'SIGN_ETRN'
  | 'REPORT_INCIDENT';

export type DriverTaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface DriverTask {
  readonly id: EntityId;
  readonly routeLegId: EntityId;
  readonly type: DriverTaskType;
  readonly sequence: number;
  readonly status: DriverTaskStatus;
  readonly completedAt?: IsoDateTime;
  readonly fieldEventId?: EntityId;
  readonly note?: string;
}

export type FieldEventType =
  | 'PHOTO'
  | 'GEO_CHECKPOINT'
  | 'WEIGHT_IN'
  | 'WEIGHT_OUT'
  | 'SAMPLE_TAKEN'
  | 'ETRN_SIGNED'
  | 'ARRIVAL'
  | 'DEPARTURE'
  | 'INCIDENT_REPORTED'
  | 'OFFLINE_SYNC';

export interface FieldEvent {
  readonly id: EntityId;
  readonly routeLegId: EntityId;
  readonly driverTaskId?: EntityId;
  readonly type: FieldEventType;
  readonly capturedAt: IsoDateTime;
  readonly syncedAt?: IsoDateTime;
  readonly geo?: GeoPoint;
  readonly photoUrl?: string;
  readonly weightTons?: number;
  readonly note?: string;
  readonly offline: boolean;
  readonly evidenceRef?: EntityId;
}

export type IncidentType =
  | 'WEIGHT_DEVIATION'
  | 'ROUTE_DEVIATION'
  | 'SLA_BREACH'
  | 'VEHICLE_BREAKDOWN'
  | 'DRIVER_UNREACHABLE'
  | 'CARGO_DAMAGE'
  | 'DOCUMENT_MISSING'
  | 'GPS_SIGNAL_LOST'
  | 'CARRIER_REPLACEMENT';

export type IncidentStatus = 'open' | 'under_review' | 'resolved' | 'escalated';

export interface LogisticsIncident {
  readonly id: EntityId;
  readonly logisticsOrderId: EntityId;
  readonly routeLegId?: EntityId;
  readonly type: IncidentType;
  readonly status: IncidentStatus;
  readonly description: string;
  readonly moneyImpact?: MoneyAmount;
  readonly ratingImpact?: number;
  readonly reportedAt: IsoDateTime;
  readonly resolvedAt?: IsoDateTime;
  readonly evidenceRef?: EntityId;
}

export interface LogisticsChainProjection {
  readonly orderId: EntityId;
  readonly dealId: EntityId;
  readonly status: LogisticsOrderStatus;
  readonly activeLegs: number;
  readonly completedLegs: number;
  readonly totalLegs: number;
  readonly openIncidents: number;
  readonly transportGateCleared: boolean;
  readonly etaHours?: number;
  readonly deviations: readonly string[];
}

export function buildLogisticsProjection(
  order: LogisticsOrder,
  legs: readonly RouteLeg[],
  pack: TransportPack | null,
  incidents: readonly LogisticsIncident[],
): LogisticsChainProjection {
  return {
    orderId: order.id,
    dealId: order.dealId,
    status: order.status,
    activeLegs: legs.filter((leg) => leg.status === 'active').length,
    completedLegs: legs.filter((leg) => leg.status === 'completed').length,
    totalLegs: legs.length,
    openIncidents: incidents.filter((incident) => incident.status === 'open' || incident.status === 'under_review').length,
    transportGateCleared: pack ? isTransportGateCleared(pack) : false,
    deviations: legs.filter((leg) => leg.status === 'deviated' && leg.deviationNote).map((leg) => leg.deviationNote as string),
  };
}

export type TransportDecisionStop = 'NO_LEGS' | 'LEGS_NOT_DONE' | 'DOCS_NOT_SIGNED' | 'INCIDENTS_OPEN' | 'DEVIATIONS';

export interface TransportDecision {
  readonly canContinue: boolean;
  readonly stops: readonly TransportDecisionStop[];
  readonly completedLegs: number;
  readonly totalLegs: number;
  readonly openIncidents: number;
}

export function buildTransportDecision(projection: Pick<LogisticsChainProjection, 'completedLegs' | 'totalLegs' | 'openIncidents' | 'transportGateCleared' | 'deviations'>): TransportDecision {
  const stops: TransportDecisionStop[] = [];

  if (projection.totalLegs <= 0) stops.push('NO_LEGS');
  if (projection.totalLegs > 0 && projection.completedLegs < projection.totalLegs) stops.push('LEGS_NOT_DONE');
  if (!projection.transportGateCleared) stops.push('DOCS_NOT_SIGNED');
  if (projection.openIncidents > 0) stops.push('INCIDENTS_OPEN');
  if (projection.deviations.length > 0) stops.push('DEVIATIONS');

  return {
    canContinue: stops.length === 0,
    stops,
    completedLegs: projection.completedLegs,
    totalLegs: projection.totalLegs,
    openIncidents: projection.openIncidents,
  };
}

const NOW = '2026-04-27T00:00:00.000Z';

export const SANDBOX_LOGISTICS_ORDERS: readonly LogisticsOrder[] = [
  { id: 'lo-9101', dealId: 'DL-9101', grain: 'Пшеница 4 кл.', volumeTons: 240, unit: 'т', originRegion: 'Тамбовская', destinationRegion: 'Воронежская', plannedLoadDate: NOW, status: 'in_transit', carrierId: 'carrier-001', carrierName: 'Sandbox Carrier A', transportPackId: 'tp-9101', routeLegIds: ['leg-9101-1'], incidentIds: [], maturity: 'sandbox', createdAt: NOW, updatedAt: NOW },
  { id: 'lo-9102', dealId: 'DL-9102', grain: 'Ячмень 2 кл.', volumeTons: 180, unit: 'т', originRegion: 'Воронежская', destinationRegion: 'Курская', status: 'arrived', carrierId: 'carrier-002', carrierName: 'Sandbox Carrier B', transportPackId: 'tp-9102', routeLegIds: ['leg-9102-1'], incidentIds: ['inc-9102-1'], maturity: 'sandbox', createdAt: NOW, updatedAt: NOW },
  { id: 'lo-9103', dealId: 'DL-9103', grain: 'Кукуруза 1 кл.', volumeTons: 360, unit: 'т', originRegion: 'Курская', destinationRegion: 'Белгородская', status: 'loading_scheduled', routeLegIds: [], incidentIds: [], maturity: 'sandbox', createdAt: NOW, updatedAt: NOW },
];

export const SANDBOX_ROUTE_LEGS: readonly RouteLeg[] = [
  { id: 'leg-9101-1', logisticsOrderId: 'lo-9101', sequence: 1, originName: 'Sandbox Origin A', destinationName: 'Sandbox Destination A', originRegion: 'Тамбовская', destinationRegion: 'Воронежская', driverRef: { id: 'drv-001', name: 'Sandbox Driver A', vehicle: 'SANDBOX-PLATE-001' }, vehicleRef: { plate: 'SANDBOX-PLATE-001', trailerPlate: 'SANDBOX-TRAILER-001' }, distanceKm: 420, status: 'active', lastGeo: { lat: 52.721, lon: 41.452, capturedAt: NOW } },
  { id: 'leg-9102-1', logisticsOrderId: 'lo-9102', sequence: 1, originName: 'Sandbox Origin B', destinationName: 'Sandbox Destination B', originRegion: 'Воронежская', destinationRegion: 'Курская', driverRef: { id: 'drv-002', name: 'Sandbox Driver B', vehicle: 'SANDBOX-PLATE-002' }, vehicleRef: { plate: 'SANDBOX-PLATE-002' }, distanceKm: 210, status: 'completed', actualArrival: NOW, deviationNote: 'Вес при сдаче −1.2 т относительно погрузки.' },
];

export const SANDBOX_INCIDENTS: readonly LogisticsIncident[] = [
  { id: 'inc-9102-1', logisticsOrderId: 'lo-9102', routeLegId: 'leg-9102-1', type: 'WEIGHT_DEVIATION', status: 'under_review', description: 'Sandbox weight deviation under review.', moneyImpact: 14880, reportedAt: NOW },
];
