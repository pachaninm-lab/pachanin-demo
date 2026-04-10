import { Module } from '@nestjs/common';
import { RuntimeCoreService } from './runtime-core.service';

@Module({
  providers: [RuntimeCoreService],
  exports: [RuntimeCoreService],
})
export class RuntimeCoreModule {}
