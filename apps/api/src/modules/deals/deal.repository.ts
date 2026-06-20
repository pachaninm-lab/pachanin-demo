import type { CreateDealDto } from './dto/create-deal.dto';
import type { RequestUser } from '../../common/types/request-user';

/**
 * Injection token for the deal data-access boundary.
 *
 * Controlled-pilot / pre-integration note:
 * The default binding is the in-memory RuntimeCore adapter. The DB-backed
 * (Prisma) adapter is a disabled skeleton and is only selected under the
 * explicit PLATFORM_V7_DEAL_REPOSITORY=prisma flag. There is no silent
 * Prisma fallback — see deals.module.ts.
 */
export const DEAL_REPOSITORY = 'DEAL_REPOSITORY';

/**
 * Repository boundary for deal reads/writes. This abstracts how deals are
 * stored away from DealsService (which keeps permission/scope/gate logic).
 *
 * Read methods are async to allow a future DB-backed adapter; the runtime
 * adapter resolves synchronously under the hood. Workspace/passport/timeline
 * and write methods mirror the current RuntimeCore semantics exactly.
 */
export interface DealRepository {
  /** Deals visible to the user. */
  list(user: RequestUser): Promise<unknown[]>;
  /** A single deal card by id. Throws if not found (RuntimeCore semantics). */
  getById(id: string): Promise<any>;
  /** Aggregated deal workspace view. */
  workspace(id: string): any;
  /** Deal passport view. */
  passport(id: string): any;
  /** Deal timeline view. */
  timeline(id: string): any;
  /** Create a deal. */
  create(dto: CreateDealDto, user: RequestUser): any;
  /** Transition a deal to the next state. */
  transition(id: string, nextState: string, user: RequestUser, comment?: string): any;
}
