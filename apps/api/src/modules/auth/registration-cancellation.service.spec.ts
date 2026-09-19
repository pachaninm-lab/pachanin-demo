import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Role, type RequestUser } from '../../common/types/request-user';
import { RegistrationCancellationService } from './registration-cancellation.service';

const OWNER: RequestUser = {
  id: 'owner-user',
  email: 'owner@example.test',
  role: Role.ADMIN,
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'owner-membership',
  sessionId: 'owner-session',
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
  staffRoles: ['PLATFORM_OWNER'],
};

function repositoryMock() {
  return {
    latestAuditChainPosition: jest.fn().mockResolvedValue({
      chainKey: 'auth-global',
      prevHash: null,
      nextSequence: 1n,
    }),
    insertAudit: jest.fn().mockResolvedValue(undefined),
  };
}

function successfulTransaction(status = 'ORGANIZATION_VERIFICATION_PENDING') {
  const tx = {
    $queryRaw: jest.fn()
      .mockResolvedValueOnce([{ authorized: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'application-1', status, version: 4n }])
      .mockResolvedValueOnce([{
        status: 'CANCELLED',
        version: 5n,
        decision_actor_user_id: OWNER.id,
        pending_challenges: 0n,
        event_count: 1n,
      }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const prisma = {
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  return { tx, prisma };
}

function serviceSource(): string {
  const relative = 'apps/api/src/modules/auth/registration-cancellation.service.ts';
  const candidates = [path.resolve(process.cwd(), relative), path.resolve(process.cwd(), '../..', relative)];
  const source = candidates.find(existsSync);
  if (!source) throw new Error(`Missing registration cancellation service: ${relative}`);
  return readFileSync(source, 'utf8');
}

describe('owner registration application cancellation', () => {
  it('cancels atomically for PLATFORM_OWNER with fresh MFA and records evidence', async () => {
    const { tx, prisma } = successfulTransaction();
    const repository = repositoryMock();
    const service = new RegistrationCancellationService(prisma as never, repository as never);

    await expect(service.cancel(
      'application-1',
      'Удалено владельцем из очереди',
      OWNER,
      'owner-cancel-idempotency-0001',
      'correlation-owner-cancel-1',
    )).resolves.toEqual({ applicationId: 'application-1', status: 'CANCELLED', replayed: false });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
    const applicationSql = (tx.$executeRaw.mock.calls[0][0] as { strings: readonly string[] }).strings.join(' ');
    const challengeSql = (tx.$executeRaw.mock.calls[1][0] as { strings: readonly string[] }).strings.join(' ');
    const eventSql = (tx.$executeRaw.mock.calls[2][0] as { strings: readonly string[] }).strings.join(' ');
    expect(applicationSql).toContain('UPDATE auth.registration_applications');
    expect(applicationSql).toContain("status = 'CANCELLED'");
    expect(applicationSql).toContain('AND version =');
    expect(challengeSql).toContain('UPDATE auth.registration_email_challenges');
    expect(challengeSql).toContain("status = 'REVOKED'");
    expect(challengeSql).toContain("status = 'PENDING'");
    expect(eventSql).toContain('INSERT INTO auth.registration_application_events');
    expect(eventSql).toContain("'PLATFORM_REVIEWER'");
    expect(eventSql).toContain("'OWNER_CANCELLED_APPLICATION'");
    expect(repository.insertAudit).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'auth.registration.application.cancel',
      outcome: 'SUCCESS',
      reason: 'OWNER_CANCELLED_APPLICATION',
    }));
  });

  it('rejects a non-owner before any database mutation', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new RegistrationCancellationService(prisma as never, repositoryMock() as never);
    await expect(service.cancel(
      'application-1',
      'Удалено владельцем из очереди',
      { ...OWNER, staffRoles: ['PLATFORM_ADMIN'] },
      'owner-cancel-idempotency-0002',
      'correlation-2',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects stale or missing MFA before any database mutation', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new RegistrationCancellationService(prisma as never, repositoryMock() as never);
    await expect(service.cancel(
      'application-1',
      'Удалено владельцем из очереди',
      { ...OWNER, mfaVerified: false, mfaVerifiedAt: undefined },
      'owner-cancel-idempotency-0003',
      'correlation-3',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires the correlation header before opening a transaction', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new RegistrationCancellationService(prisma as never, repositoryMock() as never);
    await expect(service.cancel(
      'application-1',
      'Удалено владельцем из очереди',
      OWNER,
      'owner-cancel-idempotency-0006',
      '',
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed for ACTIVATED applications', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ authorized: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'application-1', status: 'ACTIVATED', version: 8n }]),
      $executeRaw: jest.fn(),
    };
    const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
    const service = new RegistrationCancellationService(prisma as never, repositoryMock() as never);
    await expect(service.cancel(
      'application-1',
      'Удалено владельцем из очереди',
      OWNER,
      'owner-cancel-idempotency-0004',
      'correlation-4',
    )).rejects.toBeInstanceOf(ConflictException);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('replays the same idempotency key without a second mutation', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ authorized: true }])
        .mockResolvedValueOnce([{ application_id: 'application-1', new_status: 'CANCELLED' }])
        .mockResolvedValueOnce([{ id: 'application-1', status: 'CANCELLED' }]),
      $executeRaw: jest.fn(),
    };
    const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
    const service = new RegistrationCancellationService(prisma as never, repositoryMock() as never);
    await expect(service.cancel(
      'application-1',
      'Удалено владельцем из очереди',
      OWNER,
      'owner-cancel-idempotency-0005',
      'correlation-5',
    )).resolves.toEqual({ applicationId: 'application-1', status: 'CANCELLED', replayed: true });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('contains no physical DELETE and scopes every mutation to the target application', () => {
    const source = serviceSource();
    expect(source).not.toMatch(/DELETE\s+FROM\s+(?:auth\.registration_applications|public\.users|public\.organizations|public\.user_orgs|auth\.registration_application_events)/i);
    expect(source).toContain('WHERE id = ${application.id}');
    expect(source).toContain('WHERE application_id = ${application.id}');
    expect(source).toContain('SELECT id, status, version');
    expect(source).toContain('FOR UPDATE');
    expect(source).toContain('auth.registration_platform_actor_authorized');
    expect(source).toContain("assignment.role = 'PLATFORM_OWNER'");
  });
});
