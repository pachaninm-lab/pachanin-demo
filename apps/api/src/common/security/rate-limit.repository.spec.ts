import { PrismaService } from '../prisma/prisma.service';
import { RateLimitRepository } from './rate-limit.repository';

describe('RateLimitRepository execution boundary', () => {
  const safe = {
    current_user: 'app_api',
    state_table_ready: true,
    legacy_table_ready: true,
    consume_ready: true,
    schema_usage: true,
    can_execute_consume: true,
    can_select_state: false,
    can_insert_state: false,
    can_update_state: false,
    can_delete_state: false,
    can_select_legacy: false,
    can_insert_legacy: false,
    can_update_legacy: false,
    can_delete_legacy: false,
  };

  it('accepts function execution without direct table privileges', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([safe]) } as unknown as PrismaService;
    const repository = new RateLimitRepository(prisma);
    await expect(repository.verifyReadiness()).resolves.toEqual(safe);
  });

  it.each([
    'can_select_state',
    'can_insert_state',
    'can_update_state',
    'can_delete_state',
    'can_select_legacy',
    'can_insert_legacy',
    'can_update_legacy',
    'can_delete_legacy',
  ] as const)('rejects runtime direct table privilege %s', async (privilege) => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ ...safe, [privilege]: true }]),
    } as unknown as PrismaService;
    await expect(new RateLimitRepository(prisma).verifyReadiness())
      .rejects.toThrow(/execution boundary is invalid/i);
  });

  it('rejects a missing function privilege or inaccessible schema', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{
        ...safe,
        schema_usage: false,
        can_execute_consume: false,
      }]),
    } as unknown as PrismaService;
    await expect(new RateLimitRepository(prisma).verifyReadiness())
      .rejects.toThrow(/execution boundary is invalid/i);
  });

  it('normalizes SQL permission errors at the startup boundary', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('permission denied for schema security')),
    } as unknown as PrismaService;
    await expect(new RateLimitRepository(prisma).verifyReadiness())
      .rejects.toThrow('Distributed rate-limit execution boundary is unavailable.');
  });
});
