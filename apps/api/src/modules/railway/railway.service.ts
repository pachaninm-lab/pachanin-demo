import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';
import { MockRzdEtranAdapter } from '../../../../../packages/integration-sdk/src/adapters/rzd-etran.adapter';
import { ObjectAccessService } from '../../common/security/object-access.service';
import type { RequestUser } from '../../common/types/request-user';

// Списки живут в railway.contract.ts по одному разу; имена типов сохранены,
// чтобы существующие импорты из сервиса продолжали работать.
export type { GU12Status, WagonStatus, WagonType } from './railway.contract';
import type { GU12Status, WagonStatus, WagonType } from './railway.contract';

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
  private readonly logger = new Logger(RailwayService.name);
  private readonly wagons = new Map<string, Wagon>();
  private readonly gu12Requests = new Map<string, GU12Request>();
  private readonly demurrageRecords = new Map<string, DemurrageRecord>();

  private get etran(): MockRzdEtranAdapter {
    return integrationRegistry.get<MockRzdEtranAdapter>('RZD_ETRAN');
  }

  constructor(private readonly access: ObjectAccessService = new ObjectAccessService()) {
    this.seedDemoWagons();
  }

  /**
   * V8.2.2 — объектный доступ. @Roles проверял только роль вызывающего, а
   * принадлежность вагона, заявки ГУ-12 и записи демереджа не проверялась
   * нигде: логист одной организации менял статус чужого вагона, подавал чужую
   * заявку, ставил чужие вагоны в свою ГУ-12 и читал заявки и демередж всех
   * организаций, а `?orgId=` в списке вагонов показывал чужой парк.
   *
   * Проверка живёт в сервисе, а не в контроллере, чтобы её не обошёл другой
   * вызывающий. Набор привилегированных ролей берётся из общего
   * ObjectAccessService, а не перечисляется заново. Его assertSameOrg не
   * используется намеренно: он пропускает объект с пустым ownerOrgId, а здесь
   * пустая организация с любой стороны — отказ.
   */
  private assertOrg(ownerOrgId: string | undefined, actor: RequestUser): void {
    if (this.access.isPrivileged(actor)) return;
    if (!actor.orgId || !ownerOrgId || ownerOrgId !== actor.orgId) {
      throw new ForbiddenException('RAILWAY_CROSS_ORG_ACCESS_DENIED');
    }
  }

  private wagonFor(actor: RequestUser, wagonId: string): Wagon {
    const wagon = this.wagons.get(wagonId);
    if (!wagon) throw new NotFoundException(`Wagon ${wagonId} not found`);
    this.assertOrg(wagon.ownerOrgId, actor);
    return wagon;
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

  listWagons(actor: RequestUser, ownerOrgId?: string): Wagon[] {
    const target = ownerOrgId ?? actor.orgId;
    this.assertOrg(target, actor);
    return [...this.wagons.values()].filter(w => w.ownerOrgId === target);
  }

  registerWagon(dto: {
    wagonNumber: string;
    type: WagonType;
    capacityTons: number;
    ownerOrgId: string;
  }): Wagon {
    // Вагон без владельца был бы ничьим, а значит — видимым отовсюду.
    if (!dto.ownerOrgId) throw new BadRequestException('RAILWAY_OWNER_ORG_REQUIRED');
    const existing = [...this.wagons.values()].find(w => w.wagonNumber === dto.wagonNumber);
    if (existing) throw new BadRequestException(`Wagon ${dto.wagonNumber} already registered`);

    // Поля перечислены поимённо. Прежняя россыпь `{ id: <новый UUID>, ...dto }`
    // позволяла присланному `id` перебить сгенерированный: замерено — вагон
    // чужой организации переписывался на месте, номер и владелец менялись, а
    // проверка дубля по номеру не срабатывала, потому что номер был другой.
    const wagon: Wagon = {
      id: randomUUID(),
      wagonNumber: dto.wagonNumber,
      type: dto.type,
      capacityTons: dto.capacityTons,
      ownerOrgId: dto.ownerOrgId,
      status: 'FREE',
      registeredAt: new Date().toISOString(),
    };
    this.wagons.set(wagon.id, wagon);
    return wagon;
  }

  updateWagonStatus(actor: RequestUser, wagonId: string, status: WagonStatus, dealId?: string): Wagon {
    const wagon = this.wagonFor(actor, wagonId);
    wagon.status = status;
    wagon.currentDealId = dealId ?? wagon.currentDealId;
    return wagon;
  }

  createGU12(actor: RequestUser, dto: {
    dealId: string;
    requestorOrgId: string;
    wagonIds: string[];
    departureStation: string;
    destinationStation: string;
    cargo: string;
    volumeTons: number;
    requestedDepartureAt: string;
  }): GU12Request {
    this.assertOrg(dto.requestorOrgId, actor);
    for (const wid of dto.wagonIds) {
      const w = this.wagonFor(actor, wid);
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

  async submitGU12(actor: RequestUser, requestId: string): Promise<GU12Request> {
    const req = this.gu12Requests.get(requestId);
    if (!req) throw new NotFoundException(`GU-12 request ${requestId} not found`);
    this.assertOrg(req.requestorOrgId, actor);
    if (req.status !== 'DRAFT') throw new BadRequestException('Only DRAFT requests can be submitted');

    req.status = 'SUBMITTED';

    try {
      const wagon = req.wagons[0] ? this.wagons.get(req.wagons[0]) : null;
      const waybill = await this.etran.createWaybill({
        wagonNumber: wagon?.wagonNumber ?? req.wagons[0] ?? 'UNKNOWN',
        loadStationCode: req.departureStation,
        destStationCode: req.destinationStation,
        senderId: req.requestorOrgId,
        receiverId: req.dealId,
        cargoCode: '011001',
        weightTons: req.volumeTons,
        loadDate: req.requestedDepartureAt,
        dealId: req.dealId,
      });
      req.etranId = waybill.gu29Number;
      this.logger.log(`GU-12 ${requestId} submitted to ЭТРАН: ${waybill.gu29Number}`);
    } catch (err) {
      this.logger.warn(`ЭТРАН submission failed for GU-12 ${requestId}: ${(err as Error).message}`);
      req.etranId = `ETRAN-MOCK-${Date.now()}`;
    }

    // Auto-approve after 100ms (simulates ЭТРАН async response)
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

  listGU12(actor: RequestUser, dealId?: string): GU12Request[] {
    const privileged = this.access.isPrivileged(actor);
    return [...this.gu12Requests.values()].filter(r =>
      (!dealId || r.dealId === dealId) && (privileged || (!!actor.orgId && r.requestorOrgId === actor.orgId)));
  }

  calculateDemurrage(actor: RequestUser, dto: {
    wagonId: string;
    dealId?: string;
    arrivedAt: string;
    unloadingCompletedAt: string;
  }): DemurrageRecord {
    // Прежде wagonId не проверялся вовсе: деньги считались и сохранялись для
    // любого, в том числе несуществующего или чужого вагона.
    this.wagonFor(actor, dto.wagonId);
    const arrivedMs = new Date(dto.arrivedAt).getTime();
    const completedMs = new Date(dto.unloadingCompletedAt).getTime();
    // Демередж — деньги. Неразбираемая дата давала NaN на всю запись, а в JSON
    // это уезжало как null: простой без суммы. Отказ честнее пустого числа.
    if (!Number.isFinite(arrivedMs) || !Number.isFinite(completedMs)) {
      throw new BadRequestException('DEMURRAGE_TIMESTAMP_INVALID');
    }
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

  listDemurrage(actor: RequestUser, dealId?: string): DemurrageRecord[] {
    const privileged = this.access.isPrivileged(actor);
    return [...this.demurrageRecords.values()].filter(r =>
      (!dealId || r.dealId === dealId)
      && (privileged || (!!actor.orgId && this.wagons.get(r.wagonId)?.ownerOrgId === actor.orgId)));
  }
}
