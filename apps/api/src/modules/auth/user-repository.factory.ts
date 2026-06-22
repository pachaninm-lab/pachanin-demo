import type { PrismaService } from '../../common/prisma/prisma.service';
import type { UserRepository } from './user.repository';
import { RuntimeUserRepository } from './user.repository';
import { PrismaUserRepository } from './prisma-user.repository';

/**
 * Selects the active identity adapter.
 *
 * Default: the in-memory runtime adapter. The DB-backed Prisma adapter is
 * selected ONLY when the explicit mode equals 'prisma'
 * (PLATFORM_V7_USER_REPOSITORY=prisma). Any other value keeps the runtime
 * adapter. There is no silent Prisma activation.
 */
export function selectUserRepository(
  prisma?: PrismaService,
  mode: string | undefined = process.env.PLATFORM_V7_USER_REPOSITORY,
): UserRepository {
  if (mode === 'prisma') {
    return new PrismaUserRepository(prisma);
  }
  return new RuntimeUserRepository();
}
