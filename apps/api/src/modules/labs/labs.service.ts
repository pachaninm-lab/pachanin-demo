import { GoneException, Inject, Injectable } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import { CreateSampleDto } from './dto/create-sample.dto';
import { CollectSampleDto } from './dto/collect-sample.dto';
import { RecordCustodyDto } from './dto/record-custody.dto';
import { RecordTestDto } from './dto/record-test.dto';
import { LAB_REPOSITORY, type LabRepository } from './lab.repository';

@Injectable()
export class LabsService {
  constructor(
    @Inject(LAB_REPOSITORY) private readonly labs: LabRepository,
  ) {}

  list(user: RequestUser) {
    return this.labs.list(user);
  }

  getOne(id: string, user: RequestUser) {
    return this.labs.getById(id, user);
  }

  workspace(id: string, user: RequestUser) {
    return this.labs.workspace(id, user);
  }

  create(dto: CreateSampleDto, user: RequestUser) {
    return this.labs.create(dto, user);
  }

  collect(id: string, dto: CollectSampleDto, user: RequestUser) {
    return this.labs.collect(id, dto, user);
  }

  recordCustody(id: string, dto: RecordCustodyDto, user: RequestUser) {
    return this.labs.recordCustody(id, dto, user);
  }

  recordTest(id: string, dto: RecordTestDto, user: RequestUser) {
    return this.labs.recordTest(id, dto, user);
  }

  finalize(_id: string, _user: RequestUser): never {
    throw new GoneException({
      code: 'CANONICAL_DEAL_COMMAND_REQUIRED',
      capability: 'finalize_lab',
      message: 'Laboratory protocol finalization must execute through the canonical Deal command endpoint.',
    });
  }
}
