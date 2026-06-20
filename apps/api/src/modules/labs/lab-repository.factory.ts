import type { LabRepository } from './lab.repository';
import { RuntimeLabRepository } from './runtime-lab.repository';
import { PrismaLabRepository } from './prisma-lab.repository';
import type { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Selects the active lab repository adapter. Default: runtime adapter.
 * The Prisma adapter is selected only when mode === 'prisma'
 * (PLATFORM_V7_LAB_REPOSITORY=prisma). No silent Prisma activation.
 */
export function selectLabRepository(
  runtime: RuntimeCoreService,
  prisma?: PrismaService,
  mode: string | undefined = process.env.PLATFORM_V7_LAB_REPOSITORY,
): LabRepository {
  if (mode === 'prisma') {
    return new PrismaLabRepository(prisma);
  }
  return new RuntimeLabRepository(runtime);
}
