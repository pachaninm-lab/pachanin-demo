
import { Injectable } from '@nestjs/common';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

@Injectable()
export class LogisticsService {
  constructor(private readonly runtime: RuntimeCoreService) {}

  summary(_user: any) {
    const shipments = this.runtime.listShipments();
    return {
      total: shipments.length,
      inTransit: shipments.filter((s: any) => s.status === 'IN_TRANSIT').length,
      atUnloading: shipments.filter((s: any) => s.status === 'AT_UNLOADING').length,
      completed: shipments.filter((s: any) => s.status === 'DELIVERED' || shipments.filter((s: any) => s.status === 'COMPLETED').length,
    };
  }

  list(_user: any) {
    return this.runtime.listShipments();
  }

  getOne(id: string, _user: any) {
    return this.runtime.getShipment(id);
  }

  workspace(id: string, _user: any) {
    return this.runtime.shipmentWorkspace(id);
  }

  create(dto: CreateShipmentDto, user: any) {
    return this.runtime.createShipment(dto, user);
  }

  transition(id: string, dto: TransitionShipmentDto, user: any) {
    return this.runtime.transitionShipment(id, dto, user);
  }

  recordCheckpoint(id: string, body: any, user: any) {
    return this.runtime.recordCheckpoint(id, body, user);
  }

  verifyPin(id: string, pin: string, _user: any) {
    return this.runtime.verifyPin(id, pin);
  }
}
