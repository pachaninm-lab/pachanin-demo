import { Inject, Injectable } from '@nestjs/common';
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

  write(input: RuntimePersistenceWriteInput): Promise<RuntimePersistenceWriteReceipt> {
    return this.repository.write(input);
  }
}
