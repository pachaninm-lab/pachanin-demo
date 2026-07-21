import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { CommodityProfilesController } from './commodity-profiles.controller';
import { CommodityProfileRepository } from './commodity-profile.repository';
import {
  COMMODITY_PROFILE_TRANSACTION_PORT,
  CommodityProfileTransactionCommandService,
} from './commodity-profile-transaction-command.service';
import { CommodityProfilesModule } from './commodity-profiles.module';
import { PostgresqlCommodityProfileTransactionPort } from './postgresql-commodity-profile-transaction.port';

jest.setTimeout(10_000);

describe('CommodityProfilesModule private authority wiring', () => {
  it('publishes only the governed private controller and keeps the PostgreSQL port internal', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CommodityProfilesModule],
    }).compile();

    try {
      const service = moduleRef.get(CommodityProfileTransactionCommandService);
      const repository = moduleRef.get(CommodityProfileRepository);
      const postgresPort = moduleRef.get(PostgresqlCommodityProfileTransactionPort);
      const boundPort = moduleRef.get(COMMODITY_PROFILE_TRANSACTION_PORT);
      const controller = moduleRef.get(CommodityProfilesController);
      const controllers = Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        CommodityProfilesModule,
      ) ?? [];
      const exportedProviders = Reflect.getMetadata(
        MODULE_METADATA.EXPORTS,
        CommodityProfilesModule,
      ) ?? [];

      expect(service).toBeInstanceOf(CommodityProfileTransactionCommandService);
      expect(repository).toBeInstanceOf(CommodityProfileRepository);
      expect(boundPort).toBe(postgresPort);
      expect(controller).toBeInstanceOf(CommodityProfilesController);
      expect(controllers).toEqual([CommodityProfilesController]);
      expect(exportedProviders).toEqual([
        CommodityProfileRepository,
        CommodityProfileTransactionCommandService,
      ]);
      expect(exportedProviders).not.toContain(PostgresqlCommodityProfileTransactionPort);
      expect(exportedProviders).not.toContain(COMMODITY_PROFILE_TRANSACTION_PORT);
    } finally {
      await moduleRef.close();
    }
  });
});
