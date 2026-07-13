import { LogisticsController } from './logistics.controller';
import { LogisticsModule } from './logistics.module';
import { PrismaShipmentRepository } from './prisma-shipment.repository';
import { SHIPMENT_REPOSITORY } from './shipment.repository';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

describe('LogisticsModule production composition', () => {
  it('binds the authoritative PostgreSQL repository directly', () => {
    const providers = Reflect.getMetadata('providers', LogisticsModule) as unknown[];

    expect(providers).toContain(PrismaShipmentRepository);
    expect(providers).toContainEqual({
      provide: SHIPMENT_REPOSITORY,
      useExisting: PrismaShipmentRepository,
    });
    expect(providers).not.toContain(RuntimeCoreService);
    expect(providers.some((provider) => String(provider).includes('RuntimeShipmentRepository'))).toBe(false);
  });

  it('exposes only the PostgreSQL-authoritative logistics controller', () => {
    const controllers = Reflect.getMetadata('controllers', LogisticsModule) as unknown[];
    expect(controllers).toEqual([LogisticsController]);
  });
});
