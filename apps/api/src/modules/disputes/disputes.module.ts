import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { PostgresqlDisputeRepository } from './postgresql-dispute.repository';
import { DisputesService } from './disputes.service';

@Module({
  controllers: [DisputesController],
  providers: [PostgresqlDisputeRepository, DisputesService],
  exports: [DisputesService, PostgresqlDisputeRepository],
})
export class DisputesModule {}
