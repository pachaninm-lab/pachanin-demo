import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DealRepository } from './deal.repository';
import { RuntimeDealRepository } from './runtime-deal.repository';
import { selectDealRepository } from './deal-repository.factory';

function makeRuntimeCore() {
  return {
    listDeals: jest.fn().mockReturnValue([{ id: 'D1' }]),
    getDeal: jest.fn().mockReturnValue({ id: 'D1' }),
    dealWorkspace: jest.fn().mockReturnValue({ id: 'WS' }),
    dealPassport: jest.fn().mockReturnValue({ id: 'PP' }),
    dealTimeline: jest.fn().mockReturnValue([{ id: 'T1' }]),
    createDeal: jest.fn().mockReturnValue({ id: 'D2' }),
  } as any;
}

function makePrismaRepository(): DealRepository {
  return {
    list: jest.fn(),
    getById: jest.fn(),
    workspace: jest.fn(),
    passport: jest.fn(),
    timeline: jest.fn(),
    create: jest.fn(),
  };
}

const USER = {
  id: 'u1',
  sessionId: 's1',
  orgId: 'o1',
  tenantId: 't1',
  role: 'FARMER',
} as any;

describe('RuntimeDealRepository explicit test adapter', () => {
  it('delegates only when a test profile explicitly constructs it', async () => {
    const runtime = makeRuntimeCore();
    const repository = new RuntimeDealRepository(runtime);

    await expect(repository.list(USER)).resolves.toEqual([{ id: 'D1' }]);
    await expect(repository.getById('D1', USER)).resolves.toEqual({ id: 'D1' });
    await expect(repository.workspace('D1', USER)).resolves.toEqual({ id: 'WS' });
    await expect(repository.passport('D1', USER)).resolves.toEqual({ id: 'PP' });
    await expect(repository.timeline('D1', USER)).resolves.toEqual([{ id: 'T1' }]);
    await expect(repository.create({} as any, USER)).resolves.toEqual({ id: 'D2' });
  });
});

describe('selectDealRepository fail-closed configuration', () => {
  const prisma = makePrismaRepository();
  const runtime = new RuntimeDealRepository(makeRuntimeCore());

  it('defaults to PostgreSQL when mode is absent', () => {
    expect(selectDealRepository(prisma, runtime, { mode: undefined, nodeEnv: 'production' })).toBe(prisma);
  });

  it('selects PostgreSQL for the explicit prisma mode', () => {
    expect(selectDealRepository(prisma, runtime, { mode: 'prisma', nodeEnv: 'production' })).toBe(prisma);
  });

  it('rejects RuntimeCore in production and ordinary development', () => {
    expect(() => selectDealRepository(prisma, runtime, {
      mode: 'runtime', nodeEnv: 'production', profile: 'demo',
    })).toThrow(/NODE_ENV=test/);
    expect(() => selectDealRepository(prisma, runtime, {
      mode: 'runtime', nodeEnv: 'development', profile: 'test',
    })).toThrow(/NODE_ENV=test/);
  });

  it('allows RuntimeCore only for an explicit test or demo profile under NODE_ENV=test', () => {
    expect(selectDealRepository(prisma, runtime, {
      mode: 'runtime', nodeEnv: 'test', profile: 'test',
    })).toBe(runtime);
    expect(selectDealRepository(prisma, runtime, {
      mode: 'runtime', nodeEnv: 'test', profile: 'demo',
    })).toBe(runtime);
  });

  it('fails startup selection for unknown values instead of falling back', () => {
    for (const mode of ['true', '1', 'memory', 'postgres', 'unknown']) {
      expect(() => selectDealRepository(prisma, runtime, { mode, nodeEnv: 'production' }))
        .toThrow(/Unknown PLATFORM_V7_DEAL_REPOSITORY/);
    }
  });
});

describe('production deal DI and route source gate', () => {
  const source = (file: string) => readFileSync(join(__dirname, file), 'utf8');
  const moduleSource = source('deals.module.ts');
  const serviceSource = source('deals.service.ts');
  const controllerSource = source('deals.controller.ts');
  const prismaSource = source('prisma-deal.repository.ts');

  it('binds the production repository directly to Prisma without legacy adapters', () => {
    expect(moduleSource).toContain('useExisting: PrismaDealRepository');
    expect(moduleSource).not.toContain('RuntimeCoreService');
    expect(moduleSource).not.toContain('RuntimeDealRepository');
    expect(moduleSource).not.toContain('selectDealRepository');
    expect(moduleSource).not.toContain('DealAutoService');
    expect(moduleSource).not.toContain('DealEventService');
    expect(moduleSource).not.toContain('OutboxModule');
  });

  it('keeps free-form transition unreachable from service and controller', () => {
    expect(serviceSource).not.toContain('transition(');
    expect(serviceSource).not.toContain('ActionExecutorService');
    expect(serviceSource).not.toContain('DealSagaService');
    expect(controllerSource).toContain('LEGACY_DEAL_TRANSITION_DISABLED');
    expect(controllerSource).toContain('GoneException');
    expect(controllerSource).not.toContain('this.deals.transition');
  });

  it('contains no unsupported Prisma repository methods or runtime fallback language', () => {
    expect(prismaSource).not.toContain('not supported');
    expect(prismaSource).not.toContain('RuntimeCore');
    expect(prismaSource).not.toContain('fallback');
    for (const method of ['async list(', 'async getById(', 'async workspace(', 'async passport(', 'async timeline(', 'async create(']) {
      expect(prismaSource).toContain(method);
    }
  });
});
