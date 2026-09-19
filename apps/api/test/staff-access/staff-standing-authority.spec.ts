import { NotFoundException } from '@nestjs/common';
import { Role, RequestUser } from '../../src/common/types/request-user';
import { StaffAccessService } from '../../src/modules/staff-access/staff-access.service';
import { StaffRole } from '../../src/modules/staff-access/staff-access.types';

const actor: RequestUser = {
  id: 'staff-owner',
  email: 'owner@example.test',
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'membership-owner',
  role: Role.ADMIN,
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

function session(id: string, actorUserId: string) {
  return {
    id,
    actor_user_id: actorUserId,
    staff_role: StaffRole.PLATFORM_OWNER,
    grant_id: `grant-${id}`,
    ticket_id: `ticket-${id}`,
  };
}

function fixture(activeSessions: unknown[] = []) {
  const prisma = {};
  const repository = {
    prisma,
    listActiveAssignments: jest.fn().mockResolvedValue([{
      id: 'assignment-owner',
      role: StaffRole.PLATFORM_OWNER,
    }]),
    listAccessRequests: jest.fn().mockResolvedValue([]),
    listActiveSessions: jest.fn().mockImplementation(async (_client, userId?: string) => {
      if (!userId) return activeSessions;
      return activeSessions.filter((value: any) => value.actor_user_id === userId);
    }),
    endAccessSession: jest.fn().mockResolvedValue(true),
    transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(prisma)),
    latestEventHash: jest.fn().mockResolvedValue(null),
    insertEvent: jest.fn().mockResolvedValue(undefined),
  } as any;
  return { service: new StaffAccessService(repository), repository, prisma };
}

describe('StaffAccessService standing authority boundary', () => {
  it('returns only the actor own access requests without a time-bound review session', async () => {
    const { service, repository, prisma } = fixture();
    await service.listRequests(actor);
    expect(repository.listAccessRequests).toHaveBeenCalledWith(prisma, actor.id, false);
  });

  it('keeps the ordinary session list actor-owned even for PLATFORM_OWNER', async () => {
    const { service, repository, prisma } = fixture([
      session('own-session', actor.id),
      session('other-session', 'other-staff'),
    ]);
    await service.listActiveSessions(actor);
    expect(repository.listActiveSessions).toHaveBeenCalledWith(prisma, actor.id);
  });

  it('does not let a standing PLATFORM_OWNER assignment end another actor session', async () => {
    const { service, repository } = fixture([
      session('own-session', actor.id),
      session('other-session', 'other-staff'),
    ]);
    await expect(service.endSession(actor, 'other-session')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.endAccessSession).not.toHaveBeenCalled();
  });

  it('exposes global request and session review only through separate privileged methods', async () => {
    const { service, repository, prisma } = fixture([
      session('own-session', actor.id),
      session('other-session', 'other-staff'),
    ]);
    await service.listReviewRequests(actor);
    await service.listAllActiveSessions(actor);
    expect(repository.listAccessRequests).toHaveBeenCalledWith(prisma, actor.id, true);
    expect(repository.listActiveSessions).toHaveBeenCalledWith(prisma);
  });

  it('revokes another actor session only through the explicit privileged method', async () => {
    const target = session('other-session', 'other-staff');
    const { service, repository, prisma } = fixture([target]);
    await expect(service.revokeSession(actor, target.id, 'Security revocation', 'corr-1')).resolves.toEqual({
      success: true,
      sessionId: target.id,
    });
    expect(repository.endAccessSession).toHaveBeenCalledWith(
      prisma,
      target.id,
      target.actor_user_id,
      'Security revocation',
    );
  });
});
