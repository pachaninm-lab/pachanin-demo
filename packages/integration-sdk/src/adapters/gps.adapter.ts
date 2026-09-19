import { BaseMockAdapter } from '../adapter.interface';

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;      // km/h
  heading?: number;   // degrees
  altitude?: number;
  timestamp: string;
}

export interface Geofence {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  type: 'LOADING' | 'UNLOADING' | 'ELEVATOR' | 'PORT' | 'CHECKPOINT';
}

export interface GeofenceEvent {
  vehicleId: string;
  geofenceId: string;
  geofenceName: string;
  eventType: 'ENTER' | 'EXIT';
  position: GeoPoint;
  occurredAt: string;
}

export interface VehicleTrack {
  vehicleId: string;
  points: GeoPoint[];
  totalDistanceKm: number;
}

export interface GpsAdapter {
  getCurrentPosition(vehicleId: string): Promise<GeoPoint | null>;
  getTrack(vehicleId: string, from: Date, to: Date): Promise<VehicleTrack>;
  updatePosition(vehicleId: string, point: GeoPoint): Promise<void>;
  registerGeofences(vehicleId: string, zones: Geofence[]): Promise<void>;
  getGeofenceEvents(vehicleId: string, from: Date, to: Date): Promise<GeofenceEvent[]>;
}

export class MockGpsAdapter extends BaseMockAdapter<unknown, unknown> implements GpsAdapter {
  readonly name = 'GPS';
  readonly version = '1.0.0';

  private readonly positions = new Map<string, GeoPoint>();
  private readonly tracks = new Map<string, GeoPoint[]>();

  async execute(request: unknown): Promise<unknown> {
    return { mock: true, request };
  }

  async getCurrentPosition(vehicleId: string): Promise<GeoPoint | null> {
    return this.positions.get(vehicleId) ?? {
      lat: 52.7 + Math.random() * 0.1,
      lng: 41.4 + Math.random() * 0.1,
      speed: Math.random() * 80,
      timestamp: new Date().toISOString(),
    };
  }

  async getTrack(vehicleId: string, _from: Date, _to: Date): Promise<VehicleTrack> {
    const points = this.tracks.get(vehicleId) ?? [];
    return { vehicleId, points, totalDistanceKm: points.length * 0.5 };
  }

  async updatePosition(vehicleId: string, point: GeoPoint): Promise<void> {
    this.positions.set(vehicleId, point);
    const track = this.tracks.get(vehicleId) ?? [];
    track.push(point);
    this.tracks.set(vehicleId, track);
  }

  async registerGeofences(_vehicleId: string, _zones: Geofence[]): Promise<void> {}

  async getGeofenceEvents(_vehicleId: string, _from: Date, _to: Date): Promise<GeofenceEvent[]> {
    return [];
  }
}
