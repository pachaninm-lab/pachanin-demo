import { Module, type Provider } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { selectRuntimePersistenceRepository } from './runtime-persistence-repository.factory';
import { RUNTIME_PERSISTENCE_REPOSITORY } from './runtime-persistence.repository';
import { RuntimePersistenceService } from './runtime-persistence.service';

const runtimePersistenceRepositoryProvider: Provider = {
  provide: RUNTIME_PERSISTENCE_REPOSITORY,
  useFactory: (prisma: PrismaService) => selectRuntimePersistenceRepository(prisma),
  inject: [PrismaService],
};

@Module({
  providers: [runtimePersistenceRepositoryProvider, RuntimePersistenceService],
  exports: [RUNTIME_PERSISTENCE_REPOSITORY, RuntimePersistenceService],
})
export class RuntimePersistenceModule {}
