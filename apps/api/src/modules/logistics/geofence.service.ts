import { Injectable, ServiceUnavailableException } from '@nestjs/common';

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
}

/**
 * Geofence state must not live in process memory. Persistent route geometry,
 * vehicle state and evaluation events belong to IR-31/IR-55 and remain disabled
 * until a PostgreSQL/telematics implementation passes conformance acceptance.
 */
@Injectable()
export class GeofenceService {
  upsert(_fence: Geofence): never {
    return persistentGeofenceNotActivated();
  }

  createForDeal(
    _dealId: string,
    _addresses: {
      loadingAddress?: string;
      unloadingAddress?: string;
      elevatorAddress?: string;
      portAddress?: string;
      coordinates?: Array<{ kind: Geofence['kind']; lat: number; lon: number }>;
    },
  ): never {
    return persistentGeofenceNotActivated();
  }

  evaluatePoint(_vehicleId: string, _point: GeoPoint, _shipmentId?: string): never {
    return persistentGeofenceNotActivated();
  }

  listFences(_dealId?: string): never {
    return persistentGeofenceNotActivated();
  }

  deleteFence(_id: string): never {
    return persistentGeofenceNotActivated();
  }

  getVehicleState(_vehicleId: string): never {
    return persistentGeofenceNotActivated();
  }
}

function persistentGeofenceNotActivated(): never {
  throw new ServiceUnavailableException({
    code: 'PERSISTENT_GEOFENCE_NOT_ACTIVATED',
    capability: 'GEOFENCE_AND_TELEMATICS',
    message: 'Persistent geofence and telematics authority is not active.',
  });
}
