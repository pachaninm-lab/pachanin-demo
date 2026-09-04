import { Module } from '@nestjs/common';
import { FgisGrainCommodityAuthorityRepository } from './fgis-grain-commodity-authority.repository';
import { FgisGrainCommodityAuthorityService } from './fgis-grain-commodity-authority.service';

@Module({
  providers: [
    FgisGrainCommodityAuthorityRepository,
    FgisGrainCommodityAuthorityService,
  ],
  exports: [
    FgisGrainCommodityAuthorityRepository,
    FgisGrainCommodityAuthorityService,
  ],
})
export class FgisGrainCommodityAuthorityModule {}
