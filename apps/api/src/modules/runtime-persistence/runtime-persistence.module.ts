import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { RuntimePersistenceCommandService } from './runtime-persistence-command.service';
import { selectRuntimePersistenceRepository } from './runtime-persistence-repository.factory';
import { RUNTIME_PERSISTENCE_REPOSITORY } from './runtime-persistence.repository';
import { RuntimePersistenceService } from './runtime-persistence.service';

@Module({
  imports: [PrismaModule],
  providers: [
    RuntimePersistenceService,
    RuntimePersistenceCommandService,
    {
      provide: RUNTIME_PERSISTENCE_REPOSITORY,
      inject: [RlsTransactionService],
      useFactory: (rls: RlsTransactionService) => selectRuntimePersistenceRepository(rls),
    },
  ],
  exports: [
    RuntimePersistenceService,
    RuntimePersistenceCommandService,
    RUNTIME_PERSISTENCE_REPOSITORY,
  ],
})
export class RuntimePersistenceModule {}
