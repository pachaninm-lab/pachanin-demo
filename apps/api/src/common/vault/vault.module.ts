import { Global, Module } from '@nestjs/common';
import { VaultTransitService } from './vault-transit.service';

@Global()
@Module({
  providers: [VaultTransitService],
  exports: [VaultTransitService],
})
export class VaultModule {}
