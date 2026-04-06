import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateLotDto } from './dto/create-lot.dto';

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
}

@Injectable()
export class LotsService {
  private readonly store: Lot[] = [];

  constructor() {
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
    };
    this.store.push(lot);
    return lot;
  }

  submit(id: string, user: any): Lot {
    const lot = this.findOrThrow(id);
    if (lot.status !== 'DRAFT') {
      throw new BadRequestException(`Лот ${id} имеет статус ${lot.status}, ожидался DRAFT`);
    }
    lot.status = 'OPEN';
    lot.updatedAt = new Date().toISOString();
    return lot;
  }

  publish(id: string, user: any): Lot {
    const lot = this.findOrThrow(id);
    if (lot.status !== 'OPEN') {
      throw new BadRequestException(`Лот ${id} имеет статус ${lot.status}, ожидался OPEN`);
    }
    lot.status = 'BIDDING';
    lot.updatedAt = new Date().toISOString();
    return lot;
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
