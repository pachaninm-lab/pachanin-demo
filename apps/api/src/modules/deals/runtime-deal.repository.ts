import { Injectable } from '@nestjs/common';
import type { DealRepository } from './deal.repository';
import type { CreateDealDto } from './dto/create-deal.dto';
import type { RequestUser } from '../../common/types/request-user';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

/**
 * Default deal repository adapter.
 *
 * Wraps the in-memory RuntimeCore deal methods without changing behavior.
 * This is the only active adapter in controlled-pilot / pre-integration mode.
 */
@Injectable()
export class RuntimeDealRepository implements DealRepository {
  constructor(private readonly runtime: RuntimeCoreService) {}

  async list(user: RequestUser): Promise<unknown[]> {
    return this.runtime.listDeals(user);
  }

  async getById(id: string): Promise<any> {
    return this.runtime.getDeal(id);
  }

  workspace(id: string): any {
    return this.runtime.dealWorkspace(id);
  }

  passport(id: string): any {
    return this.runtime.dealPassport(id);
  }

  timeline(id: string): any {
    return this.runtime.dealTimeline(id);
  }

  create(dto: CreateDealDto, user: RequestUser): any {
    return this.runtime.createDeal(dto, user);
  }

  transition(id: string, nextState: string, user: RequestUser, comment?: string): any {
    return this.runtime.transitionDeal(id, nextState, user, comment);
  }
}
