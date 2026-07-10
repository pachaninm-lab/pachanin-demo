import type { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { PrismaRuntimePersistenceRepository } from './prisma-runtime-persistence.repository';
import {
  DisabledRuntimePersistenceRepository,
  type RuntimePersistenceRepository,
} from './runtime-persistence.repository';

/**
 * Selects the runtime-persistence repository without silent fallback.
 *
 * The Prisma path is active only for the exact `prisma` mode and requires the
 * canonical transaction-local RLS service. Every other value returns a
 * fail-closed disabled repository and never writes to process memory.
 */
export function selectRuntimePersistenceRepository(
  rls?: RlsTransactionService,
  mode: string | undefined = process.env.PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY,
): RuntimePersistenceRepository {
  if (mode === 'prisma') {
    return new PrismaRuntimePersistenceRepository(rls);
  }

  return new DisabledRuntimePersistenceRepository();
}
