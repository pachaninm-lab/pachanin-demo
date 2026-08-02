import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { CreateLotDto } from './dto/create-lot.dto';
import { SearchService } from '../search/search.service';
import {
  FGIS_LEGACY_ERROR_CODES,
  denyRetiredLegacyFgisRoute,
} from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';

/**
 * P0.2-1A. This service keeps lots in a process array. It has no PostgreSQL
 * authority, no row locking, no reservation against a confirmed volume, no
 * tenant isolation and no audit — so a lot it moves to a tradable status can be
 * sold twice, survives no restart, and carries no evidence of the grain behind
 * it. It also seeded three demo lots into every reader, production included.
 *
 * Draft capture stays available and is now marked honestly. Anything that would
 * make a lot tradable is refused in production; the canonical path is the
 * PostgreSQL auction authority, and confirmed grain lots wait for the ФГИС
 * «Зерно» party snapshot, reservation and passport.
 */
function isProductionRuntime(): boolean {
  return (process.env.NODE_ENV ?? 'development') === 'production';
}

export type LotStatus = 'DRAFT' | 'OPEN' | 'BIDDING' | 'MATCHED' | 'IN_DEAL' | 'CLOSED' | 'CANCELLED';

export interface Lot {
  id: string;
  title: string;
  culture: string;
  grade?: string;
  volumeTons: number;
  startPrice: number;
  stepPrice: number;
  region: string;
  address?: string;
  qualityJson?: Record<string, any>;
  lat?: number;
  lng?: number;
  status: LotStatus;
  sellerOrgId: string;
  sellerUserId: string;
  auctionEndsAt: string;
  createdAt: string;
  updatedAt?: string;
  /**
   * Honest marking required by P0.2. A lot captured here is a manual draft
   * whose grain has not been confirmed against any external register, and a
   * reader must be able to tell that without inferring it from the status.
   */
  sourceVerification?: 'UNVERIFIED_MANUAL_DRAFT';
}

@Injectable()
export class LotsService {
  private readonly store: Lot[] = [];

  constructor(@Optional() private readonly searchService?: SearchService) {
    // Demo lots are fixtures. They used to be returned to every reader, so a
    // production seller saw three lots nobody had offered. They are seeded
    // outside production only, which keeps existing local and test flows intact
    // while removing fixtures from the production projection entirely.
    if (isProductionRuntime()) return;

    this.store.push(
      {
        id: 'LOT-001',
        title: 'Пшеница 3 класс, Тамбовская',
        culture: 'wheat',
        grade: '3',
        volumeTons: 500,
        startPrice: 12500,
        stepPrice: 250,
        region: 'Тамбовская область',
        status: 'BIDDING',
        sellerOrgId: 'org-farmer-1',
        sellerUserId: 'user-farmer-1',
        auctionEndsAt: '2026-04-15T18:00:00Z',
        createdAt: '2026-03-20T10:00:00Z',
      },
      {
        id: 'LOT-002',
        title: 'Ячмень, ЦФО',
        culture: 'barley',
        grade: '2',
        volumeTons: 300,
        startPrice: 10800,
        stepPrice: 200,
        region: 'Воронежская область',
        status: 'OPEN',
        sellerOrgId: 'org-farmer-2',
        sellerUserId: 'user-farmer-2',
        auctionEndsAt: '2026-04-20T18:00:00Z',
        createdAt: '2026-03-25T10:00:00Z',
      },
      {
        id: 'LOT-003',
        title: 'Кукуруза, Краснодарский',
        culture: 'corn',
        volumeTons: 750,
        startPrice: 11200,
        stepPrice: 300,
        region: 'Краснодарский край',
        status: 'MATCHED',
        sellerOrgId: 'org-farmer-1',
        sellerUserId: 'user-farmer-1',
        auctionEndsAt: '2026-04-10T18:00:00Z',
        createdAt: '2026-03-15T10:00:00Z',
      },
    );
  }

