import {
  assertIndustrialProductionStartup,
  IndustrialStartupError,
} from '../../common/config/industrial-mode';
import { LAB_REPOSITORY } from './lab.repository';
import { LabsModule } from './labs.module';
import { PrismaLabRepository } from './prisma-lab.repository';

describe('Labs PostgreSQL authority composition', () => {
  it('binds the complete Prisma repository directly', () => {
    const providers = Reflect.getMetadata('providers', LabsModule) as unknown[];
    expect(providers).toContain(PrismaLabRepository);
    expect(providers).toContainEqual({
      provide: LAB_REPOSITORY,
      useExisting: PrismaLabRepository,
    });
    expect(JSON.stringify(providers)).not.toContain('RuntimeCore');
    expect(JSON.stringify(providers)).not.toContain('selectLabRepository');
  });
});

describe('production startup laboratory authority gate', () => {
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://deal@production.invalid/db',
    STORAGE_DATABASE_URL: 'postgresql://app_storage@production.invalid/db',
    PLATFORM_V7_DEAL_REPOSITORY: 'prisma',
    PLATFORM_V7_DOCUMENT_REPOSITORY: 'prisma',
    PLATFORM_V7_SHIPMENT_REPOSITORY: 'prisma',
    PLATFORM_V7_LAB_REPOSITORY: 'prisma',
  };

  it('accepts only the explicit Prisma laboratory binding', () => {
    expect(() => assertIndustrialProductionStartup(base)).not.toThrow();
  });

  it.each([undefined, 'memory', 'typo'])('fails closed for laboratory mode %s', (mode) => {
    expect(() => assertIndustrialProductionStartup({
      ...base,
      PLATFORM_V7_LAB_REPOSITORY: mode,
    })).toThrow(IndustrialStartupError);
  });
});
