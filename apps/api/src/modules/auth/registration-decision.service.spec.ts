import { ForbiddenException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import { RegistrationDecisionService } from './registration-decision.service';

const REVIEWER: RequestUser = {
  id: 'reviewer-user',
  email: 'reviewer@example.test',
  role: Role.ADMIN,
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'reviewer-membership',
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

function createService() {
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
  const repository = {};
  return {
    service: new RegistrationDecisionService(prisma as never, repository as never),
    prisma,
  };
}

describe('platform registration reviewer boundary', () => {
  it('rejects a client organization ADMIN without a durable staff assignment', async () => {
    const { service, prisma } = createService();

    await expect(service.listPlatformReviewQueue(REVIEWER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it.each(['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF'])('accepts the assigned %s reviewer', async (staffRole) => {
    const { service, prisma } = createService();

    await expect(service.listPlatformReviewQueue({ ...REVIEWER, staffRoles: [staffRole] })).resolves.toEqual({ applications: [] });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('still rejects assigned reviewers without fresh MFA', async () => {
    const { service, prisma } = createService();

    await expect(service.listPlatformReviewQueue({
      ...REVIEWER,
      staffRoles: ['PLATFORM_OWNER'],
      mfaVerified: false,
      mfaVerifiedAt: undefined,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('refuses activation when the stored role does not match the canonical public workspace mapping', async () => {
    const { service } = createService();
    const tx = { $executeRaw: jest.fn() };
    const approve = (service as unknown as {
      approve: (...args: unknown[]) => Promise<void>;
    }).approve.bind(service);

    await expect(approve(
      tx,
      {
        id: 'application-1',
        kind: 'NEW_ORGANIZATION',
        user_id: 'applicant-1',
        organization_id: 'organization-1',
        membership_id: 'membership-1',
        requested_workspace: 'seller',
        requested_role: Role.ADMIN,
        status: 'ORGANIZATION_VERIFICATION_PENDING',
        version: 1n,
        correlation_id: 'correlation-1',
        organization_status: 'PENDING',
        tenant_id: 'tenant-1',
      },
      REVIEWER,
      'Verified organization details',
      'idempotency-decision-0001',
      'correlation-1',
      'PLATFORM_REVIEWER',
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('cannot decide an existing-organization join through the platform reviewer endpoint', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          id: 'join-application-1', kind: 'JOIN_EXISTING_ORGANIZATION', user_id: 'applicant-1',
          organization_id: 'organization-1', membership_id: 'membership-1', requested_workspace: 'buyer',
          requested_role: Role.BUYER, status: 'ORGANIZATION_VERIFICATION_PENDING', version: 1n,
          correlation_id: 'correlation-1', organization_status: 'VERIFIED', tenant_id: 'tenant-1',
        }]),
    };
    const prisma = {
      $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const service = new RegistrationDecisionService(prisma as never, {} as never);

    await expect(service.decide(
      'join-application-1', 'APPROVE', 'Verified organization join request',
      { ...REVIEWER, staffRoles: ['PLATFORM_OWNER'] }, 'idempotency-decision-join-0001', 'correlation-1',
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
