import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';
import { SHIPMENT_REPOSITORY, type ShipmentRepository } from './shipment.repository';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

@Injectable()
export class LogisticsService {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepository,
    // Kept only for the best-effort checkpoint DB snapshot below.
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

  private assertShipmentAccess(shipment: any, user: RequestUser): void {
    // ADMIN / SUPPORT_MANAGER see everything
    if (user.role === Role.ADMIN || user.role === Role.SUPPORT_MANAGER) return;
    // Driver: can only access their own assigned shipment
    if (user.role === Role.DRIVER) {
      if (shipment.driverUserId && shipment.driverUserId !== user.id) {
        throw new ForbiddenException('Driver can only access own assigned shipment');
      }
      return;
    }
    // EXECUTIVE: read access allowed, enforced by controller if needed
  }
}
