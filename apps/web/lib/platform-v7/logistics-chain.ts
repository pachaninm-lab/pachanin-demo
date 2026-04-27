/**
 * Logistics Chain domain types.
 *
 * Integration maturity: sandbox (no live GPS/SberKorus/carrier API calls).
 * Backbone: LogisticsOrder -> TransportPack -> RouteLeg -> DriverTask -> FieldEvent -> LogisticsIncident
 *
 * Every object is a child of Deal. LogisticsOrder is always linked to a dealId.
 */

import type { EntityId, IsoDateTime, MoneyAmount, DriverRef, VehicleRef, ElevatorRef } from './domain/types';
import type { MaturityStatus } from './domain/canonical';

export const LOGISTICS_MATURITY: MaturityStatus = 'sandbox';

// ---------------------------------------------------------------------------
// LogisticsOrder — top-level logistics object, always deal-linked
// ---------------------------------------------------------------------------

export type LogisticsOrderStatus =
  | 'draft'
  | 'carrier_matching'   // looking for carrier
  | 'carrier_assigned'
  | 'loading_scheduled'
  | 'loading_started'
  | 'loading_done'
  | 'in_transit'
  | 'arrived'
  | 'unloading'
  | 'completed'
  | 'incident'           // active incident blocking progress
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

// ---------------------------------------------------------------------------
// TransportPack — legal/document package for the trip (SberKorus / ЭТрН)
// ---------------------------------------------------------------------------

export type TransportPackStatus =
  | 'draft'
  | 'issued'
  | 'partially_signed'   // some parties signed
  | 'fully_signed'       // all parties signed -> transport gate cleared
  | 'disputed'
  | 'archived';

export type TransportDocType =
  | 'ETRN'               // Электронная транспортная накладная
  | 'ORDER_REQUEST'      // Заказ-заявка перевозчику
  | 'FORWARDER_ORDER'    // Поручение экспедитору
  | 'FORWARDER_RECEIPT'  // Экспедиторская расписка
  | 'WAREHOUSE_RECEIPT'; // Складская расписка

export interface TransportDocument {
  readonly id: EntityId;
  readonly type: TransportDocType;
  readonly status: 'draft' | 'issued' | 'signed' | 'rejected';
  readonly signatories: readonly string[];  // names of required signatories
  readonly signedBy: readonly string[];
  readonly issuedAt?: IsoDateTime;
  readonly signedAt?: IsoDateTime;
  readonly sberkorus?: boolean;   // routed through SberKorus
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

/** Returns true when all mandatory ЭТрН/documents are fully signed. */
export function isTransportGateCleared(pack: TransportPack): boolean {
  const etrn = pack.documents.find((d) => d.type === 'ETRN');
  if (!etrn) return false;
  return etrn.status === 'signed';
}

// ---------------------------------------------------------------------------
// RouteLeg — single leg of the route (e.g. farm -> elevator -> buyer)
// ---------------------------------------------------------------------------

export type RouteLegStatus =
  | 'planned'
  | 'active'
  | 'completed'
  | 'deviated'    // weight/route deviation flagged
  | 'cancelled';

export interface GeoPoint {
  readonly lat: number;
  readonly lon: number;
  readonly capturedAt: IsoDateTime;
  readonly offline?: boolean;   // captured offline, synced later
}

export interface RouteLeg {
  readonly id: EntityId;
  readonly logisticsOrderId: EntityId;
  readonly sequence: number;          // 1-based leg order
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

// ---------------------------------------------------------------------------
// DriverTask — single atomic task for driver
// ---------------------------------------------------------------------------

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
  readonly fieldEventId?: EntityId;   // created FieldEvent on completion
  readonly note?: string;
}

// ---------------------------------------------------------------------------
// FieldEvent — immutable fact captured in the field
// ---------------------------------------------------------------------------

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
  readonly photoUrl?: string;       // blob URL or CDN path
  readonly weightTons?: number;
  readonly note?: string;
  readonly offline: boolean;        // was captured while offline
  readonly evidenceRef?: EntityId;  // wired to EvidencePack item
}

// ---------------------------------------------------------------------------
// LogisticsIncident — deviation, blocker, or SLA breach
// ---------------------------------------------------------------------------

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

export type IncidentStatus =
  | 'open'
  | 'under_review'
  | 'resolved'
  | 'escalated';

