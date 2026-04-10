import { Injectable } from '@nestjs/common';
import { CreateSampleDto } from './dto/create-sample.dto';
import { RecordTestDto } from './dto/record-test.dto';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

@Injectable()
export class LabsService {
  constructor(private readonly runtime: RuntimeCoreService) {}

  list(_user: any) {
    return this.runtime.listSamples();
  }

  getOne(id: string, _user: any) {
    return this.runtime.getSample(id);
  }

  create(dto: CreateSampleDto, user: any) {
    return this.runtime.createSample(dto, user);
  }

  collect(id: string, user: any) {
    return this.runtime.collectSample(id, user);
  }

  recordTest(id: string, dto: RecordTestDto, user: any) {
    return this.runtime.recordTest(id, dto, user);
  }

  finalize(id: string, user: any) {
    return this.runtime.finalizeSample(id, user);
  }
}
