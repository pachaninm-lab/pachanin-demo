import { Module, type Provider } from '@nestjs/common';
import { BusinessReputationModule } from '../business-reputation/business-reputation.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { USER_REPOSITORY } from './user.repository';
import { selectUserRepository } from './user-repository.factory';

/**
 * Identity adapter binding.
 *
 * Default: in-memory runtime adapter. The DB-backed Prisma adapter is selected
 * ONLY when PLATFORM_V7_USER_REPOSITORY=prisma is explicitly set. No silent
 * Prisma activation, no silent fallback between adapters.
 */
const userRepositoryProvider: Provider = {
  provide: USER_REPOSITORY,
  useFactory: (prisma?: PrismaService) => selectUserRepository(prisma),
  inject: [{ token: PrismaService, optional: true }],
};

@Module({
  imports: [BusinessReputationModule],
  controllers: [AuthController],
  providers: [AuthService, userRepositoryProvider],
  exports: [AuthService]
})
export class AuthModule {}
