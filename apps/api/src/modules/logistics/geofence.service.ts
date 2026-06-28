import { Injectable, Logger } from '@nestjs/common';

/**
 * Geofence evaluation service per ТЗ 9.2.
 * - Создаёт геозоны из адресов сделки (загрузка, выгрузка, элеватор, порт)
 * - Автоматически определяет вход/выход при записи GPS-точки
 * - Алерты: опоздание > 30 мин, отклонение > 5 км, простой > 2 ч
 */

export interface GeoPoint {
  lat: number;
  lon: number;
  recordedAt?: string;
}

export interface Geofence {
  id: string;
  name: string;
  type: 'CIRCLE' | 'POLYGON';
  center?: GeoPoint;
  radiusMeters?: number;
  polygon?: GeoPoint[];
  dealId?: string;
  shipmentId?: string;
  kind: 'LOADING' | 'UNLOADING' | 'ELEVATOR' | 'PORT' | 'CHECKPOINT';
  meta?: Record<string, unknown>;
}

export interface GeofenceEvent {
  geofenceId: string;
  vehicleId: string;
  shipmentId?: string;
  dealId?: string;
  eventType: 'ENTER' | 'EXIT';
  kind: Geofence['kind'];
  position: GeoPoint;
  timestamp: string;
  alert?: GeofenceAlert;
}

export interface GeofenceAlert {
  type: 'LATE_ARRIVAL' | 'ROUTE_DEVIATION' | 'IDLE_TOO_LONG';
  message: string;
  severity: 'WARNING' | 'CRITICAL';
}

const LATE_THRESHOLD_MIN = 30;
const DEVIATION_THRESHOLD_M = 5000;
const IDLE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

const EARTH_RADIUS_M = 6_371_000;

@Injectable()
export class GeofenceService {
  private readonly logger = new Logger(GeofenceService.name);
  private readonly fences = new Map<string, Geofence>();
  private readonly vehicleState = new Map<string, {
    insideIds: Set<string>;
    lastPosition?: GeoPoint & { recordedAt: string };
    lastMoveAt?: number;
  }>();

  /** Create or update a geofence */
  upsert(fence: Geofence): Geofence {
    this.fences.set(fence.id, fence);
    return fence;
  }

  /** Create geofences from a deal's address fields */
  createForDeal(dealId: string, addresses: {
    loadingAddress?: string;
    unloadingAddress?: string;
    elevatorAddress?: string;
    portAddress?: string;
    coordinates?: Array<{ kind: Geofence['kind']; lat: number; lon: number }>;
  }): Geofence[] {
    const created: Geofence[] = [];
    const coords = addresses.coordinates ?? [];

    for (const coord of coords) {
      const fence: Geofence = {
        id: `gf-${dealId}-${coord.kind.toLowerCase()}-${Date.now()}`,
        name: `${coord.kind} (сделка ${dealId})`,
        type: 'CIRCLE',
        center: { lat: coord.lat, lon: coord.lon },
        radiusMeters: coord.kind === 'PORT' ? 2000 : 500,
        dealId,
        kind: coord.kind,
      };
      this.upsert(fence);
      created.push(fence);
    }

    return created;
  }

