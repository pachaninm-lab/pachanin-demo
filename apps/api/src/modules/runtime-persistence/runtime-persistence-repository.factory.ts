import {
  PLATFORM_V7_RUNTIME_PERSISTENCE_PRISMA_MODE,
  RuntimePersistenceRepository,
  RuntimePersistenceRepositoryUnavailableError,
} from './runtime-persistence.repository';
import {
  PrismaRuntimePersistenceRepository,
  RuntimePersistencePrismaClient,
} from './prisma-runtime-persistence.repository';

export interface RuntimePersistenceRepositoryFactoryInput {
  readonly mode?: string;
  readonly prisma?: RuntimePersistencePrismaClient;
}

export function createRuntimePersistenceRepository(
  input: RuntimePersistenceRepositoryFactoryInput,
): RuntimePersistenceRepository {
  if (input.mode !== PLATFORM_V7_RUNTIME_PERSISTENCE_PRISMA_MODE) {
    throw new RuntimePersistenceRepositoryUnavailableError(
      'Runtime persistence repository requires explicit prisma mode.',
    );
  }

  if (!input.prisma) {
    throw new RuntimePersistenceRepositoryUnavailableError(
      'Runtime persistence repository requires PrismaService.',
    );
  }

  return new PrismaRuntimePersistenceRepository(input.prisma);
}
