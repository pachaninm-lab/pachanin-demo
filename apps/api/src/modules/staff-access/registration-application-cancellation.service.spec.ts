import { ConflictException, ForbiddenException } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Role, type RequestUser } from '../../common/types/request-user';
import { RegistrationApplicationCancellationService } from './registration-application-cancellation.service';

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

const REASON = 'Удалено владельцем из очереди';
const IDEMPOTENCY_KEY = 'owner-cancel-idempotency-0001';
const CORRELATION_ID = 'owner-cancel-correlation-0001';

function sourceFile(): string {
  const relative = 'apps/api/src/modules/staff-access/registration-application-cancellation.service.ts';
  const candidates = [path.resolve(process.cwd(), relative), path.resolve(process.cwd(), '../..', relative)];
  const source = candidates.find(existsSync);
  if (!source) throw new Error(`Missing source: ${relative}`);
  return readFileSync(source, 'utf8');
}

function sqlText(call: unknown[]): string {
  const query = call[0] as { strings?: readonly string[] } | undefined;
  return query?.strings?.join('?') ?? String(call[0] ?? '');
}

function responseCode(error: unknown): string | undefined {
  if (!(error instanceof ConflictException) && !(error instanceof ForbiddenException)) return undefined;
  const response = error.getResponse();
  return typeof response === 'object' && response !== null && 'code' in response
    ? String((response as { code?: unknown }).code || '')
    : undefined;
}

function createRepository() {
  return {
    latestAuditChainPosition: jest.fn().mockResolvedValue({
      chainKey: 'owner-session',
      prevHash: null,
      nextSequence: 1n,
    }),
    insertAudit: jest.fn().mockResolvedValue(undefined),
  };
}

function createSuccessService() {
  const tx = {
    $queryRaw: jest.fn()
      .mockResolvedValueOnce([{ reviewer_authorized: true, owner_authorized: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'application-1', status: 'SUBMITTED', version: 3n }])
      .mockResolvedValueOnce([{
        status: 'CANCELLED',
        version: 4n,
        decided_at: new Date(),
        decision_reason: REASON,
        decision_actor_user_id: OWNER.id,
        pending_challenges: 0n,
        event_created: true,
        audit_created: true,
      }]),
    $executeRaw: jest.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1),
  };
  const prisma = {
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const repository = createRepository();
  return {
    service: new RegistrationApplicationCancellationService(prisma as never, repository as never),
    prisma,
    repository,
    tx,
  };
}

