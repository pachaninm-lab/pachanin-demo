import { Injectable } from '@nestjs/common';
import type { ShipmentRepository } from './shipment.repository';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

/**
 * Default shipment repository adapter. Wraps the in-memory RuntimeCore shipment
 * methods without changing behavior. Only active adapter in controlled-pilot.
 */
@Injectable()
export class RuntimeShipmentRepository implements ShipmentRepository {
  constructor(private readonly runtime: RuntimeCoreService) {}

  async list(): Promise<any[]> {
    return this.runtime.listShipments();
  }

  async getById(id: string): Promise<any> {
    return this.runtime.getShipment(id);
  }

  workspace(id: string): any {
    return this.runtime.shipmentWorkspace(id);
  }

  create(dto: any, user: any): any {
    return this.runtime.createShipment(dto, user);
  }

  transition(id: string, dto: any, user: any): any {
    return this.runtime.transitionShipment(id, dto, user);
  }

  recordCheckpoint(id: string, body: any, user: any): any {
    return this.runtime.recordCheckpoint(id, body, user);
  }

  verifyPin(id: string, pin: string): any {
    return this.runtime.verifyPin(id, pin);
  }
}
