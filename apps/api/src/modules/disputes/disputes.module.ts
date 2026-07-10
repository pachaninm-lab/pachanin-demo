import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { AtomicDisputesService } from './atomic-disputes.service';

@Module({
  controllers: [DisputesController],
  providers: [
    AtomicDisputesService,
    {
      provide: DisputesService,
      useExisting: AtomicDisputesService,
    },
  ],
  exports: [DisputesService],
})
export class DisputesModule {}
