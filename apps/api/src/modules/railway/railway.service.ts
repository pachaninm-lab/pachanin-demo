import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type WagonType = 'HOPPER' | 'COVERED' | 'PLATFORM' | 'TANK';
export type WagonStatus = 'FREE' | 'ASSIGNED' | 'IN_TRANSIT' | 'MAINTENANCE';
export type GU12Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EXECUTED';

export interface Wagon {
  id: string;
  wagonNumber: string;
  type: WagonType;
  capacityTons: number;
  ownerOrgId: string;
  status: WagonStatus;
  currentDealId?: string;
  location?: string;
  registeredAt: string;
}

export interface GU12Request {
  id: string;
  dealId: string;
  requestorOrgId: string;
  wagons: string[];
  departureStation: string;
  destinationStation: string;
  cargo: string;
  volumeTons: number;
  requestedDepartureAt: string;
  status: GU12Status;
  etranId?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface DemurrageRecord {
  id: string;
  wagonId: string;
  dealId?: string;
  arrivedAt: string;
  unloadingCompletedAt?: string;
  freeTimeHours: number;
  detainedHours: number;
  ratePerHourKopecks: number;
  totalKopecks: number;
  calculatedAt: string;
}

const FREE_TIME_HOURS = 24;
const DEMURRAGE_RATE_KOPECKS = 150_00; // 150 rubles/hour per wagon

@Injectable()
export class RailwayService {
  private readonly wagons = new Map<string, Wagon>();
  private readonly gu12Requests = new Map<string, GU12Request>();
  private readonly demurrageRecords = new Map<string, DemurrageRecord>();

  constructor() {
    this.seedDemoWagons();
  }

  private seedDemoWagons(): void {
    const demo: Array<Omit<Wagon, 'registeredAt'>> = [
      { id: randomUUID(), wagonNumber: '52000001', type: 'HOPPER', capacityTons: 68, ownerOrgId: 'org-logistics-001', status: 'FREE' },
      { id: randomUUID(), wagonNumber: '52000002', type: 'HOPPER', capacityTons: 68, ownerOrgId: 'org-logistics-001', status: 'FREE' },
      { id: randomUUID(), wagonNumber: '63000001', type: 'COVERED', capacityTons: 65, ownerOrgId: 'org-logistics-001', status: 'MAINTENANCE' },
    ];
    for (const w of demo) {
      this.wagons.set(w.id, { ...w, registeredAt: new Date().toISOString() });
    }
  }

  listWagons(ownerOrgId?: string): Wagon[] {
    const all = [...this.wagons.values()];
    return ownerOrgId ? all.filter(w => w.ownerOrgId === ownerOrgId) : all;
  }

  registerWagon(dto: {
    wagonNumber: string;
    type: WagonType;
    capacityTons: number;
    ownerOrgId: string;
  }): Wagon {
    const existing = [...this.wagons.values()].find(w => w.wagonNumber === dto.wagonNumber);
    if (existing) throw new BadRequestException(`Wagon ${dto.wagonNumber} already registered`);

    const wagon: Wagon = {
      id: randomUUID(),
      ...dto,
      status: 'FREE',
      registeredAt: new Date().toISOString(),
    };
    this.wagons.set(wagon.id, wagon);
    return wagon;
  }

  updateWagonStatus(wagonId: string, status: WagonStatus, dealId?: string): Wagon {
    const wagon = this.wagons.get(wagonId);
    if (!wagon) throw new NotFoundException(`Wagon ${wagonId} not found`);
    wagon.status = status;
    wagon.currentDealId = dealId ?? wagon.currentDealId;
    return wagon;
  }

  createGU12(dto: {
    dealId: string;
    requestorOrgId: string;
    wagonIds: string[];
    departureStation: string;
    destinationStation: string;
    cargo: string;
    volumeTons: number;
    requestedDepartureAt: string;
  }): GU12Request {
    for (const wid of dto.wagonIds) {
      const w = this.wagons.get(wid);
      if (!w) throw new NotFoundException(`Wagon ${wid} not found`);
      if (w.status !== 'FREE') throw new BadRequestException(`Wagon ${w.wagonNumber} is not FREE`);
    }

    const req: GU12Request = {
      id: randomUUID(),
      dealId: dto.dealId,
      requestorOrgId: dto.requestorOrgId,
      wagons: dto.wagonIds,
      departureStation: dto.departureStation,
      destinationStation: dto.destinationStation,
      cargo: dto.cargo,
      volumeTons: dto.volumeTons,
      requestedDepartureAt: dto.requestedDepartureAt,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    };
    this.gu12Requests.set(req.id, req);
    return req;
  }

  submitGU12(requestId: string): GU12Request {
    const req = this.gu12Requests.get(requestId);
    if (!req) throw new NotFoundException(`GU-12 request ${requestId} not found`);
    if (req.status !== 'DRAFT') throw new BadRequestException('Only DRAFT requests can be submitted');

    req.status = 'SUBMITTED';
    req.etranId = `ETRAN-${Date.now()}`;

    // Mock auto-approval after submission
    setTimeout(() => {
      req.status = 'APPROVED';
      req.approvedAt = new Date().toISOString();
      for (const wid of req.wagons) {
        const w = this.wagons.get(wid);
        if (w) { w.status = 'ASSIGNED'; w.currentDealId = req.dealId; }
      }
    }, 100);

    return req;
  }

  listGU12(dealId?: string): GU12Request[] {
    const all = [...this.gu12Requests.values()];
    return dealId ? all.filter(r => r.dealId === dealId) : all;
  }

  calculateDemurrage(dto: {
    wagonId: string;
    dealId?: string;
    arrivedAt: string;
    unloadingCompletedAt: string;
  }): DemurrageRecord {
    const arrivedMs = new Date(dto.arrivedAt).getTime();
    const completedMs = new Date(dto.unloadingCompletedAt).getTime();
    const totalHours = Math.max(0, (completedMs - arrivedMs) / 3_600_000);
    const detainedHours = Math.max(0, totalHours - FREE_TIME_HOURS);
    const totalKopecks = Math.round(detainedHours * DEMURRAGE_RATE_KOPECKS);

    const record: DemurrageRecord = {
      id: randomUUID(),
      wagonId: dto.wagonId,
      dealId: dto.dealId,
      arrivedAt: dto.arrivedAt,
      unloadingCompletedAt: dto.unloadingCompletedAt,
      freeTimeHours: FREE_TIME_HOURS,
      detainedHours: Math.round(detainedHours * 100) / 100,
      ratePerHourKopecks: DEMURRAGE_RATE_KOPECKS,
      totalKopecks,
      calculatedAt: new Date().toISOString(),
    };
    this.demurrageRecords.set(record.id, record);
    return record;
  }

  listDemurrage(dealId?: string): DemurrageRecord[] {
    const all = [...this.demurrageRecords.values()];
    return dealId ? all.filter(r => r.dealId === dealId) : all;
  }
}
