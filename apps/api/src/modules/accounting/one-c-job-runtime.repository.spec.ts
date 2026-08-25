import type { PrismaService } from '../../common/prisma/prisma.service';
import type { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { OneCCommand } from './one-c-connector.protocol';
import {
  OneCJobMachineOutcome,
  OneCJobRuntimeRepository,
} from './one-c-job-runtime.repository';
import type { OneCRuntimeRepository } from './one-c-runtime.repository';
import type { WorkTaskRepository } from './work-task.repository';

describe('1C durable job repository lease projection', () => {
  it('returns the database-authoritative payload hash needed by every receipt', async () => {
    const payloadHash = 'a'.repeat(64);
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{
        jobId: 'job-1',
        command: OneCCommand.GET_DOCUMENT_STATUS,
        payload: { documentId: 'document-1' },
        payloadHash,
        idempotencyKey: 'job-idempotency-1',
        correlationId: 'correlation-1',
        organizationId: 'organization-1',
        connectionId: 'connection-1',
        revision: 7n,
        attempt: 2,
        leaseBearer: `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.${'b'.repeat(43)}`,
        leaseExpiresAt: new Date('2026-08-25T04:00:00.000Z'),
      }]),
    } as unknown as PrismaService;
    const runtime = {
      authenticateMachineBearer: jest.fn().mockResolvedValue({
        authorized: true,
        credentialId: 'credential-1',
      }),
    } as unknown as OneCRuntimeRepository;
    const repository = new OneCJobRuntimeRepository(
      prisma,
      {} as RlsTransactionService,
      {} as WorkTaskRepository,
      runtime,
    );

    const leased = await repository.leaseJobs(
      `11111111-2222-4333-8444-555555555555.${'a'.repeat(43)}`,
      1,
      'correlation-lease-1',
      new Date('2026-08-25T03:59:00.000Z'),
    );

    expect(leased.outcome).toBe(OneCJobMachineOutcome.LEASED);
    if (!('jobs' in leased)) throw new Error('jobs were not returned');
    expect(leased.jobs).toHaveLength(1);
    expect(leased.jobs[0]).toMatchObject({
      id: 'job-1',
      payloadHash,
      revision: 7,
      attempt: 2,
    });
  });
});
