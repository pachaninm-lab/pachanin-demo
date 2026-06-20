import { Module, type Provider } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { DISPUTE_REPOSITORY } from './dispute.repository';
import { RuntimeDisputeRepository } from './runtime-dispute.repository';
import { selectDisputeRepository } from './dispute-repository.factory';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Dispute repository binding.
 *
 * Default (controlled-pilot / pre-integration): in-memory runtime adapter that
 * owns the dispute store. The DB-backed Prisma adapter is selected ONLY when
 * PLATFORM_V7_DISPUTE_REPOSITORY=prisma is explicitly set. No silent Prisma
 * activation and no silent fallback. Money logic (holds, decision money
 * instructions) stays in DisputesService.
 */
const disputeRepositoryProvider: Provider = {
  provide: DISPUTE_REPOSITORY,
  useFactory: (runtime: RuntimeDisputeRepository, prisma?: PrismaService) =>
    selectDisputeRepository(runtime, prisma),
  inject: [RuntimeDisputeRepository, { token: PrismaService, optional: true }],
};

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [DisputesController],
  providers: [DisputesService, AccessScopeService, RuntimeDisputeRepository, disputeRepositoryProvider],
  exports: [DisputesService]
})
export class DisputesModule {}
