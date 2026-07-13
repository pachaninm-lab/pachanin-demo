import { serverApiUrl, serverAuthHeaders } from './server-api';

export type ShipmentCheckpointServerItem = Readonly<{
  id: string;
  shipmentId: string;
  tenantId: string;
  type: string;
  completedAt: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  actorId: string | null;
  createdAt: string;
}>;

export type ShipmentGpsPointServerItem = Readonly<{
  id: string;
  shipmentId: string;
  tenantId: string;
  actorUserId: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  recordedAt: string;
  createdAt: string;
}>;

export type ShipmentServerItem = Readonly<{
  id: string;
  dealId: string;
  tenantId: string;
  status: string;
  driverUserId: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
  carrierOrgId: string | null;
  carrierName: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  etaHours: number | null;
  loadedTons: number | null;
  pinVerified: boolean;
  version: string;
  nextAction: string | null;
  blockers: string[];
  geoLat: number | null;
  geoLng: number | null;
  lastGeoAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type ShipmentWorkspaceServer = Readonly<{
  shipment: ShipmentServerItem;
  checkpoints: ShipmentCheckpointServerItem[];
  gpsTrack: ShipmentGpsPointServerItem[];
}>;

const IDENTIFIER = /^[^\u0000-\u001F\u007F]{1,200}$/;

export async function getShipments(): Promise<ShipmentServerItem[]> {
  try {
    const response = await fetch(serverApiUrl('/logistics/shipments'), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return [];
    return payload.map(parseShipment);
  } catch {
    return [];
  }
}

export async function getShipment(idInput: string): Promise<ShipmentServerItem | null> {
  const id = identifier(idInput);
  if (!id) return null;
  try {
    const response = await fetch(serverApiUrl(`/logistics/shipments/${encodeURIComponent(id)}`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!response.ok) return null;
    const shipment = parseShipment(await response.json());
    return shipment.id === id ? shipment : null;
  } catch {
    return null;
  }
}

export async function getShipmentWorkspace(idInput: string): Promise<ShipmentWorkspaceServer | null> {
  const id = identifier(idInput);
  if (!id) return null;
  try {
    const response = await fetch(serverApiUrl(`/logistics/shipments/${encodeURIComponent(id)}/workspace`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!response.ok) return null;
    const payload = record(await response.json(), 'shipment workspace');
    const shipment = parseShipment(payload.shipment);
    const checkpoints = array(payload.checkpoints, 'shipment checkpoints').map(parseCheckpoint);
    const gpsTrack = array(payload.gpsTrack, 'shipment GPS track').map(parseGpsPoint);

    if (shipment.id !== id) return null;
    if (checkpoints.some((item) => item.shipmentId !== id || item.tenantId !== shipment.tenantId)) return null;
    if (gpsTrack.some((item) => item.shipmentId !== id || item.tenantId !== shipment.tenantId)) return null;

    return Object.freeze({ shipment, checkpoints, gpsTrack });
  } catch {
    return null;
  }
}

export function activeShipmentCount(shipments: ShipmentServerItem[]): number {
  return shipments.filter((shipment) => ['IN_TRANSIT', 'AT_UNLOADING', 'PENDING'].includes(shipment.status)).length;
}

export function shipmentsWithBlockers(shipments: ShipmentServerItem[]): ShipmentServerItem[] {
  return shipments.filter((shipment) => shipment.blockers.length > 0);
}

function parseShipment(value: unknown): ShipmentServerItem {
  const item = record(value, 'shipment');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'shipment.id'),
    dealId: requiredIdentifier(item.dealId, 'shipment.dealId'),
    tenantId: requiredIdentifier(item.tenantId, 'shipment.tenantId'),
    status: requiredText(item.status, 'shipment.status'),
    driverUserId: nullableIdentifier(item.driverUserId, 'shipment.driverUserId'),
    driverName: nullableText(item.driverName, 'shipment.driverName'),
    vehicleNumber: nullableText(item.vehicleNumber, 'shipment.vehicleNumber'),
    vehicleType: nullableText(item.vehicleType, 'shipment.vehicleType'),
    carrierOrgId: nullableIdentifier(item.carrierOrgId, 'shipment.carrierOrgId'),
    carrierName: nullableText(item.carrierName, 'shipment.carrierName'),
    routeFrom: nullableText(item.routeFrom, 'shipment.routeFrom'),
    routeTo: nullableText(item.routeTo, 'shipment.routeTo'),
    etaHours: nullableFiniteNumber(item.etaHours, 'shipment.etaHours'),
    loadedTons: nullableFiniteNumber(item.loadedTons, 'shipment.loadedTons'),
    pinVerified: requiredBoolean(item.pinVerified, 'shipment.pinVerified'),
    version: requiredText(item.version, 'shipment.version'),
    nextAction: nullableText(item.nextAction, 'shipment.nextAction'),
    blockers: parseBlockers(item.blockers),
    geoLat: nullableFiniteNumber(item.geoLat, 'shipment.geoLat'),
    geoLng: nullableFiniteNumber(item.geoLng, 'shipment.geoLng'),
    lastGeoAt: nullableDate(item.lastGeoAt, 'shipment.lastGeoAt'),
    createdAt: requiredDate(item.createdAt, 'shipment.createdAt'),
    updatedAt: requiredDate(item.updatedAt, 'shipment.updatedAt'),
  });
}

function parseCheckpoint(value: unknown): ShipmentCheckpointServerItem {
  const item = record(value, 'shipment checkpoint');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'checkpoint.id'),
    shipmentId: requiredIdentifier(item.shipmentId, 'checkpoint.shipmentId'),
    tenantId: requiredIdentifier(item.tenantId, 'checkpoint.tenantId'),
    type: requiredText(item.type, 'checkpoint.type'),
    completedAt: nullableDate(item.completedAt, 'checkpoint.completedAt'),
    lat: nullableFiniteNumber(item.lat, 'checkpoint.lat'),
    lng: nullableFiniteNumber(item.lng, 'checkpoint.lng'),
    note: nullableText(item.note, 'checkpoint.note'),
    actorId: nullableIdentifier(item.actorId, 'checkpoint.actorId'),
    createdAt: requiredDate(item.createdAt, 'checkpoint.createdAt'),
  });
}

