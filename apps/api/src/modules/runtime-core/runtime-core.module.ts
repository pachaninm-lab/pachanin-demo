import { Global, Module } from '@nestjs/common';
import { RuntimeCoreService } from './runtime-core.service';

@Global()
@Module({
  providers: [RuntimeCoreService],
  exports: [RuntimeCoreService],
})
export class RuntimeCoreModule {}
