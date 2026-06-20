import { Module, type Provider } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';
import { LAB_REPOSITORY } from './lab.repository';
import { selectLabRepository } from './lab-repository.factory';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Lab repository binding.
 *
 * Default (controlled-pilot / pre-integration): in-memory RuntimeCore adapter.
 * The DB-backed Prisma adapter is selected ONLY when
 * PLATFORM_V7_LAB_REPOSITORY=prisma is explicitly set. No silent Prisma
 * activation and no silent fallback between adapters.
 */
const labRepositoryProvider: Provider = {
  provide: LAB_REPOSITORY,
  useFactory: (runtime: RuntimeCoreService, prisma?: PrismaService) =>
    selectLabRepository(runtime, prisma),
  inject: [RuntimeCoreService, { token: PrismaService, optional: true }],
};

@Module({
  imports: [AuditModule],
  controllers: [LabsController],
  providers: [LabsService, AccessScopeService, labRepositoryProvider],
  exports: [LabsService]
})
export class LabsModule {}