export interface LogisticsIncident {
  readonly id: EntityId;
  readonly logisticsOrderId: EntityId;
  readonly routeLegId?: EntityId;
  readonly type: IncidentType;
  readonly status: IncidentStatus;
  readonly description: string;
  readonly moneyImpact?: MoneyAmount;  // estimated money at risk from this incident
  readonly ratingImpact?: number;      // negative impact on carrier rating
  readonly reportedAt: IsoDateTime;
  readonly resolvedAt?: IsoDateTime;
  readonly evidenceRef?: EntityId;
}

// ---------------------------------------------------------------------------
// Projection helpers
// ---------------------------------------------------------------------------

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
  const activeLegs = legs.filter((l) => l.status === 'active').length;
  const completedLegs = legs.filter((l) => l.status === 'completed').length;
  const openIncidents = incidents.filter((i) => i.status === 'open' || i.status === 'under_review').length;
  const deviations = legs
    .filter((l) => l.status === 'deviated' && l.deviationNote)
    .map((l) => l.deviationNote as string);

  return {
    orderId: order.id,
    dealId: order.dealId,
    status: order.status,
    activeLegs,
    completedLegs,
    totalLegs: legs.length,
    openIncidents,
    transportGateCleared: pack ? isTransportGateCleared(pack) : false,
    deviations,
  };
}

// ---------------------------------------------------------------------------
// Sandbox fixtures
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

export const SANDBOX_LOGISTICS_ORDERS: readonly LogisticsOrder[] = [
  {
    id: 'lo-9101',
    dealId: 'DL-9101',
    grain: 'Пшеница 4 кл.',
    volumeTons: 240,
    unit: 'т',
    originRegion: 'Тамбовская',
    destinationRegion: 'Воронежская',
    plannedLoadDate: NOW,
    status: 'in_transit',
    carrierId: 'carrier-001',
    carrierName: 'ТК Центр',
    transportPackId: 'tp-9101',
    routeLegIds: ['leg-9101-1'],
    incidentIds: [],
    maturity: 'sandbox',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'lo-9102',
    dealId: 'DL-9102',
    grain: 'Ячмень 2 кл.',
    volumeTons: 180,
    unit: 'т',
    originRegion: 'Воронежская',
    destinationRegion: 'Курская',
    status: 'arrived',
    carrierId: 'carrier-002',
    carrierName: 'АвтоГрупп',
    transportPackId: 'tp-9102',
    routeLegIds: ['leg-9102-1'],
    incidentIds: ['inc-9102-1'],
    maturity: 'sandbox',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'lo-9103',
    dealId: 'DL-9103',
    grain: 'Кукуруза 1 кл.',
    volumeTons: 360,
    unit: 'т',
    originRegion: 'Курская',
    destinationRegion: 'Белгородская',
    status: 'loading_scheduled',
    routeLegIds: [],
    incidentIds: [],
    maturity: 'sandbox',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const SANDBOX_ROUTE_LEGS: readonly RouteLeg[] = [
  {
    id: 'leg-9101-1',
    logisticsOrderId: 'lo-9101',
    sequence: 1,
    originName: 'Элеватор Тамбов',
    destinationName: 'Элеватор Воронеж',
    originRegion: 'Тамбовская',
    destinationRegion: 'Воронежская',
    driverRef: { id: 'drv-001', name: 'Иванов А.А.', vehicle: 'А123ВС68' },
    vehicleRef: { plate: 'А123ВС68', trailerPlate: 'АВ1234 68' },
    distanceKm: 420,
    status: 'active',
    lastGeo: { lat: 52.721, lon: 41.452, capturedAt: NOW },
  },
  {
    id: 'leg-9102-1',
    logisticsOrderId: 'lo-9102',
    sequence: 1,
    originName: 'Элеватор Воронеж',
    destinationName: 'ХПП Курск',
    originRegion: 'Воронежская',
    destinationRegion: 'Курская',
    driverRef: { id: 'drv-002', name: 'Петров С.В.', vehicle: 'В456КМ36' },
    vehicleRef: { plate: 'В456КМ36' },
    distanceKm: 210,
    status: 'completed',
    actualArrival: NOW,
    deviationNote: 'Вес при сдаче −1.2 т относительно погрузки.',
  },
];

export const SANDBOX_INCIDENTS: readonly LogisticsIncident[] = [
  {
    id: 'inc-9102-1',
    logisticsOrderId: 'lo-9102',
    routeLegId: 'leg-9102-1',
    type: 'WEIGHT_DEVIATION',
    status: 'under_review',
    description: 'Вес при выгрузке: 178.8 т. Погрузка: 180.0 т. Расхождение −1.2 т.',
    moneyImpact: 14880,
    reportedAt: NOW,
  },
];
