import type { DisputeRepository } from './dispute.repository';
import { RuntimeDisputeRepository } from './runtime-dispute.repository';
import { PrismaDisputeRepository } from './prisma-dispute.repository';
import type { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Selects the active dispute repository adapter. Default: the runtime adapter
 * (in-memory store). The Prisma adapter is selected only when mode === 'prisma'
 * (PLATFORM_V7_DISPUTE_REPOSITORY=prisma). No silent Prisma activation.
 */
export function selectDisputeRepository(
  runtime: RuntimeDisputeRepository,
  prisma?: PrismaService,
  mode: string | undefined = process.env.PLATFORM_V7_DISPUTE_REPOSITORY,
): DisputeRepository {
  if (mode === 'prisma') {
    return new PrismaDisputeRepository(prisma);
  }
  return runtime;
}
