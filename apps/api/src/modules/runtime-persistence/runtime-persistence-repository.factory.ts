import type { PrismaService } from '../../common/prisma/prisma.service';
import { PrismaRuntimePersistenceRepository } from './prisma-runtime-persistence.repository';
import {
  DisabledRuntimePersistenceRepository,
  type RuntimePersistenceRepository,
} from './runtime-persistence.repository';

/**
 * Selects the runtime-persistence repository without silent fallback.
 *
 * The Prisma path is active only for the exact `prisma` mode. Every other value
 * returns a fail-closed disabled repository and never writes to the process
 * runtime store.
 */
export function selectRuntimePersistenceRepository(
  prisma?: PrismaService,
  mode: string | undefined = process.env.PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY,
): RuntimePersistenceRepository {
  if (mode === 'prisma') {
    return new PrismaRuntimePersistenceRepository(prisma);
  }

  return new DisabledRuntimePersistenceRepository();
}
