import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';
import { SHIPMENT_REPOSITORY, type ShipmentRepository } from './shipment.repository';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

interface GpsPoint {
  lat: number;
  lng: number;
  speedKmh?: number;
  headingDeg?: number;
  accuracyM?: number;
  recordedAt: string;
  driverId: string;
}

@Injectable()
export class LogisticsService {
  private readonly gpsTrack = new Map<string, GpsPoint[]>();

  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepository,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async summary(_user: RequestUser) {
    const shipments = await this.shipments.list();
    return {
      total: shipments.length,
      inTransit: shipments.filter((s: any) => s.status === 'IN_TRANSIT').length,
      atUnloading: shipments.filter((s: any) => s.status === 'AT_UNLOADING').length,
      completed: shipments.filter(
        (s: any) => s.status === 'DELIVERED' || s.status === 'COMPLETED',
      ).length,
    };
  }

  async list(user: RequestUser) {
    const all = await this.shipments.list();
    // Driver sees only their own shipment
    if (user.role === Role.DRIVER) {
      return all.filter((s: any) => s.driverUserId === user.id);
    }
    return all;
  }

  async getOne(id: string, user: RequestUser) {
    const shipment = await this.shipments.getById(id);
    this.assertShipmentAccess(shipment, user);
    return shipment;
  }

  async workspace(id: string, user: RequestUser) {
    const shipment = await this.shipments.getById(id);
    this.assertShipmentAccess(shipment, user);
    return this.shipments.workspace(id);
  }

  create(dto: CreateShipmentDto, user: RequestUser) {
    if (user.role === Role.DRIVER) {
      throw new ForbiddenException('Drivers cannot create shipments');
    }
    return this.shipments.create(dto, user);
  }

  async transition(id: string, dto: TransitionShipmentDto, user: RequestUser) {
    const shipment = await this.shipments.getById(id);
    this.assertShipmentAccess(shipment, user);
    return this.shipments.transition(id, dto, user);
  }

  async recordCheckpoint(id: string, body: any, user: RequestUser) {
    const shipment = await this.shipments.getById(id);
    this.assertShipmentAccess(shipment, user);
    const result = this.shipments.recordCheckpoint(id, body, user);
    const cp = result?.checkpoint;
    if (this.prisma && cp?.id) {
      this.prisma.checkpoint.create({
        data: {
          id: cp.id,
          shipmentId: id,
          type: body.type ?? cp.type ?? 'GPS',
          completedAt: cp.completedAt ? new Date(cp.completedAt) : new Date(),
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          note: body.note ?? body.comment ?? null,
        },
      }).catch(() => { /* fire-and-forget */ });
    }
    return result;
  }

  async verifyPin(id: string, pin: string, user: RequestUser) {
    const shipment = await this.shipments.getById(id);
    this.assertShipmentAccess(shipment, user);
    return this.shipments.verifyPin(id, pin);
  }

  async updateGps(
    id: string,
    point: { lat: number; lng: number; speedKmh?: number; headingDeg?: number; accuracyM?: number },
    user: RequestUser,
  ) {
    const shipment = await this.shipments.getById(id);
    this.assertShipmentAccess(shipment, user);
    const gpsPoint: GpsPoint = { ...point, recordedAt: new Date().toISOString(), driverId: user.id };
    const track = this.gpsTrack.get(id) ?? [];
    track.push(gpsPoint);
    if (track.length > 500) track.splice(0, track.length - 500);
    this.gpsTrack.set(id, track);

    this.prisma?.shipment.update({
      where: { id },
      data: { geoLat: point.lat, geoLng: point.lng, lastGeoAt: new Date() },
    }).catch(() => {});

    return { shipmentId: id, ...gpsPoint, trackLength: track.length };
  }

  async getGpsTrack(id: string, user: RequestUser) {
    const shipment = await this.shipments.getById(id);
    this.assertShipmentAccess(shipment, user);
    const track = this.gpsTrack.get(id) ?? [];
    return {
      shipmentId: id,
      pointCount: track.length,
      lastPoint: track.at(-1) ?? null,
      track,
    };
  }

  private assertShipmentAccess(shipment: any, user: RequestUser): void {
    // ADMIN / SUPPORT_MANAGER see everything
    if (user.role === Role.ADMIN || user.role === Role.SUPPORT_MANAGER) return;
    // Driver: can only access the shipment explicitly assigned to them.
    // Fail closed on unassigned shipments — a driver must never reach a ride
    // they are not the assigned driver of.
    if (user.role === Role.DRIVER) {
      if (shipment.driverUserId !== user.id) {
        throw new ForbiddenException('Driver can only access own assigned shipment');
      }
      return;
    }
    // LOGISTICIAN carrier-org isolation is intentionally NOT hard-enforced here
    // yet: in the current model a logistician user's orgId and a shipment's
    // carrierOrgId are in different id namespaces, so a strict match would
    // over-block legitimate access. Enforcing it requires establishing the
    // user↔carrier-org linkage first (tracked as audit finding H5).
    // EXECUTIVE: read access allowed, enforced by controller if needed
  }
}
