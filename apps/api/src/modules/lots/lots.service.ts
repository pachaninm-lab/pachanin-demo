import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { CreateLotDto } from './dto/create-lot.dto';
import { SearchService } from '../search/search.service';
import {
  FGIS_LEGACY_ERROR_CODES,
  denyRetiredLegacyFgisRoute,
} from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';
import { FgisLegacyQuarantineAuditService } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.audit';
import type { RequestUser } from '../../common/types/request-user';

/**
 * P0.2-1A — the legacy in-memory lot contour is closed in production.
 *
 * This service keeps lots in a process array. Everything a grain offer needs in
 * order to be trustworthy is missing: there is no PostgreSQL authority, no row
 * locking, no reservation against a confirmed volume, no tenant isolation, no
 * durable object authorization and no audit. Concretely, before this change:
 *
 *   - three demo lots were seeded into every reader, production included;
 *   - `create` fell back to `demo-org` / `demo-user` when the caller had no
 *     organization, so an unattributable draft entered the store;
 *   - drafts lived in process memory, so they vanished on restart and differed
 *     between instances behind a load balancer;
 *   - `getReport(id)` looked the lot up by id alone, with no ownership check,
 *     so any authenticated caller could read any lot by guessing its id;
 *   - `submit` and `publish` moved a lot into a tradable status with no
 *     reservation, so the same grain could be offered more than once.
 *
 * Partial fixes were not worth building on a store that has to be replaced, so
 * the whole surface is withdrawn in production: create, list, get, submit and
 * publish all fail closed with one structured denial and a durable audit
 * record. Outside production the behaviour is unchanged, and that path is
 * reached only through an explicit test-only binding.
 *
 * The replacement is the canonical PostgreSQL auction authority, plus — for
 * confirmed grain — the ФГИС «Зерно» party snapshot, reservation and passport
 * that later slices introduce.
 */

/**
 * Explicit test-only binding for the legacy contour.
 *
 * Production is the default: a runtime that does not say what it is gets the
 * strict contour, so a missing or misspelled `NODE_ENV` cannot silently reopen
 * the legacy surface. Only `test` and `development` opt in, and they do so
 * through this one named binding rather than scattered `NODE_ENV` checks.
 */
export const LEGACY_LOT_CONTOUR_TEST_BINDING = {
  get enabled(): boolean {
    const nodeEnv = process.env.NODE_ENV ?? 'production';
    return nodeEnv === 'test' || nodeEnv === 'development';
  },
};

export function isLegacyLotContourEnabled(): boolean {
  return LEGACY_LOT_CONTOUR_TEST_BINDING.enabled;
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
   * Honest marking. A lot captured here is a manual draft whose grain has not
   * been confirmed against any external register, and a reader must be able to
   * tell that without inferring it from the status.
   */
  sourceVerification?: 'UNVERIFIED_MANUAL_DRAFT';
}

const DENIAL_MESSAGE =
  'Устаревший контур лотов отключён: он не подтверждает объём партии, ' +
  'не удерживает его от повторной продажи и не хранит лот в PostgreSQL.';
const DENIAL_NEXT_STEP =
  'Создайте лот из подтверждённой партии ФГИС «Зерно» после подключения организации.';

@Injectable()
export class LotsService {
  private readonly store: Lot[] = [];

