/**
 * Live GPS-tracking adapter (Wialon/ATI-style) over the shared HTTP client.
 * Per-vendor work left: endpoint paths + field mapping (marked "VENDOR MAPPING").
 */

import type {
  GeoPoint,
  Geofence,
  GeofenceEvent,
  GpsAdapter,
  VehicleTrack,
} from '../adapters/gps.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveGpsAdapter extends LiveAdapterBase implements GpsAdapter {
  readonly name = 'GPS';
  readonly version = '1.0.0-live';

  async getCurrentPosition(vehicleId: string): Promise<GeoPoint | null> {
    // VENDOR MAPPING: telematics provider "last position" endpoint.
    return this.http.request<GeoPoint | null>({
      method: 'GET',
      path: `/vehicles/${encodeURIComponent(vehicleId)}/position`,
    });
  }

  async getTrack(vehicleId: string, from: Date, to: Date): Promise<VehicleTrack> {
    return this.http.request<VehicleTrack>({
      method: 'GET',
      path: `/vehicles/${encodeURIComponent(vehicleId)}/track`,
      query: { from: from.toISOString(), to: to.toISOString() },
    });
  }

  async updatePosition(vehicleId: string, point: GeoPoint): Promise<void> {
    await this.http.request<void>({
      method: 'POST',
      path: `/vehicles/${encodeURIComponent(vehicleId)}/position`,
      body: point,
      idempotencyKey: `gps-pos:${vehicleId}:${point.timestamp}`,
    });
  }

  async registerGeofences(vehicleId: string, zones: Geofence[]): Promise<void> {
    await this.http.request<void>({
      method: 'PUT',
      path: `/vehicles/${encodeURIComponent(vehicleId)}/geofences`,
      body: { zones },
      idempotencyKey: `gps-geofences:${vehicleId}`,
    });
  }

  async getGeofenceEvents(vehicleId: string, from: Date, to: Date): Promise<GeofenceEvent[]> {
    return this.http.request<GeofenceEvent[]>({
      method: 'GET',
      path: `/vehicles/${encodeURIComponent(vehicleId)}/geofence-events`,
      query: { from: from.toISOString(), to: to.toISOString() },
    });
  }
}
