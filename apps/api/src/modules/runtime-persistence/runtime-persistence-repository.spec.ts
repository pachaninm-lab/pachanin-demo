import {
  PLATFORM_V7_RUNTIME_PERSISTENCE_PRISMA_MODE,
  RuntimePersistenceRepositoryUnavailableError,
} from './runtime-persistence.repository';
import { createRuntimePersistenceRepository } from './runtime-persistence-repository.factory';
import type { RuntimePersistencePrismaClient } from './prisma-runtime-persistence.repository';

describe('runtime persistence repository factory', () => {
  const prisma = {
    $transaction: jest.fn(),
    dealWorkspaceRuntimeSnapshot: { findUnique: jest.fn() },
  } as unknown as RuntimePersistencePrismaClient;

  it('fails closed when mode is absent or unrelated', () => {
    expect(() => createRuntimePersistenceRepository({ prisma })).toThrow(
      RuntimePersistenceRepositoryUnavailableError,
    );
    expect(() => createRuntimePersistenceRepository({ mode: 'memory', prisma })).toThrow(
      RuntimePersistenceRepositoryUnavailableError,
    );
  });

  it('fails before any write when PrismaService is missing', () => {
    expect(() => createRuntimePersistenceRepository({
      mode: PLATFORM_V7_RUNTIME_PERSISTENCE_PRISMA_MODE,
    })).toThrow(RuntimePersistenceRepositoryUnavailableError);
  });

  it('activates only with exact prisma mode and a server-side client', () => {
    const repository = createRuntimePersistenceRepository({
      mode: PLATFORM_V7_RUNTIME_PERSISTENCE_PRISMA_MODE,
      prisma,
    });

    expect(repository).toBeDefined();
    expect(typeof repository.write).toBe('function');
    expect(typeof repository.findByIdempotencyKey).toBe('function');
  });
});