  list(user?: any): Lot[] {
    const role = user?.role;
    if (role === 'FARMER') {
      const orgId = user?.orgId || user?.sub;
      return this.store.filter((lot) => lot.sellerOrgId === orgId || lot.sellerUserId === user?.id);
    }
    if (role === 'BUYER') {
      return this.store.filter((lot) => lot.status === 'OPEN' || lot.status === 'BIDDING');
    }
    return [...this.store];
  }

  listReport(user?: any): Array<Lot & { bidsCount: number; currentPrice: number; timeLeft: string }> {
    const lots = this.list(user);
    return lots.map((lot) => this.toReportShape(lot));
  }

  getReport(id: string, user?: any): Lot & { bidsCount: number; currentPrice: number; timeLeft: string } {
    const lot = this.store.find((l) => l.id === id);
    if (!lot) throw new NotFoundException(`Лот ${id} не найден`);
    return this.toReportShape(lot);
  }

  create(dto: CreateLotDto, user: any): Lot {
    const lot: Lot = {
      id: `LOT-${Date.now()}`,
      ...dto,
      status: 'DRAFT',
      sellerOrgId: user?.orgId || 'demo-org',
      sellerUserId: user?.id || 'demo-user',
      createdAt: new Date().toISOString(),
      sourceVerification: 'UNVERIFIED_MANUAL_DRAFT',
    };
    this.store.push(lot);
    this.searchService?.indexLot(lot).catch(() => undefined);
    return lot;
  }

  submit(id: string, user: any): Lot {
    const lot = this.findOrThrow(id);
    this.assertNotTradableInProduction(lot, 'PATCH /lots/:id/submit', user);
    if (lot.status !== 'DRAFT') {
      throw new BadRequestException(`Лот ${id} имеет статус ${lot.status}, ожидался DRAFT`);
    }
    lot.status = 'OPEN';
    lot.updatedAt = new Date().toISOString();
    this.searchService?.indexLot(lot).catch(() => undefined);
    return lot;
  }

  publish(id: string, user: any): Lot {
    const lot = this.findOrThrow(id);
    this.assertNotTradableInProduction(lot, 'PATCH /lots/:id/publish', user);
    if (lot.status !== 'OPEN') {
      throw new BadRequestException(`Лот ${id} имеет статус ${lot.status}, ожидался OPEN`);
    }
    lot.status = 'BIDDING';
    lot.updatedAt = new Date().toISOString();
    this.searchService?.indexLot(lot).catch(() => undefined);
    return lot;
  }

  /**
   * Refuses, in production, any transition that would offer grain for sale from
   * this in-memory store. The check runs before the status precondition so a
   * caller cannot learn the lot's current status from the error it gets back.
   *
   * Outside production the transitions still work, so local development and the
   * existing test suites are unaffected.
   */
  private assertNotTradableInProduction(lot: Lot, route: string, user: any): void {
    if (!isProductionRuntime()) return;
    denyRetiredLegacyFgisRoute({
      code: FGIS_LEGACY_ERROR_CODES.VERIFIED_LOT_PATH_NOT_READY,
      message:
        'Публикация зернового лота этим маршрутом отключена: он не подтверждает ' +
        'объём партии и не удерживает его от повторной продажи.',
      nextStep:
        'Создайте лот из подтверждённой партии ФГИС «Зерно» после подключения организации.',
      route: `${route} (${lot.culture})`,
      actorUserId: user?.sub ?? user?.id ?? null,
    });
  }

  private findOrThrow(id: string): Lot {
    const lot = this.store.find((l) => l.id === id);
    if (!lot) throw new NotFoundException(`Лот ${id} не найден`);
    return lot;
  }

  private toReportShape(lot: Lot) {
    const endsAt = new Date(lot.auctionEndsAt).getTime();
    const now = Date.now();
    const diffMs = endsAt - now;
    const diffHours = Math.max(0, Math.floor(diffMs / 3_600_000));
    const diffMins = Math.max(0, Math.floor((diffMs % 3_600_000) / 60_000));
    const timeLeft = diffMs <= 0 ? 'Завершён' : `${diffHours}ч ${diffMins}м`;

    return {
      ...lot,
      bidsCount: Math.floor(Math.random() * 10),
      currentPrice: lot.startPrice,
      timeLeft,
    };
  }
}