describe('RegistrationApplicationCancellationService', () => {
  it('cancels an eligible application for PLATFORM_OWNER with fresh MFA atomically', async () => {
    const { service, prisma, tx, repository } = createSuccessService();

    await expect(service.cancel(
      'application-1', REASON, OWNER, IDEMPOTENCY_KEY, CORRELATION_ID,
    )).resolves.toEqual({
      applicationId: 'application-1',
      status: 'CANCELLED',
      replayed: false,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
    expect(repository.insertAudit).toHaveBeenCalledTimes(1);
    expect(repository.insertAudit.mock.calls[0]?.[1]).toMatchObject({
      userId: OWNER.id,
      sessionId: OWNER.sessionId,
      action: 'auth.registration.application.cancel',
      outcome: 'SUCCESS',
      reason: 'OWNER_CANCELLED_APPLICATION',
    });
  });

  it('rejects a non-owner before opening a database transaction', async () => {
    const { service, prisma } = createSuccessService();
    const actor = { ...OWNER, staffRoles: ['PLATFORM_ADMIN'] };

    await expect(service.cancel(
      'application-1', REASON, actor, IDEMPOTENCY_KEY, CORRELATION_ID,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects PLATFORM_OWNER without fresh MFA before mutation', async () => {
    const { service, prisma } = createSuccessService();
    const actor = { ...OWNER, mfaVerified: false, mfaVerifiedAt: undefined };

    try {
      await service.cancel('application-1', REASON, actor, IDEMPOTENCY_KEY, CORRELATION_ID);
      throw new Error('expected FRESH_MFA_REQUIRED');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(responseCode(error)).toBe('FRESH_MFA_REQUIRED');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed for ACTIVATED and performs no mutation', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ reviewer_authorized: true, owner_authorized: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'application-1', status: 'ACTIVATED', version: 9n }]),
      $executeRaw: jest.fn(),
    };
    const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
    const repository = createRepository();
    const service = new RegistrationApplicationCancellationService(prisma as never, repository as never);

    try {
      await service.cancel('application-1', REASON, OWNER, IDEMPOTENCY_KEY, CORRELATION_ID);
      throw new Error('expected APPLICATION_ALREADY_ACTIVATED');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect(responseCode(error)).toBe('APPLICATION_ALREADY_ACTIVATED');
    }
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(repository.insertAudit).not.toHaveBeenCalled();
  });

  it('revokes only PENDING email challenges and inserts the cancellation event', async () => {
    const { service, tx } = createSuccessService();
    await service.cancel('application-1', REASON, OWNER, IDEMPOTENCY_KEY, CORRELATION_ID);

    const challengeUpdate = sqlText(tx.$executeRaw.mock.calls[1] as unknown[]);
    expect(challengeUpdate).toContain('UPDATE auth.registration_email_challenges');
    expect(challengeUpdate).toContain("SET status = 'REVOKED'");
    expect(challengeUpdate).toContain("status = 'PENDING'");
    expect(challengeUpdate).toContain('WHERE application_id =');

    const eventInsert = sqlText(tx.$executeRaw.mock.calls[2] as unknown[]);
    expect(eventInsert).toContain('INSERT INTO auth.registration_application_events');
    expect(eventInsert).toContain("'PLATFORM_REVIEWER'");
    expect(eventInsert).toContain("'OWNER_CANCELLED_APPLICATION'");
    expect(eventInsert).toContain("'CANCELLED'");
  });

  it('returns replayed=true for the same idempotency key without a second mutation', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ reviewer_authorized: true, owner_authorized: true }])
        .mockResolvedValueOnce([{ application_id: 'application-1', new_status: 'CANCELLED' }])
        .mockResolvedValueOnce([{ id: 'application-1', status: 'CANCELLED' }]),
      $executeRaw: jest.fn(),
    };
    const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
    const repository = createRepository();
    const service = new RegistrationApplicationCancellationService(prisma as never, repository as never);

    await expect(service.cancel(
      'application-1', REASON, OWNER, IDEMPOTENCY_KEY, CORRELATION_ID,
    )).resolves.toEqual({
      applicationId: 'application-1',
      status: 'CANCELLED',
      replayed: true,
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(repository.insertAudit).not.toHaveBeenCalled();
  });

  it('treats an already CANCELLED application as idempotent success', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ reviewer_authorized: true, owner_authorized: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'application-1', status: 'CANCELLED', version: 4n }]),
      $executeRaw: jest.fn(),
    };
    const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
    const repository = createRepository();
    const service = new RegistrationApplicationCancellationService(prisma as never, repository as never);

    await expect(service.cancel(
      'application-1', REASON, OWNER, 'owner-cancel-idempotency-0002', 'owner-cancel-correlation-0002',
    )).resolves.toEqual({ applicationId: 'application-1', status: 'CANCELLED', replayed: true });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(repository.insertAudit).not.toHaveBeenCalled();
  });

  it('keeps all writes bounded to the target application and contains no physical DELETE', async () => {
    const { service, tx } = createSuccessService();
    await service.cancel('application-1', REASON, OWNER, IDEMPOTENCY_KEY, CORRELATION_ID);

    const applicationUpdate = sqlText(tx.$executeRaw.mock.calls[0] as unknown[]);
    expect(applicationUpdate).toContain('UPDATE auth.registration_applications');
    expect(applicationUpdate).toContain('WHERE id =');
    expect(applicationUpdate).toContain('AND version =');
    expect(applicationUpdate).toContain('AND status =');

    const source = sourceFile();
    expect(source).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(source).not.toMatch(/\.delete(?:Many)?\s*\(/i);
    expect(source).not.toContain('UPDATE public.users');
    expect(source).not.toContain('UPDATE public.organizations');
    expect(source).not.toContain('UPDATE public.user_orgs');
  });
});
