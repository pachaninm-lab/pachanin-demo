import type { DealRepository } from './deal.repository';
import { RuntimeDealRepository } from './runtime-deal.repository';
import { PrismaDealRepository } from './prisma-deal.repository';
import type { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Selects the active deal repository adapter.
 *
 * Default (controlled-pilot / pre-integration): the in-memory RuntimeCore
 * adapter. The DB-backed Prisma adapter is selected ONLY when the explicit
 * mode value equals 'prisma' (PLATFORM_V7_DEAL_REPOSITORY=prisma). Any other
 * value — including a present-but-unset flag or an unrelated value — keeps the
 * runtime adapter. There is no silent Prisma activation.
 */
export function selectDealRepository(
  runtime: RuntimeCoreService,
  prisma?: PrismaService,
  mode: string | undefined = process.env.PLATFORM_V7_DEAL_REPOSITORY,
): DealRepository {
  if (mode === 'prisma') {
    return new PrismaDealRepository(prisma);
  }
  return new RuntimeDealRepository(runtime);
}
