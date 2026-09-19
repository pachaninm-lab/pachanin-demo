import { Module } from '@nestjs/common';
import { EvidencePackService } from './evidence-pack.service';
import { EvidencePackController } from './evidence-pack.controller';

@Module({
  controllers: [EvidencePackController],
  providers: [EvidencePackService],
  exports: [EvidencePackService],
})
export class EvidencePackModule {}
