import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { selectRuntimePersistenceRepository } from './runtime-persistence-repository.factory';
import { RUNTIME_PERSISTENCE_REPOSITORY } from './runtime-persistence.repository';
import { RuntimePersistenceService } from './runtime-persistence.service';

@Module({
  imports: [PrismaModule],
  providers: [
    RuntimePersistenceService,
    {
      provide: RUNTIME_PERSISTENCE_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => selectRuntimePersistenceRepository(prisma),
    },
  ],
  exports: [RuntimePersistenceService, RUNTIME_PERSISTENCE_REPOSITORY],
})
export class RuntimePersistenceModule {}
