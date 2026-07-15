import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { DisputeCommandService } from './dispute-command.service';
import { DisputeQueryService } from './dispute-query.service';

/**
 * Canonical dispute bounded context.
 *
 * PostgreSQL is the only runtime owner. There is deliberately no environment
 * switch, process-memory fallback or alternative repository binding.
 */
@Module({
  controllers: [DisputesController],
  providers: [
    DisputesService,
    DisputeCommandService,
    DisputeQueryService,
    RlsTransactionService,
    AccessScopeService,
  ],
  exports: [DisputesService, DisputeCommandService, DisputeQueryService],
})
export class DisputesModule {}
