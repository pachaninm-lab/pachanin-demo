import { Inject, Injectable } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import { CollectSampleDto } from './dto/collect-sample.dto';
import { CreateSampleDto } from './dto/create-sample.dto';
import { FinalizeSampleDto } from './dto/finalize-sample.dto';
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

  create(dto: CreateSampleDto, user: RequestUser) {
    return this.labs.create(dto, user);
  }

  collect(id: string, dto: CollectSampleDto, user: RequestUser) {
    return this.labs.collect(id, dto, user);
  }

  recordTest(id: string, dto: RecordTestDto, user: RequestUser) {
    return this.labs.recordTest(id, dto, user);
  }

  finalize(id: string, dto: FinalizeSampleDto, user: RequestUser) {
    return this.labs.finalize(id, dto, user);
  }
}
