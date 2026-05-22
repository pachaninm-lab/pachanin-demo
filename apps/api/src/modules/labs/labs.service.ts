import { Injectable, Optional } from '@nestjs/common';
import { CreateSampleDto } from './dto/create-sample.dto';
import { RecordTestDto } from './dto/record-test.dto';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LabsService {
  constructor(
    private readonly runtime: RuntimeCoreService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async list(_user: any) {
    if (this.prisma) {
      try {
        const rows = await this.prisma.labSample.findMany({
          include: { tests: true },
          orderBy: { createdAt: 'desc' },
        });
        if (rows.length > 0) return rows;
      } catch { /* fall through */ }
    }
    return this.runtime.listSamples();
  }

  async getOne(id: string, _user: any) {
    if (this.prisma) {
      try {
        const row = await this.prisma.labSample.findUnique({
          where: { id },
          include: { tests: true },
        });
        if (row) return row;
      } catch { /* fall through */ }
    }
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