function parseGpsPoint(value: unknown): ShipmentGpsPointServerItem {
  const item = record(value, 'shipment GPS point');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'gps.id'),
    shipmentId: requiredIdentifier(item.shipmentId, 'gps.shipmentId'),
    tenantId: requiredIdentifier(item.tenantId, 'gps.tenantId'),
    actorUserId: requiredIdentifier(item.actorUserId, 'gps.actorUserId'),
    lat: requiredFiniteNumber(item.lat, 'gps.lat'),
    lng: requiredFiniteNumber(item.lng, 'gps.lng'),
    speedKmh: nullableFiniteNumber(item.speedKmh, 'gps.speedKmh'),
    headingDeg: nullableFiniteNumber(item.headingDeg, 'gps.headingDeg'),
    accuracyM: nullableFiniteNumber(item.accuracyM, 'gps.accuracyM'),
    recordedAt: requiredDate(item.recordedAt, 'gps.recordedAt'),
    createdAt: requiredDate(item.createdAt, 'gps.createdAt'),
  });
}

function parseBlockers(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) return value.map((item, index) => requiredText(item, `shipment.blockers[${index}]`));
  if (typeof value !== 'string') throw new Error('shipment.blockers must be a string or array');
  const normalized = value.trim();
  if (!normalized) return [];
  try {
    const parsed: unknown = JSON.parse(normalized);
    if (Array.isArray(parsed)) return parsed.map((item, index) => requiredText(item, `shipment.blockers[${index}]`));
  } catch {
    // Persisted legacy rows may contain a single blocker as plain text.
  }
  return [normalized];
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}

function identifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return IDENTIFIER.test(normalized) ? normalized : null;
}

function requiredIdentifier(value: unknown, field: string): string {
  const normalized = identifier(value);
  if (!normalized) throw new Error(`${field} is invalid`);
  return normalized;
}

function nullableIdentifier(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredIdentifier(value, field);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error(`${field} is invalid`);
  }
  const normalized = String(value).trim();
  if (!normalized) throw new Error(`${field} is empty`);
  return normalized;
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value, field);
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} is invalid`);
  return value;
}

function requiredFiniteNumber(value: unknown, field: string): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) throw new Error(`${field} is invalid`);
  return number;
}

function nullableFiniteNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredFiniteNumber(value, field);
}

function requiredDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) throw new Error(`${field} is invalid`);
  return value;
}

function nullableDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredDate(value, field);
}
