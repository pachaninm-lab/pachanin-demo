import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import { StaffPermission } from '../staff-access/staff-access.types';
import type { StaffAccessService } from '../staff-access/staff-access.service';
import type { FounderControlRepository } from './founder-control.repository';
import { FounderControlService } from './founder-control.service';

function user(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'owner-user', tenantId: 'staff', orgId: 'platform', role: 'STAFF',
    authMethod: 'PASSWORD', sessionId: 'session-1', mfaVerified: true,
    mfaVerifiedAt: new Date().toISOString(),
    ...overrides,
  } as RequestUser;
}

describe('FounderControlService authority', () => {
  const repository = {
    list: jest.fn().mockResolvedValue([]),
    events: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue({ kind:'APPLIED', record:{} }),
  } as unknown as FounderControlRepository;
  const access = { requirePermission: jest.fn().mockResolvedValue(undefined) } as unknown as StaffAccessService;

  beforeEach(() => jest.clearAllMocks());

  it('requires the dedicated founder read permission even for a valid MFA session', async () => {
    const service = new FounderControlService(repository, access);
    await service.overview(user());
    expect((access.requirePermission as jest.Mock)).toHaveBeenCalledWith(expect.objectContaining({ id:'owner-user' }), StaffPermission.FOUNDER_CONTROL_READ);
  });

  it('fails closed on read without MFA before repository access', async () => {
    const service = new FounderControlService(repository, access);
    await expect(service.overview(user({ mfaVerified:false }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('requires fresh MFA and the dedicated write permission', async () => {
    const service = new FounderControlService(repository, access);
    await service.upsert(
      user(), 'CEO_INPUT', 'cashOnBankRub',
      { payload:{ value:1 }, reason:'test write', expectedVersion:'0', status:'ACTIVE', source:'TEST' },
      '0123456789abcdef', 'corr-1',
    );
    expect((access.requirePermission as jest.Mock)).toHaveBeenCalledWith(expect.anything(), StaffPermission.FOUNDER_CONTROL_WRITE);
    expect(repository.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects stale MFA before mutation reaches persistence', async () => {
    const service = new FounderControlService(repository, access);
    const stale = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    await expect(service.upsert(
      user({ mfaVerifiedAt: stale }), 'CEO_INPUT', 'cashOnBankRub',
      { payload:{ value:1 }, reason:'test write', expectedVersion:'0', status:'ACTIVE', source:'TEST' },
      '0123456789abcdef', 'corr-1',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.upsert).not.toHaveBeenCalled();
  });
});
