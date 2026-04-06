import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSampleDto } from './dto/create-sample.dto';
import { RecordTestDto } from './dto/record-test.dto';

const SAMPLES_SEED = [
  {
    id: 'SAMPLE-001',
    dealId: 'DEAL-001',
    shipmentId: 'SHIP-001',
    status: 'ANALYZED',
    collectedAt: '2026-03-30T08:00:00Z',
    culture: 'wheat',
    tests: [
      { id: 'T-001', parameter: 'moisture', value: 15.2, unit: '%', norm: '<=13', passed: false, recordedAt: '2026-03-30T10:00:00Z' },
      { id: 'T-002', parameter: 'protein', value: 12.1, unit: '%', norm: '>=11', passed: true, recordedAt: '2026-03-30T10:30:00Z' },
    ],
    protocol: 'PROT-001',
    finalizedAt: '2026-03-30T12:00:00Z',
    labId: 'prov-lab-1',
  },
  {
    id: 'SAMPLE-002',
    dealId: 'DEAL-002',
    status: 'COLLECTED',
    collectedAt: '2026-04-02T09:00:00Z',
    culture: 'corn',
    tests: [],
    labId: 'prov-lab-1',
  },
  {
    id: 'SAMPLE-003',
    dealId: 'DEAL-003',
    status: 'PENDING',
    culture: 'barley',
    tests: [],
  },
];

@Injectable()
export class LabsService {
  private samples: any[] = SAMPLES_SEED.map((s) => ({ ...s, tests: [...s.tests] }));
  private testCounter = 100;
  private sampleCounter = 10;

  list(_user: any) {
    return this.samples;
  }

  getOne(id: string, _user: any) {
    const sample = this.samples.find((s) => s.id === id);
    if (!sample) throw new NotFoundException(`Sample ${id} not found`);
    return sample;
  }

  create(dto: CreateSampleDto, user: any) {
    const id = `SAMPLE-${String(++this.sampleCounter).padStart(3, '0')}`;
    const sample: any = {
      id,
      dealId: dto.dealId,
      shipmentId: dto.shipmentId ?? null,
      status: 'PENDING',
      culture: null,
      tests: [],
      createdAt: new Date().toISOString(),
      createdByUserId: user?.sub ?? user?.id ?? null,
    };
    if (dto.note) sample.note = dto.note;
    this.samples.push(sample);
    return sample;
  }

  collect(id: string, user: any) {
    const sample = this.getOne(id, user);
    sample.status = 'COLLECTED';
    sample.collectedAt = new Date().toISOString();
    return sample;
  }

  recordTest(id: string, dto: RecordTestDto, user: any) {
    const sample = this.getOne(id, user);
    const testId = `T-${String(++this.testCounter).padStart(3, '0')}`;
    const test: any = {
      id: testId,
      parameter: dto.metric,
      value: dto.value,
      unit: dto.unit ?? null,
      norm: null,
      passed: true,
      recordedAt: new Date().toISOString(),
      recordedByUserId: user?.sub ?? user?.id ?? null,
    };
    if (dto.note) test.note = dto.note;
    sample.tests.push(test);
    if (sample.status === 'COLLECTED') sample.status = 'ANALYSIS_IN_PROGRESS';
    return { sample, test };
  }

  finalize(id: string, user: any) {
    const sample = this.getOne(id, user);
    sample.status = 'FINALIZED';
    sample.finalizedAt = new Date().toISOString();
    sample.protocol = `PROT-${id}`;
    sample.finalizedByUserId = user?.sub ?? user?.id ?? null;
    return sample;
  }
}
