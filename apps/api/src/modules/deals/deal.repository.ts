import type { CreateDealDto } from './dto/create-deal.dto';
import type { RequestUser } from '../../common/types/request-user';

export const DEAL_REPOSITORY = 'DEAL_REPOSITORY';

/**
 * PostgreSQL-authoritative deal boundary. Every object read receives verified
 * session context so tenant and DealParticipant checks happen inside the same
 * transaction as the projection. Free-form legacy transitions are deliberately
 * absent: production state changes use domain commands only.
 */
export interface DealRepository {
  list(user: RequestUser): Promise<unknown[]>;
  getById(id: string, user: RequestUser): Promise<any>;
  workspace(id: string, user: RequestUser): Promise<any>;
  passport(id: string, user: RequestUser): Promise<any>;
  timeline(id: string, user: RequestUser): Promise<any>;
  create(dto: CreateDealDto, user: RequestUser): Promise<any>;
}
