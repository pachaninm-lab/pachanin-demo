import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthService } from '../auth/auth.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { OutboxService } from '../../common/outbox/outbox.service';

function makeAuthService(): jest.Mocked<AuthService> {
  return {
    listUsers: jest.fn().mockReturnValue([
      {
        id: 'user-admin-001',
        email: 'admin@demo.ru',
        role: Role.ADMIN,
        orgId: 'org-demo-001',
        fullName: 'Demo Admin',
      },
      {
        id: 'user-farmer-001',
        email: 'farmer@demo.ru',
        role: Role.FARMER,
        orgId: 'org-farmer-001',
        fullName: 'Demo Farmer',
      },
    ]),
    updateUserRole: jest.fn().mockImplementation((id, role) => ({ id, role })),
    updateUserOrg: jest.fn().mockImplementation((id, orgId) => ({ id, orgId })),
  } as any;
}

function makeOutboxService(): jest.Mocked<OutboxService> {
  return {
    queueStats: jest.fn().mockResolvedValue({
      total: 7,
      pending: 2,
      processing: 1,
      sent: 1,
      confirmed: 2,
      deadLetter: 1,
      manualReview: 0,
    }),
    list: jest.fn().mockResolvedValue([
      {
        id: 'outbox-1',
        type: 'BANK_RESERVE_REQUEST',
        payload: {},
        status: 'DEAD_LETTER',
        maxRetries: 5,
        retryCount: 5,
        createdAt: '2026-07-15T12:00:00.000Z',
      },
    ]),
    redrive: jest.fn().mockResolvedValue({
      entry: {
        id: 'outbox-1',
        type: 'BANK_RESERVE_REQUEST',
        payload: {},
        status: 'PENDING',
        maxRetries: 5,
        retryCount: 0,
        createdAt: '2026-07-15T12:00:00.000Z',
      },
      redriveEventId: 'redrive-1',
      replayed: false,
    }),
  } as any;
}

const adminUser: RequestUser = {
  id: 'user-admin-001',
  email: 'admin@demo.ru',
  role: Role.ADMIN,
  orgId: 'org-demo-001',
};

describe('AdminController', () => {
  let ctrl: AdminController;
  let auth: jest.Mocked<AuthService>;
  let outbox: jest.Mocked<OutboxService>;
  let roleGrant: { grantRole: jest.Mock };
  const admin = { id: 'admin-1', role: Role.ADMIN } as any;

  beforeEach(() => {
    auth = makeAuthService();
    outbox = makeOutboxService();
    roleGrant = { grantRole: jest.fn().mockResolvedValue({ role: Role.LOGISTICIAN }) };
    ctrl = new AdminController(auth, outbox, roleGrant as any);
  });

  it('returns users without password hashes', () => {
    const result = ctrl.listUsers();
    expect(result).toHaveLength(2);
    for (const user of result) expect((user as any).passwordHash).toBeUndefined();
  });

  it('delegates role grants to the audited membership path and org updates to auth', () => {
    ctrl.updateRole('user-farmer-001', { role: Role.SUPPORT_MANAGER, reason: 'Назначение дежурного оператора смены.' }, admin);
    ctrl.updateOrg('user-farmer-001', { orgId: 'org-new' });
    expect(roleGrant.grantRole).toHaveBeenCalledWith(
      'user-farmer-001',
      Role.SUPPORT_MANAGER,
      'Назначение дежурного оператора смены.',
      admin,
    );
    expect(auth.updateUserOrg).toHaveBeenCalledWith('user-farmer-001', 'org-new');
  });

  it('returns durable PostgreSQL queue statistics and recent entries', async () => {
    await expect(ctrl.outboxStatus()).resolves.toEqual(
      expect.objectContaining({
        total: 7,
        pending: 2,
        processing: 1,
        deadLetter: 1,
        recentEntries: [expect.objectContaining({ id: 'outbox-1' })],
      }),
    );
    expect(outbox.queueStats).toHaveBeenCalledTimes(1);
    expect(outbox.list).toHaveBeenCalledWith(50);
  });

  it('redrives with the authenticated administrator, reason and idempotency key', async () => {
    await ctrl.requeueOutbox(
      'outbox-1',
      { reason: 'provider recovered', idempotencyKey: 'redrive-command-1' },
      adminUser,
    );
    expect(outbox.redrive).toHaveBeenCalledWith({
      entryId: 'outbox-1',
      actorUserId: 'user-admin-001',
      reason: 'provider recovered',
      idempotencyKey: 'redrive-command-1',
    });
  });

  it('maps missing and invalid redrive requests to explicit HTTP errors', async () => {
    outbox.redrive.mockRejectedValueOnce(new Error('Outbox entry missing not found'));
    await expect(
      ctrl.requeueOutbox('missing', { reason: 'retry', idempotencyKey: 'key-1' }, adminUser),
    ).rejects.toBeInstanceOf(NotFoundException);

    outbox.redrive.mockRejectedValueOnce(new Error('cannot be redriven from status SENT'));
    await expect(
      ctrl.requeueOutbox('outbox-1', { reason: 'retry', idempotencyKey: 'key-2' }, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns process status metadata', () => {
    const status = ctrl.systemStatus();
    expect(status.uptime).toBeGreaterThanOrEqual(0);
    expect(status.memoryMb).toBeGreaterThan(0);
    expect(status.timestamp).toBeDefined();
    expect(status.nodeVersion).toMatch(/^v\d+/);
  });
});
