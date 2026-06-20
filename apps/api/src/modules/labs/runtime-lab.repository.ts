import { Injectable } from '@nestjs/common';
import type { LabRepository } from './lab.repository';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

/**
 * Default lab repository adapter. Wraps the in-memory RuntimeCore lab methods
 * without changing behavior. Only active adapter in controlled-pilot.
 */
@Injectable()
export class RuntimeLabRepository implements LabRepository {
  constructor(private readonly runtime: RuntimeCoreService) {}

  async list(): Promise<any[]> {
    return this.runtime.listSamples();
  }

  async getById(id: string): Promise<any> {
    return this.runtime.getSample(id);
  }

  create(dto: any, user: any): any {
    return this.runtime.createSample(dto, user);
  }

  collect(id: string, user: any): any {
    return this.runtime.collectSample(id, user);
  }

  recordTest(id: string, dto: any, user: any): any {
    return this.runtime.recordTest(id, dto, user);
  }

  finalize(id: string, user: any): any {
    return this.runtime.finalizeSample(id, user);
  }
}
