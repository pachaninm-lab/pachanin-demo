import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';
import { MockGpsAdapter, GeoPoint, Geofence, GeofenceEvent } from '../../../../../packages/integration-sdk/src/adapters/gps.adapter';
import {
  AVG_SPEED_MIN_KMH,
  VAT_RATE,
  tariffRateFor,
  type VehicleType,
} from './route-planner.contract';

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
    // Скорость ниже единицы давала Infinity в часах и RangeError на
    // toISOString, то есть 500; отрицательная — время прибытия во вчерашнем
    // дне без единой ошибки. Отказ честнее обоих исходов.
    if (!Number.isFinite(avgSpeedKmh) || avgSpeedKmh < AVG_SPEED_MIN_KMH) {
      throw new BadRequestException('ETA_AVERAGE_SPEED_INVALID');
    }
    const etaHours = distanceKm / avgSpeedKmh;
    if (!Number.isFinite(distanceKm) || !Number.isFinite(etaHours)) {
      throw new BadRequestException('ETA_COORDINATES_INVALID');
    }
    const etaAt = new Date(Date.now() + etaHours * 3600 * 1000).toISOString();
    return { distanceKm: Math.round(distanceKm), etaHours: Math.round(etaHours * 10) / 10, etaAt };
  }

  estimateLogisticsTariff(distanceKm: number, weightTons: number, vehicleType: VehicleType = 'truck'): {
    baseTariffKopecks: number;
    totalKopecks: number;
    ratePerTonKmKopecks: number;
  } {
    // Ставки живут в route-planner.contract.ts по одному разу. Неизвестный тип
    // давал undefined и NaN на всю сумму — в JSON это уезжало как null, то
    // есть тариф без цифры. Отрицательное расстояние давало отрицательный
    // тариф, то есть счёт в пользу плательщика.
    // Только собственный ключ таблицы: наследованный член прототипа проходил
    // прежнюю проверку насквозь и снова давал NaN.
    const ratePerTonKmKopecks = tariffRateFor(vehicleType);
    if (ratePerTonKmKopecks === undefined) {
      throw new BadRequestException('TARIFF_VEHICLE_TYPE_UNKNOWN');
    }
    if (!Number.isFinite(distanceKm) || !Number.isFinite(weightTons) || distanceKm < 0 || weightTons < 0) {
      throw new BadRequestException('TARIFF_MEASURES_INVALID');
    }
    const baseTariffKopecks = Math.round(distanceKm * weightTons * ratePerTonKmKopecks);
    const vatKopecks = Math.round(baseTariffKopecks * VAT_RATE);
    return { baseTariffKopecks, totalKopecks: baseTariffKopecks + vatKopecks, ratePerTonKmKopecks };
  }
}
