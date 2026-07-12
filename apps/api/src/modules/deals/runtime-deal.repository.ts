import { Injectable } from '@nestjs/common';
import type { DealRepository } from './deal.repository';
import type { CreateDealDto } from './dto/create-deal.dto';
import type { RequestUser } from '../../common/types/request-user';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

/**
 * Explicit test/demo adapter. It is not registered by DealsModule and cannot be
 * selected by production configuration. Kept only for isolated legacy tests
 * while those fixtures are removed.
 */
@Injectable()
export class RuntimeDealRepository implements DealRepository {
  constructor(private readonly runtime: RuntimeCoreService) {}

  async list(user: RequestUser): Promise<unknown[]> {
    return this.runtime.listDeals(user);
  }

  async getById(id: string, _user: RequestUser): Promise<any> {
    return this.runtime.getDeal(id);
  }

  async workspace(id: string, _user: RequestUser): Promise<any> {
    return this.runtime.dealWorkspace(id);
  }

  async passport(id: string, _user: RequestUser): Promise<any> {
    return this.runtime.dealPassport(id);
  }

  async timeline(id: string, _user: RequestUser): Promise<any> {
    return this.runtime.dealTimeline(id);
  }

  async create(dto: CreateDealDto, user: RequestUser): Promise<any> {
    return this.runtime.createDeal(dto, user);
  }
}