  constructor(
    private readonly quarantineAudit: FgisLegacyQuarantineAuditService,
    @Optional() private readonly searchService?: SearchService,
  ) {
    // Fixtures exist for local demos and tests. They are never seeded in
    // production, so no fixture can reach a production projection even if a
    // read path were reopened by mistake.
    if (!isLegacyLotContourEnabled()) return;

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

  async list(user?: Partial<RequestUser> | null): Promise<Lot[]> {
    await this.assertLegacyContourAvailable('GET /lots', user);
    const role = user?.role;
    if (role === 'FARMER') {
      const orgId = user?.orgId;
      return this.store.filter((lot) => lot.sellerOrgId === orgId || lot.sellerUserId === user?.id);
    }
    if (role === 'BUYER') {
      return this.store.filter((lot) => lot.status === 'OPEN' || lot.status === 'BIDDING');
    }
    return [...this.store];
  }

  async listReport(
    user?: Partial<RequestUser> | null,
  ): Promise<Array<Lot & { bidsCount: number; currentPrice: number; timeLeft: string }>> {
    await this.assertLegacyContourAvailable('GET /lots/report', user);
    const lots = await this.list(user);
    return lots.map((lot) => this.toReportShape(lot));
  }

  async getReport(
    id: string,
    user?: Partial<RequestUser> | null,
  ): Promise<Lot & { bidsCount: number; currentPrice: number; timeLeft: string }> {
    await this.assertLegacyContourAvailable('GET /lots/:id/report', user);
    const lot = this.store.find((l) => l.id === id);
    if (!lot) throw new NotFoundException(`Лот ${id} не найден`);
    return this.toReportShape(lot);
  }

  async create(dto: CreateLotDto, user: Partial<RequestUser> | null): Promise<Lot> {
    await this.assertLegacyContourAvailable('POST /lots', user);
    // No `demo-org` / `demo-user` fallback: a lot without a real owner is not a
    // lot, and inventing one made the store unattributable.
    const sellerOrgId = user?.orgId;
    const sellerUserId = user?.id;
    if (!sellerOrgId || !sellerUserId) {
      throw new BadRequestException({
        code: 'LOT_OWNER_REQUIRED',
        message: 'Черновик лота требует организации и пользователя из сессии.',
      });
    }

    const lot: Lot = {
      id: `LOT-${Date.now()}`,
      ...dto,
      status: 'DRAFT',
      sellerOrgId,
      sellerUserId,
      createdAt: new Date().toISOString(),
      sourceVerification: 'UNVERIFIED_MANUAL_DRAFT',
    };
    this.store.push(lot);
    this.searchService?.indexLot(lot).catch(() => undefined);
    return lot;
  }

  async submit(id: string, user: Partial<RequestUser> | null): Promise<Lot> {
    await this.assertLegacyContourAvailable('PATCH /lots/:id/submit', user);
    const lot = this.findOrThrow(id);
    if (lot.status !== 'DRAFT') {
      throw new BadRequestException(`Лот ${id} имеет статус ${lot.status}, ожидался DRAFT`);
    }
    lot.status = 'OPEN';
    lot.updatedAt = new Date().toISOString();
    this.searchService?.indexLot(lot).catch(() => undefined);
    return lot;
  }

  async publish(id: string, user: Partial<RequestUser> | null): Promise<Lot> {
    await this.assertLegacyContourAvailable('PATCH /lots/:id/publish', user);
    const lot = this.findOrThrow(id);
    if (lot.status !== 'OPEN') {
      throw new BadRequestException(`Лот ${id} имеет статус ${lot.status}, ожидался OPEN`);
    }
    lot.status = 'BIDDING';
    lot.updatedAt = new Date().toISOString();
    this.searchService?.indexLot(lot).catch(() => undefined);
    return lot;
  }

  /**
   * Single fail-closed gate for the whole legacy surface. It runs first in every
   * method, before any lookup, so a denial never depends on — or discloses —
   * whether a given lot exists.
   */
  private async assertLegacyContourAvailable(
    route: string,
    user: Partial<RequestUser> | null | undefined,
  ): Promise<void> {
    if (isLegacyLotContourEnabled()) return;
    await denyRetiredLegacyFgisRoute({
      code: FGIS_LEGACY_ERROR_CODES.LEGACY_LOT_CONTOUR_RETIRED,
      message: DENIAL_MESSAGE,
      nextStep: DENIAL_NEXT_STEP,
      route,
      actor: user ?? null,
      audit: this.quarantineAudit,
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
