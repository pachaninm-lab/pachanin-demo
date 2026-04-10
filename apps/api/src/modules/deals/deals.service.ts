import { Injectable } from '@nestjs/common';
import { CreateDealDto } from './dto/create-deal.dto';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

@Injectable()
export class DealsService {
  constructor(private readonly runtime: RuntimeCoreService) {}

  list(user: any) {
    return this.runtime.listDeals(user);
  }

  getOne(id: string, _user: any) {
    return this.runtime.getDeal(id);
  }

  workspace(id: string, _user: any) {
    return this.runtime.dealWorkspace(id);
  }

  passport(id: string, _user: any) {
    return this.runtime.dealPassport(id);
  }

  timeline(id: string, _user: any) {
    return this.runtime.dealTimeline(id);
  }

  create(dto: CreateDealDto, user: any) {
    return this.runtime.createDeal(dto, user);
  }

  transition(id: string, dto: { nextState: string; comment?: string }, user: any) {
    return this.runtime.transitionDeal(id, dto.nextState, user, dto.comment);
  }
}
