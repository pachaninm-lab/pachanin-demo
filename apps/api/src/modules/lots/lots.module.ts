import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { ObjectPolicyService } from '../../common/security/object-policy.service';
import { AuditModule } from '../audit/audit.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { SearchModule } from '../search/search.module';
import { FgisLegacyQuarantineModule } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.module';
import { LotsController } from './lots.controller';
import { LotsService } from './lots.service';

@Module({
  imports: [AuditModule, SearchModule, AuctionsModule, FgisLegacyQuarantineModule],
  controllers: [LotsController],
  providers: [LotsService, AccessScopeService, ObjectPolicyService],
  exports: [LotsService]
})
export class LotsModule {}
