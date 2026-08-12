import { GUARDS_METADATA } from '@nestjs/common/constants';
import { STAFF_ACCESS_MODES_KEY } from './staff-access-modes.decorator';
import { StaffAccessController } from './staff-access.controller';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessMode, StaffPermission } from './staff-access.types';
import { STAFF_PERMISSIONS_KEY } from './staff-permissions.decorator';

describe('registration decision staff access session boundary', () => {
  const handler = StaffAccessController.prototype.registrationApplicationDecision;

  it('requires an active CONTROL_PLANE grant with STAFF_REQUEST_APPROVE', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([StaffAccessGuard]);
    expect(Reflect.getMetadata(STAFF_ACCESS_MODES_KEY, handler)).toEqual([
      StaffAccessMode.CONTROL_PLANE,
    ]);
    expect(Reflect.getMetadata(STAFF_PERMISSIONS_KEY, handler)).toEqual([
      StaffPermission.STAFF_REQUEST_APPROVE,
    ]);
  });

  it('retains the durable assignment ceiling and passes only locale to the queued decision notice', async () => {
    const access = {
      requirePermission: jest.fn().mockResolvedValue(undefined),
    };
    const registrationDecisions = {
      decide: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new StaffAccessController(
      access as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      registrationDecisions as never,
    );
    const user = { id: 'staff-reviewer' } as never;

    await controller.registrationApplicationDecision(
      { user } as never,
      'application-1',
      { decision: 'APPROVED', reason: 'verified', locale: 'en' } as never,
      'decision-idempotency-key-1',
      'correlation-1',
    );

    expect(access.requirePermission).toHaveBeenCalledWith(
      user,
      StaffPermission.STAFF_REQUEST_APPROVE,
    );
    expect(registrationDecisions.decide).toHaveBeenCalledWith(
      'application-1',
      'APPROVED',
      'verified',
      user,
      'decision-idempotency-key-1',
      'correlation-1',
      'en',
    );
  });
});
