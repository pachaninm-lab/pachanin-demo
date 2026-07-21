import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommodityProfilesController } from './commodity-profiles.controller';
import { CommodityProfileRepository } from './commodity-profile.repository';
import {
  COMMODITY_PROFILE_TRANSACTION_PORT,
  CommodityProfileTransactionCommandService,
} from './commodity-profile-transaction-command.service';
import { PostgresqlCommodityProfileTransactionPort } from './postgresql-commodity-profile-transaction.port';

@Module({
  imports: [PrismaModule],
  controllers: [CommodityProfilesController],
  providers: [
    CommodityProfileRepository,
    PostgresqlCommodityProfileTransactionPort,
    {
      provide: COMMODITY_PROFILE_TRANSACTION_PORT,
      useExisting: PostgresqlCommodityProfileTransactionPort,
    },
    CommodityProfileTransactionCommandService,
  ],
  exports: [
    CommodityProfileRepository,
    CommodityProfileTransactionCommandService,
  ],
})
export class CommodityProfilesModule {}
