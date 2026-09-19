import { Inject, Injectable } from '@nestjs/common';
import { CreateDealDto } from './dto/create-deal.dto';
import { DEAL_REPOSITORY, type DealRepository } from './deal.repository';
import { RequestUser } from '../../common/types/request-user';

/**
 * Thin application boundary over the PostgreSQL-authoritative repository.
 * Authorization, participant scope, idempotency and atomic creation are kept in
 * the repository transaction. This service deliberately has no RuntimeCore,
 * best-effort event emission, saga mutation or free-form state transition path.
 */
@Injectable()
export class DealsService {
  constructor(@Inject(DEAL_REPOSITORY) private readonly deals: DealRepository) {}

  list(user: RequestUser) {
    return this.deals.list(user);
  }

  getOne(id: string, user: RequestUser) {
    return this.deals.getById(id, user);
  }

  workspace(id: string, user: RequestUser) {
    return this.deals.workspace(id, user);
  }

  passport(id: string, user: RequestUser) {
    return this.deals.passport(id, user);
  }

  timeline(id: string, user: RequestUser) {
    return this.deals.timeline(id, user);
  }

  create(dto: CreateDealDto, user: RequestUser) {
    return this.deals.create(dto, user);
  }
}
