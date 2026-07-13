import { GoneException, Inject, Injectable } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import {
  RecordShipmentCheckpointDto,
  RecordShipmentGpsDto,
  VerifyShipmentPinDto,
} from './dto/shipment-fact-command.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';
import { SHIPMENT_REPOSITORY, type ShipmentRepository } from './shipment.repository';

@Injectable()
export class LogisticsService {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepository,
  ) {}

  async summary(user: RequestUser) {
    const shipments = await this.shipments.list(user);
    return {
      total: shipments.length,
      inTransit: shipments.filter((shipment) => shipment.status === 'IN_TRANSIT').length,
      atUnloading: shipments.filter((shipment) => shipment.status === 'AT_UNLOADING').length,
      completed: shipments.filter((shipment) =>
        shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED').length,
    };
  }

  list(user: RequestUser) {
    return this.shipments.list(user);
  }

  getOne(id: string, user: RequestUser) {
    return this.shipments.getById(id, user);
  }

  workspace(id: string, user: RequestUser) {
    return this.shipments.workspace(id, user);
  }

  create(_dto: CreateShipmentDto, _user: RequestUser): never {
    return canonicalCommandRequired('assign_logistics');
  }

  transition(_id: string, _dto: TransitionShipmentDto, _user: RequestUser): never {
    return canonicalCommandRequired('shipment lifecycle');
  }

  recordCheckpoint(id: string, dto: RecordShipmentCheckpointDto, user: RequestUser) {
    return this.shipments.recordCheckpoint(id, dto, user);
  }

  verifyPin(id: string, dto: VerifyShipmentPinDto, user: RequestUser) {
    return this.shipments.verifyPin(id, dto, user);
  }

  updateGps(id: string, dto: RecordShipmentGpsDto, user: RequestUser) {
    return this.shipments.recordGps(id, dto, user);
  }

  async getGpsTrack(id: string, user: RequestUser) {
    const track = await this.shipments.getGpsTrack(id, user);
    return {
      shipmentId: id,
      pointCount: track.length,
      lastPoint: track.at(-1) ?? null,
      track,
    };
  }
}

function canonicalCommandRequired(capability: string): never {
  throw new GoneException({
    code: 'CANONICAL_DEAL_COMMAND_REQUIRED',
    capability,
    message: 'Shipment lifecycle changes must execute through the canonical Deal command endpoint.',
  });
}