  /** Evaluate a GPS point against all relevant geofences. Returns triggered events. */
  evaluatePoint(vehicleId: string, point: GeoPoint & { recordedAt?: string }, shipmentId?: string): GeofenceEvent[] {
    const now = point.recordedAt ?? new Date().toISOString();
    const events: GeofenceEvent[] = [];

    const state = this.vehicleState.get(vehicleId) ?? { insideIds: new Set() };

    // Check idle time
    if (state.lastMoveAt && Date.now() - state.lastMoveAt > IDLE_THRESHOLD_MS) {
      const idleMinutes = Math.round((Date.now() - state.lastMoveAt) / 60_000);
      this.logger.warn(`Vehicle ${vehicleId} idle for ${idleMinutes} min (threshold: ${IDLE_THRESHOLD_MS / 60_000} min)`);
    }

    // Update last position / movement tracking
    if (state.lastPosition) {
      const dist = this.haversineDistance(state.lastPosition, point);
      if (dist > 10) { // moved > 10m → not idle
        state.lastMoveAt = Date.now();
      }
    } else {
      state.lastMoveAt = Date.now();
    }
    state.lastPosition = { ...point, recordedAt: now };

    // Check route deviation (if shipment has a planned route)
    const deviationAlert = this.checkRouteDeviation(vehicleId, point);

    // Check entry/exit for all geofences
    for (const fence of this.fences.values()) {
      const wasInside = state.insideIds.has(fence.id);
      const isInside = this.isPointInFence(point, fence);

      if (!wasInside && isInside) {
        // ENTER event
        state.insideIds.add(fence.id);
        const event: GeofenceEvent = {
          geofenceId: fence.id,
          vehicleId,
          shipmentId: shipmentId ?? fence.shipmentId,
          dealId: fence.dealId,
          eventType: 'ENTER',
          kind: fence.kind,
          position: point,
          timestamp: now,
          alert: deviationAlert ?? undefined,
        };
        events.push(event);
        this.logger.log(`Vehicle ${vehicleId} ENTERED geofence ${fence.name} (kind=${fence.kind})`);
      } else if (wasInside && !isInside) {
        // EXIT event
        state.insideIds.delete(fence.id);
        const event: GeofenceEvent = {
          geofenceId: fence.id,
          vehicleId,
          shipmentId: shipmentId ?? fence.shipmentId,
          dealId: fence.dealId,
          eventType: 'EXIT',
          kind: fence.kind,
          position: point,
          timestamp: now,
        };
        events.push(event);
        this.logger.log(`Vehicle ${vehicleId} EXITED geofence ${fence.name} (kind=${fence.kind})`);
      }
    }

    this.vehicleState.set(vehicleId, state);
    return events;
  }

  /** Check if vehicle has deviated > DEVIATION_THRESHOLD_M from nearest planned waypoint */
  private checkRouteDeviation(vehicleId: string, point: GeoPoint): GeofenceAlert | null {
    // In production: compare with planned route waypoints from logistics service
    // Here we return null (no planned route in mock mode)
    return null;
  }

  /** Check if point is inside a geofence */
  isPointInFence(point: GeoPoint, fence: Geofence): boolean {
    if (fence.type === 'CIRCLE' && fence.center && fence.radiusMeters) {
      return this.haversineDistance(point, fence.center) <= fence.radiusMeters;
    }
    if (fence.type === 'POLYGON' && fence.polygon && fence.polygon.length >= 3) {
      return this.isPointInPolygon(point, fence.polygon);
    }
    return false;
  }

  /** Haversine distance between two points in meters */
  haversineDistance(a: GeoPoint, b: GeoPoint): number {
    const dLat = this.toRad(b.lat - a.lat);
    const dLon = this.toRad(b.lon - a.lon);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const haversine =
      sinDLat * sinDLat +
      Math.cos(this.toRad(a.lat)) * Math.cos(this.toRad(b.lat)) * sinDLon * sinDLon;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(haversine));
  }

  /** Ray-casting algorithm for point-in-polygon */
  private isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lon, yi = polygon[i].lat;
      const xj = polygon[j].lon, yj = polygon[j].lat;
      const intersect =
        yi > point.lat !== yj > point.lat &&
        point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  listFences(dealId?: string): Geofence[] {
    const all = Array.from(this.fences.values());
    return dealId ? all.filter((f) => f.dealId === dealId) : all;
  }

  deleteFence(id: string): boolean {
    return this.fences.delete(id);
  }

  getVehicleState(vehicleId: string) {
    const state = this.vehicleState.get(vehicleId);
    if (!state) return null;
    return {
      vehicleId,
      insideGeofenceIds: Array.from(state.insideIds),
      lastPosition: state.lastPosition ?? null,
      lastMoveAt: state.lastMoveAt ? new Date(state.lastMoveAt).toISOString() : null,
      idleMinutes: state.lastMoveAt ? Math.round((Date.now() - state.lastMoveAt) / 60_000) : 0,
      isIdle: state.lastMoveAt ? Date.now() - state.lastMoveAt > IDLE_THRESHOLD_MS : false,
    };
  }
}
