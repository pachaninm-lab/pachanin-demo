import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  RUNTIME_PERSISTENCE_REPOSITORY,
  type RuntimePersistenceRepository,
  type RuntimePersistenceWriteInput,
  type RuntimePersistenceWriteReceipt,
} from './runtime-persistence.repository';

@Injectable()
export class RuntimePersistenceService {
  constructor(
    @Inject(RUNTIME_PERSISTENCE_REPOSITORY)
    private readonly repository: RuntimePersistenceRepository,
  ) {}

  persist(input: RuntimePersistenceWriteInput): Promise<RuntimePersistenceWriteReceipt> {
    return this.repository.write(input);
  }

  persistWithinTransaction(
    tx: Prisma.TransactionClient,
    input: RuntimePersistenceWriteInput,
  ): Promise<RuntimePersistenceWriteReceipt> {
    return this.repository.writeWithinTransaction(tx, input);
  }

  classifyExistingWithinTransaction(
    tx: Prisma.TransactionClient,
    input: RuntimePersistenceWriteInput,
  ): Promise<RuntimePersistenceWriteReceipt | null> {
    return this.repository.classifyExistingWithinTransaction(tx, input);
  }
}
