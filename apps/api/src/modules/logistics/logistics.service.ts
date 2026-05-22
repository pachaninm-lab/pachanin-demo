import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

@Injectable()
export class LogisticsService {
  constructor(
    private readonly runtime: RuntimeCoreService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async summary(_user: RequestUser) {
    const shipments = await this.getAllShipments();
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
    const all = await this.getAllShipments();
    // Driver sees only their own shipment
    if (user.role === Role.DRIVER) {
      return all.filter((s: any) => s.driverUserId === user.id);
    }
    return all;
  }

  async getOne(id: string, user: RequestUser) {
    let shipment: any;
    if (this.prisma) {
      try {
        const row = await this.prisma.shipment.findUnique({ where: { id } });
        if (row) shipment = row;
      } catch { /* fall through */ }
    }
    if (!shipment) shipment = this.runtime.getShipment(id);
    this.assertShipmentAccess(shipment, user);
    return shipment;
  }

  private async getAllShipments(): Promise<any[]> {
    if (this.prisma) {
      try {
        const rows = await this.prisma.shipment.findMany({ orderBy: { createdAt: 'desc' } });
        if (rows.length > 0) return rows;
      } catch { /* fall through */ }
    }
    return this.runtime.listShipments();
  }

  workspace(id: string, user: RequestUser) {
    const shipment = this.runtime.getShipment(id);
    this.assertShipmentAccess(shipment, user);
    return this.runtime.shipmentWorkspace(id);
  }

  create(dto: CreateShipmentDto, user: RequestUser) {
    if (user.role === Role.DRIVER) {
      throw new ForbiddenException('Drivers cannot create shipments');
    }
    return this.runtime.createShipment(dto, user);
  }

  transition(id: string, dto: TransitionShipmentDto, user: RequestUser) {
    const shipment = this.runtime.getShipment(id);
    this.assertShipmentAccess(shipment, user);
    return this.runtime.transitionShipment(id, dto, user);
  }

  recordCheckpoint(id: string, body: any, user: RequestUser) {
    const shipment = this.runtime.getShipment(id);
    this.assertShipmentAccess(shipment, user);
    return this.runtime.recordCheckpoint(id, body, user);
  }

  verifyPin(id: string, pin: string, user: RequestUser) {
    const shipment = this.runtime.getShipment(id);
    this.assertShipmentAccess(shipment, user);
    return this.runtime.verifyPin(id, pin);
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
