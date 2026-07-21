import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { CommodityProfileRepository } from './commodity-profile.repository';
import {
  COMMODITY_PROFILE_TRANSACTION_PORT,
  CommodityProfileTransactionCommandService,
} from './commodity-profile-transaction-command.service';
import { CommodityProfilesModule } from './commodity-profiles.module';
import { PostgresqlCommodityProfileTransactionPort } from './postgresql-commodity-profile-transaction.port';

jest.setTimeout(10_000);

describe('CommodityProfilesModule private authority wiring', () => {
  it('binds the command service to the PostgreSQL port without publishing controllers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CommodityProfilesModule],
    }).compile();

    try {
      const service = moduleRef.get(CommodityProfileTransactionCommandService);
      const repository = moduleRef.get(CommodityProfileRepository);
      const postgresPort = moduleRef.get(PostgresqlCommodityProfileTransactionPort);
      const boundPort = moduleRef.get(COMMODITY_PROFILE_TRANSACTION_PORT);
      const controllers = Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        CommodityProfilesModule,
      ) ?? [];

      expect(service).toBeInstanceOf(CommodityProfileTransactionCommandService);
      expect(repository).toBeInstanceOf(CommodityProfileRepository);
      expect(boundPort).toBe(postgresPort);
      expect(controllers).toEqual([]);
    } finally {
      await moduleRef.close();
    }
  });
});
