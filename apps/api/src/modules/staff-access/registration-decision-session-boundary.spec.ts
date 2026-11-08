import { GUARDS_METADATA } from '@nestjs/common/constants';
import { STAFF_ACCESS_MODES_KEY } from './staff-access-modes.decorator';
import { StaffAccessController } from './staff-access.controller';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessMode, StaffPermission } from './staff-access.types';
import { STAFF_PERMISSIONS_KEY } from './staff-permissions.decorator';

describe('registration review staff access session boundary', () => {
  const listHandler = StaffAccessController.prototype.registrationApplications;
  const decisionHandler = StaffAccessController.prototype.registrationApplicationDecision;

  it('requires an active CONTROL_PLANE grant with STAFF_REQUEST_READ for the cross-user queue', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, listHandler)).toEqual([StaffAccessGuard]);
    expect(Reflect.getMetadata(STAFF_ACCESS_MODES_KEY, listHandler)).toEqual([
      StaffAccessMode.CONTROL_PLANE,
    ]);
    expect(Reflect.getMetadata(STAFF_PERMISSIONS_KEY, listHandler)).toEqual([
      StaffPermission.STAFF_REQUEST_READ,
    ]);
  });

  it('requires an active CONTROL_PLANE grant with STAFF_REQUEST_APPROVE for decisions', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, decisionHandler)).toEqual([StaffAccessGuard]);
    expect(Reflect.getMetadata(STAFF_ACCESS_MODES_KEY, decisionHandler)).toEqual([
      StaffAccessMode.CONTROL_PLANE,
    ]);
    expect(Reflect.getMetadata(STAFF_PERMISSIONS_KEY, decisionHandler)).toEqual([
      StaffPermission.STAFF_REQUEST_APPROVE,
    ]);
  });

  it('retains the durable assignment ceiling before reading the queue', async () => {
    const access = {
      requirePermission: jest.fn().mockResolvedValue(undefined),
    };
    const registrationDecisions = {
      listPlatformReviewQueue: jest.fn().mockResolvedValue([{ id: 'application-1' }]),
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

    await controller.registrationApplications({ user } as never);

    expect(access.requirePermission).toHaveBeenCalledWith(
      user,
      StaffPermission.STAFF_REQUEST_READ,
    );
    expect(registrationDecisions.listPlatformReviewQueue).toHaveBeenCalledWith(user);
  });

  it('retains the durable assignment ceiling before executing the decision', async () => {
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
      { decision: 'APPROVED', reason: 'verified' } as never,
      'decision-idempotency-key-1',
      'correlation-1',
      'delivery-key-1',
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
      'delivery-key-1',
    );
  });
});
