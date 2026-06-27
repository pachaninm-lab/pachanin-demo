import { Injectable, Logger } from '@nestjs/common';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';
import { MockGpsAdapter, GeoPoint, Geofence, GeofenceEvent } from '../../../../../packages/integration-sdk/src/adapters/gps.adapter';

interface Waypoint {
  lat: number;
  lng: number;
  name: string;
  type: 'LOADING' | 'CHECKPOINT' | 'UNLOADING' | 'ELEVATOR' | 'PORT';
  estimatedArrival?: string;
  actualArrival?: string;
}

interface Route {
  shipmentId: string;
  vehicleId?: string;
  waypoints: Waypoint[];
  estimatedDistanceKm: number;
  etaHours: number;
  currentStatus: 'PLANNED' | 'IN_TRANSIT' | 'ARRIVED' | 'COMPLETED';
}

@Injectable()
export class RoutePlannerService {
  private readonly logger = new Logger(RoutePlannerService.name);

  private get gps(): MockGpsAdapter {
    return integrationRegistry.get<MockGpsAdapter>('GPS');
  }

  weighbridge() {
    return {
      items: [
        {
          id: 'WB-001',
          vehicleNumber: 'А123ВС68',
          dealId: 'DEAL-001',
          status: 'IN_QUEUE',
          arrivalTime: '2026-04-05T14:00:00Z',
          estimatedWeight: 500,
        },
      ],
    };
  }

  shipment(shipmentId: string): Route {
    return {
      shipmentId,
      vehicleId: `vehicle-${shipmentId}`,
      waypoints: [
        { lat: 52.72, lng: 41.45, name: 'Тамбов (погрузка)', type: 'LOADING', estimatedArrival: new Date().toISOString() },
        { lat: 52.1, lng: 42.0, name: 'Контрольная точка 1', type: 'CHECKPOINT' },
        { lat: 51.67, lng: 39.21, name: 'Воронеж (разгрузка)', type: 'UNLOADING' },
      ],
      estimatedDistanceKm: 450,
      etaHours: 5.5,
      currentStatus: 'IN_TRANSIT',
    };
  }

  async getVehiclePosition(vehicleId: string): Promise<GeoPoint | null> {
    return this.gps.getCurrentPosition(vehicleId);
  }

  async getVehicleTrack(vehicleId: string, from: Date, to: Date) {
    return this.gps.getTrack(vehicleId, from, to);
  }

  async updateVehiclePosition(vehicleId: string, point: GeoPoint): Promise<void> {
    await this.gps.updatePosition(vehicleId, point);
    this.logger.debug(`GPS update: vehicle=${vehicleId} lat=${point.lat} lng=${point.lng} speed=${point.speed}km/h`);
  }

  async registerGeofences(vehicleId: string, zones: Geofence[]): Promise<void> {
    await this.gps.registerGeofences(vehicleId, zones);
    this.logger.log(`Registered ${zones.length} geofences for vehicle ${vehicleId}`);
  }

  async getGeofenceEvents(vehicleId: string, from: Date, to: Date): Promise<GeofenceEvent[]> {
    return this.gps.getGeofenceEvents(vehicleId, from, to);
  }

  calculateEta(fromPoint: { lat: number; lng: number }, toPoint: { lat: number; lng: number }, avgSpeedKmh = 60): {
    distanceKm: number;
    etaHours: number;
    etaAt: string;
  } {
    // Haversine distance approximation
    const R = 6371;
    const dLat = (toPoint.lat - fromPoint.lat) * Math.PI / 180;
    const dLng = (toPoint.lng - fromPoint.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(fromPoint.lat * Math.PI / 180) * Math.cos(toPoint.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const etaHours = distanceKm / avgSpeedKmh;
    const etaAt = new Date(Date.now() + etaHours * 3600 * 1000).toISOString();
    return { distanceKm: Math.round(distanceKm), etaHours: Math.round(etaHours * 10) / 10, etaAt };
  }

  estimateLogisticsTariff(distanceKm: number, weightTons: number, vehicleType: 'truck' | 'rail' | 'vessel' = 'truck'): {
    baseTariffKopecks: number;
    totalKopecks: number;
    ratePerTonKmKopecks: number;
  } {
    const rates: Record<string, number> = { truck: 350, rail: 180, vessel: 90 };
    const ratePerTonKmKopecks = rates[vehicleType];
    const baseTariffKopecks = Math.round(distanceKm * weightTons * ratePerTonKmKopecks);
    const vatKopecks = Math.round(baseTariffKopecks * 0.2);
    return { baseTariffKopecks, totalKopecks: baseTariffKopecks + vatKopecks, ratePerTonKmKopecks };
  }
}
