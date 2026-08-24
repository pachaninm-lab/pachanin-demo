import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PUBLIC_ROUTE } from '../../common/decorators/public.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import {
  OneCConnectorJobController,
  OneCJobManagementController,
} from './one-c-job-runtime.controller';
import { OneCJobRuntimeRepository } from './one-c-job-runtime.repository';

const MACHINE = `11111111-2222-4333-8444-555555555555.${'a'.repeat(43)}`;
const LEASE = `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.${'b'.repeat(43)}`;

describe('1C durable job HTTP boundary', () => {
  function fixture() {
    const repository = {
      leaseJobs: jest.fn(), acknowledge: jest.fn(), complete: jest.fn(), fail: jest.fn(),
      describeJobs: jest.fn(), reconcile: jest.fn(),
    } as unknown as OneCJobRuntimeRepository;
    return {
      repository,
      machine: new OneCConnectorJobController(repository),
      human: new OneCJobManagementController(repository),
    };
  }

  it('marks only machine pull/report handlers public and capability-gates human routes', () => {
    for (const method of ['lease', 'acknowledge', 'complete', 'fail'] as const) {
      expect(Reflect.getMetadata(PUBLIC_ROUTE, OneCConnectorJobController.prototype[method])).toBe(true);
    }
    expect(Reflect.getMetadata(PUBLIC_ROUTE, OneCJobManagementController.prototype.list)).not.toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, OneCJobManagementController)).toContain('GUEST');
  });

  it('collapses every repository machine-auth denial to one HTTP code', async () => {
    const test = fixture();
    (test.repository.leaseJobs as jest.Mock).mockResolvedValue({
      outcome: 'UNAUTHORIZED', reason: 'SECRET_MISMATCH',
    });
    const promise = test.machine.lease(`Bearer ${MACHINE}`, undefined, 'corr-1');
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(promise).rejects.toMatchObject({ response: { code: 'ONE_C_MACHINE_AUTH_REQUIRED' } });
  });

  it('refuses extra result fields that could recreate arbitrary RPC', async () => {
    const test = fixture();
    await expect(test.machine.complete(
      'one-c-job-1', `Bearer ${MACHINE}`, `Bearer ${LEASE}`,
      {
        idempotencyKey: 'result-1', payloadHash: 'a'.repeat(64), revision: 1,
        attempt: 1, resultState: 'CREATED_IN_1C', resultCode: 'ONE_C_CREATED',
        externalEvidenceId: 'one-c-guid-1', procedure: 'ExecuteAnything',
      }, 'corr-2',
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(test.repository.complete).not.toHaveBeenCalled();
  });
});
