import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { StaffAccessContext } from '../staff-access/staff-access.types';
import { RoleEligibilityService } from './role-eligibility.service';
import type { RoleEligibilityCandidate } from './role-eligibility.types';

const candidate: RoleEligibilityCandidate = {
  applicationId: 'app-tenant-a',
  applicationVersion: 2n,
  applicationStatus: 'ORGANIZATION_VERIFICATION_PENDING',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  requestedWorkspace: 'buyer',
  requestedRole: 'BUYER',
  inn: '7707083893',
  ogrn: '1027700132195',
  kpp: '773601001',
  legalName: 'ООО Tenant A',
  submittedAt: new Date('2026-09-02T00:00:00Z'),
};

const access = (tenantId: string | null, organizationId: string | null): StaffAccessContext => ({
  accessSessionId: 'staff-session',
  grantId: 'grant',
  actorUserId: 'staff-user',
  staffRole: 'PLATFORM_ADMIN',
  accessMode: 'CONTROL_PLANE',
  permissions: ['staff-request:read', 'staff-request:approve'],
  effectiveTenantId: tenantId,
  effectiveOrganizationId: organizationId,
  effectiveUserId: null,
  effectiveRole: null,
  reason: 'eligibility review',
  ticketId: 'ticket',
  expiresAt: new Date('2030-01-01T00:00:00Z'),
} as StaffAccessContext);

const IDEMPOTENCY_KEY = 'manual-recheck-00000001';

describe('RoleEligibilityService tenant and recheck boundary', () => {
  const repository = {
    readCandidate: jest.fn(),
    latestCheck: jest.fn(),
    evidenceForCheck: jest.fn(),
    activeGenerationFingerprint: jest.fn(),
    createOrGetCheck: jest.fn(),
  };
  const service = new RoleEligibilityService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.readCandidate.mockResolvedValue(candidate);
    repository.latestCheck.mockResolvedValue(null);
    repository.evidenceForCheck.mockResolvedValue([]);
    repository.activeGenerationFingerprint.mockResolvedValue('f'.repeat(64));
    repository.createOrGetCheck.mockResolvedValue({
      id: 'check-1',
      status: 'PENDING',
      policyVersion: 'p1',
      policyHash: 'a'.repeat(64),
      correlationId: 'corr',
    });
    process.env.ROLE_ELIGIBILITY_ENABLED = 'true';
    process.env.ROLE_ELIGIBILITY_SHADOW_MODE = 'true';
    process.env.ROLE_ELIGIBILITY_ENFORCEMENT = 'false';
  });

  it('denies a reviewer scoped to another tenant before eligibility data is returned', async () => {
    await expect(service.application(candidate.applicationId, access('tenant-b', null)))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.latestCheck).not.toHaveBeenCalled();
  });

  it('denies a reviewer scoped to another organization in the same tenant', async () => {
    await expect(service.evidence(candidate.applicationId, access('tenant-a', 'org-b')))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.evidenceForCheck).not.toHaveBeenCalled();
  });

  it('denies cross-tenant manual recheck before a check is created', async () => {
    await expect(service.recheck(candidate.applicationId, access('tenant-b', null), IDEMPOTENCY_KEY, 'corr-cross-tenant'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createOrGetCheck).not.toHaveBeenCalled();
  });

  it('requires an explicit manual recheck idempotency key', async () => {
    await expect(service.recheck(candidate.applicationId, access('tenant-a', 'org-a'), '', 'corr-missing-key'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createOrGetCheck).not.toHaveBeenCalled();
  });

  it('creates a manual history-producing request discriminator without storing the raw key', async () => {
    const result = await service.recheck(candidate.applicationId, access('tenant-a', 'org-a'), IDEMPOTENCY_KEY, 'corr-ok');
    expect(result.accepted).toBe(true);
    expect(result.enforcement).toBe(false);
    expect(repository.createOrGetCheck).toHaveBeenCalledTimes(1);
    const args = repository.createOrGetCheck.mock.calls[0];
    expect(args[5]).toMatch(/^manual:[0-9a-f]{64}$/);
    expect(args[5]).not.toContain(IDEMPOTENCY_KEY);
  });

  it('fails closed if enforcement is accidentally requested', async () => {
    process.env.ROLE_ELIGIBILITY_ENFORCEMENT = 'true';
    await expect(service.recheck(candidate.applicationId, access('tenant-a', 'org-a'), IDEMPOTENCY_KEY, 'corr-enforcement'))
      .rejects.toMatchObject({ response: { code: 'ROLE_ELIGIBILITY_ENFORCEMENT_UNSUPPORTED_IN_SHADOW_RELEASE' } });
    expect(repository.createOrGetCheck).not.toHaveBeenCalled();
  });
});
