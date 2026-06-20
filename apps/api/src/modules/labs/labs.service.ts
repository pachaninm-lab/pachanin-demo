import { Inject, Injectable } from '@nestjs/common';
import { CreateSampleDto } from './dto/create-sample.dto';
import { RecordTestDto } from './dto/record-test.dto';
import { LAB_REPOSITORY, type LabRepository } from './lab.repository';

@Injectable()
export class LabsService {
  constructor(
    @Inject(LAB_REPOSITORY) private readonly labs: LabRepository,
  ) {}

  async list(_user: any) {
    return this.labs.list();
  }

  async getOne(id: string, _user: any) {
    return this.labs.getById(id);
  }

  create(dto: CreateSampleDto, user: any) {
    return this.labs.create(dto, user);
  }

  collect(id: string, user: any) {
    return this.labs.collect(id, user);
  }

  recordTest(id: string, dto: RecordTestDto, user: any) {
    return this.labs.recordTest(id, dto, user);
  }

  finalize(id: string, user: any) {
    return this.labs.finalize(id, user);
  }
}
