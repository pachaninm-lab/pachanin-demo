import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';

const SHIPMENTS_SEED = [
  {
    id: 'SHIP-001',
    dealId: 'DEAL-001',
    status: 'IN_TRANSIT',
    driverUserId: 'user-driver-1',
    driverName: 'Иванов Петр',
    vehicleNumber: 'А123ВС68',
    carrierOrgId: 'prov-log-1',
    carrierName: 'ТамбовЛогистик',
    routeFrom: 'Тамбов',
    routeTo: 'Воронеж',
    etaHours: 4,
    loadedTons: 500,
    createdAt: '2026-03-28T06:00:00Z',
    checkpoints: [
      { id: 'CP-001', type: 'LOADING', completedAt: '2026-03-28T08:00:00Z', lat: 52.72, lng: 41.45 },
      { id: 'CP-002', type: 'CHECKPOINT_1', completedAt: '2026-03-28T12:00:00Z', lat: 52.1, lng: 42.0 },
    ],
  },
  {
    id: 'SHIP-002',
    dealId: 'DEAL-002',
    status: 'AT_UNLOADING',
    driverUserId: 'user-driver-2',
    driverName: 'Петров Сергей',
    vehicleNumber: 'В456КМ23',
    carrierOrgId: 'prov-log-2',
    carrierName: 'ЦЧР АгроТранс',
    routeFrom: 'Краснодар',
    routeTo: 'Ростов-на-Дону',
    etaHours: 0,
    loadedTons: 750,
    createdAt: '2026-04-01T06:00:00Z',
    checkpoints: [],
  },
];

@Injectable()
export class LogisticsService {
  private shipments: any[] = SHIPMENTS_SEED.map((s) => ({ ...s, checkpoints: [...s.checkpoints] }));
  private shipmentCounter = 10;
  private checkpointCounter = 100;

  summary(_user: any) {
    const total = this.shipments.length;
    const inTransit = this.shipments.filter((s) => s.status === 'IN_TRANSIT').length;
    const atUnloading = this.shipments.filter((s) => s.status === 'AT_UNLOADING').length;
    const completed = this.shipments.filter((s) => s.status === 'DELIVERED' || s.status === 'COMPLETED').length;
    return { total, inTransit, atUnloading, completed };
  }

  list(_user: any) {
    return this.shipments;
  }

  getOne(id: string, _user: any) {
    const shipment = this.shipments.find((s) => s.id === id);
    if (!shipment) throw new NotFoundException(`Shipment ${id} not found`);
    return shipment;
  }

  workspace(id: string, user: any) {
    const shipment = this.getOne(id, user);
    return {
      shipment,
      availableTransitions: this.getAvailableTransitions(shipment.status),
      checkpoints: shipment.checkpoints,
    };
  }

  create(dto: CreateShipmentDto, user: any) {
    const id = `SHIP-${String(++this.shipmentCounter).padStart(3, '0')}`;
    const shipment: any = {
      id,
      dealId: dto.dealId,
      status: 'PENDING',
      carrierOrgId: dto.carrierOrgId ?? null,
      driverUserId: dto.driverUserId ?? null,
      driverName: dto.driverName ?? null,
      vehicleNumber: dto.vehicleNumber,
      trailerNumber: dto.trailerNumber ?? null,
      routeFrom: dto.fromAddress ?? null,
      routeTo: dto.toAddress ?? null,
      plannedLoadAt: dto.plannedLoadAt,
      plannedUnloadAt: dto.plannedUnloadAt ?? null,
      etaHours: null,
      loadedTons: null,
      createdAt: new Date().toISOString(),
      createdByUserId: user?.sub ?? user?.id ?? null,
      checkpoints: [],
    };
    this.shipments.push(shipment);
    return shipment;
  }

  transition(id: string, dto: TransitionShipmentDto, user: any) {
    const shipment = this.getOne(id, user);
    shipment.status = dto.nextState;
    shipment.lastTransitionAt = new Date().toISOString();
    if (dto.lat !== undefined) shipment.lastLat = dto.lat;
    if (dto.lng !== undefined) shipment.lastLng = dto.lng;
    if (dto.comment) shipment.lastComment = dto.comment;
    return shipment;
  }

  recordCheckpoint(id: string, body: { type?: string; lat?: number; lng?: number; comment?: string; timestamp?: string }, user: any) {
    const shipment = this.getOne(id, user);
    const checkpoint: any = {
      id: `CP-${String(++this.checkpointCounter).padStart(3, '0')}`,
      type: body.type ?? 'CHECKPOINT',
      completedAt: body.timestamp ?? new Date().toISOString(),
      lat: body.lat ?? null,
      lng: body.lng ?? null,
    };
    if (body.comment) checkpoint.comment = body.comment;
    shipment.checkpoints.push(checkpoint);
    return { shipment, checkpoint };
  }

  verifyPin(id: string, pin: string, user: any) {
    const shipment = this.getOne(id, user);
    const valid = pin === '1234';
    return { shipmentId: shipment.id, pinValid: valid };
  }

  private getAvailableTransitions(status: string): string[] {
    const transitions: Record<string, string[]> = {
      PENDING: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['AT_UNLOADING', 'ROUTE_DEVIATION_ALERT', 'CANCELLED'],
      AT_UNLOADING: ['DELIVERED', 'CANCELLED'],
      ROUTE_DEVIATION_ALERT: ['IN_TRANSIT', 'CANCELLED'],
      DELIVERED: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    return transitions[status] ?? [];
  }
}
