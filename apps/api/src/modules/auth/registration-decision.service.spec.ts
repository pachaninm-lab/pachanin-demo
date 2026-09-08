import { ForbiddenException } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Role, type RequestUser } from '../../common/types/request-user';
import { RegistrationDecisionService } from './registration-decision.service';

const REVIEWER: RequestUser = {
  id: 'reviewer-user',
  email: 'reviewer@example.test',
  role: Role.ADMIN,
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'reviewer-membership',
  sessionId: 'reviewer-session',
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

function createMailOutboxMock() {
  return {
    enqueue: jest.fn().mockResolvedValue({ queued: true, replayed: false, envelopeDigest: 'digest' }),
    registrationDecisionStatus: jest.fn().mockResolvedValue({
      status: 'MISSING', attemptCount: 0, maxAttempts: 0, lastErrorCode: null, sentAt: null,
    }),
    waitForRegistrationDecisionDelivery: jest.fn().mockResolvedValue({
      status: 'SENT', attemptCount: 0, maxAttempts: 12, lastErrorCode: null, sentAt: new Date(),
    }),
  };
}

function createService() {
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
  const repository = {};
  const mailOutbox = createMailOutboxMock();
  return {
    service: new RegistrationDecisionService(prisma as never, repository as never, mailOutbox as never),
    prisma,
    mailOutbox,
  };
}

function lifecycleReceiptMigration(): string {
  const relative = 'apps/api/prisma/migrations/20260808213000_p0_registration_lifecycle_receipt/migration.sql';
  const candidates = [path.resolve(process.cwd(), relative), path.resolve(process.cwd(), '../..', relative)];
  const source = candidates.find(existsSync);
  if (!source) throw new Error(`Missing registration lifecycle receipt migration: ${relative}`);
  return readFileSync(source, 'utf8');
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
        .mockResolvedValueOnce([{ authorized: true }])
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
    const service = new RegistrationDecisionService(prisma as never, {} as never, createMailOutboxMock() as never);

    await expect(service.decide(
      'join-application-1', 'APPROVE', 'Verified organization join request',
      { ...REVIEWER, staffRoles: ['PLATFORM_OWNER'] }, 'idempotency-decision-join-0001', 'correlation-1',
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('recovers the durable notification on an exact platform decision replay', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ application_id: 'application-1' }]),
    };
    const prisma = {
      $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const service = new RegistrationDecisionService(
      prisma as never,
      {} as never,
      createMailOutboxMock() as never,
    );
    const replayResult = { applicationId: 'application-1', status: 'ACTIVATED', replayed: true };
    const readResult = jest.fn().mockResolvedValue(replayResult);
    const queueRegistrationDecisionNotification = jest.fn().mockResolvedValue(
      `auth-mail:registration-decision:${'a'.repeat(64)}`,
    );
    Object.assign(service as unknown as Record<string, unknown>, {
      requirePlatformDecisionAuthority: jest.fn().mockResolvedValue(undefined),
      readResult,
      queueRegistrationDecisionNotification,
    });

    await expect(service.decide(
      'application-1',
      'APPROVE',
      'Verified organization details',
      { ...REVIEWER, staffRoles: ['PLATFORM_OWNER'] },
      'idempotency-decision-replay-0001',
      'correlation-replay-1',
    )).resolves.toEqual(replayResult);

    expect(queueRegistrationDecisionNotification).toHaveBeenCalledWith(
      tx,
      'application-1',
      'decision:idempotency-decision-replay-0001',
      'correlation-replay-1',
    );
    expect(readResult).toHaveBeenCalledWith(tx, 'application-1', true);
  });

  it('never returns recipient metadata from the registration decision result', async () => {
    const { service } = createService();
    const client = {
      $queryRaw: jest.fn().mockResolvedValue([{
        id: 'application-1',
        status: 'ACTIVATED',
        version: 2n,
        correlation_id: 'correlation-1',
      }]),
    };
    const readResult = (service as unknown as {
      readResult: (
        tx: typeof client,
        applicationId: string,
        replayed?: boolean,
      ) => Promise<Record<string, unknown>>;
    }).readResult.bind(service);

    const initial = await readResult(client, 'application-1');
    expect(initial).toMatchObject({ replayed: false, status: 'ACTIVATED' });
    expect(initial).not.toHaveProperty('notificationDelivery');
    expect(JSON.stringify(initial)).not.toContain('@');

    const replay = await readResult(client, 'application-1', true);
    expect(replay).toMatchObject({ replayed: true });
    expect(replay).not.toHaveProperty('notificationDelivery');
  });

  it('waits for durable SENT evidence before exposing a bounded delivery acknowledgement', async () => {
    const previousDeliveryKey = process.env.REGISTRATION_DELIVERY_KEY;
    const deliveryKey = 'registration-delivery-key-for-durable-status';
    process.env.REGISTRATION_DELIVERY_KEY = deliveryKey;
    const { service, mailOutbox } = createService();
    const complete = (service as unknown as {
      completeDecisionResponse: (
        outcome: Record<string, unknown>,
        providedDeliveryKey?: string,
      ) => Promise<Record<string, unknown>>;
    }).completeDecisionResponse.bind(service);
    try {
      const result = await complete({
        response: {
          applicationId: 'application-1', status: 'ACTIVATED', nextAction: 'LOGIN',
          version: '2', correlationId: 'correlation-1', replayed: false,
        },
        mailIdempotencyKey: `auth-mail:registration-decision:${'a'.repeat(64)}`,
      }, deliveryKey);
      expect(mailOutbox.waitForRegistrationDecisionDelivery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ notificationDelivery: { status: 'SENT' } });
      expect(JSON.stringify(result)).not.toContain('@');
    } finally {
      if (previousDeliveryKey === undefined) delete process.env.REGISTRATION_DELIVERY_KEY;
      else process.env.REGISTRATION_DELIVERY_KEY = previousDeliveryKey;
    }
  });

  it('returns bounded SENT evidence after a durable replay recovery', async () => {
    const previousDeliveryKey = process.env.REGISTRATION_DELIVERY_KEY;
    const deliveryKey = 'registration-delivery-key-for-replay-proof';
    process.env.REGISTRATION_DELIVERY_KEY = deliveryKey;
    const { service, mailOutbox } = createService();
    const complete = (service as unknown as {
      completeDecisionResponse: (
        outcome: Record<string, unknown>,
        providedDeliveryKey?: string,
      ) => Promise<Record<string, unknown>>;
    }).completeDecisionResponse.bind(service);
    try {
      const result = await complete({
        response: {
          applicationId: 'application-1', status: 'ACTIVATED', nextAction: 'LOGIN',
          version: '2', correlationId: 'correlation-replay-proof', replayed: true,
        },
        mailIdempotencyKey: `auth-mail:registration-decision:${'b'.repeat(64)}`,
      }, deliveryKey);
      expect(mailOutbox.waitForRegistrationDecisionDelivery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        replayed: true,
        notificationDelivery: { status: 'SENT' },
      });
      expect(JSON.stringify(result)).not.toContain('@');
    } finally {
      if (previousDeliveryKey === undefined) delete process.env.REGISTRATION_DELIVERY_KEY;
      else process.env.REGISTRATION_DELIVERY_KEY = previousDeliveryKey;
    }
  });

  it('keeps the causal receipt inside a membership-free bounded PostgreSQL authority', () => {
    const migration = lifecycleReceiptMigration();

    expect(migration).toContain('CREATE ROLE pc_registration_receipt_authority');
    expect(migration).toContain('NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET row_security = on');
    expect(migration).toContain('auth.registration.lifecycle.receipt');
    expect(migration).toContain("'registration-lifecycle:' || application.id || ':' || application.version::text");
    expect(migration).toContain('Auth approval audit must remain append-only');
    expect(migration).not.toMatch(/GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS/i);
    expect(migration).not.toMatch(/(?:DISABLE|NO\s+FORCE)\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  it('writes approval audit before the receipt and reads the result in the same transaction', async () => {
    const order: string[] = [];
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const prisma = {
      $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const service = new RegistrationDecisionService(prisma as never, {} as never, createMailOutboxMock() as never);
    const application = {
      id: 'application-1', kind: 'NEW_ORGANIZATION', user_id: 'applicant-1',
      organization_id: 'organization-1', membership_id: 'membership-1', requested_workspace: 'seller',
      requested_role: Role.FARMER, status: 'ORGANIZATION_VERIFICATION_PENDING', version: 1n,
      correlation_id: 'correlation-1', organization_status: 'PENDING', tenant_id: 'tenant-1',
    };
    Object.assign(service as unknown as Record<string, unknown>, {
      requirePlatformDecisionAuthority: jest.fn(async () => { order.push('authority'); }),
      lockApplication: jest.fn(async () => application),
      approve: jest.fn(async () => { order.push('approve'); }),
      audit: jest.fn(async () => { order.push('audit'); }),
      emitRegistrationLifecycleReceipt: jest.fn(async () => { order.push('receipt'); }),
      queueRegistrationDecisionNotification: jest.fn(async () => {
        order.push('queue');
        return `auth-mail:registration-decision:${'a'.repeat(64)}`;
      }),
      readResult: jest.fn(async () => { order.push('read'); return { status: 'ACTIVATED' }; }),
    });

    await expect(service.decide(
      application.id,
      'APPROVE',
      'Verified organization details',
      { ...REVIEWER, staffRoles: ['PLATFORM_OWNER'] },
      'idempotency-decision-0001',
      'correlation-1',
    )).resolves.toEqual({ status: 'ACTIVATED' });

    expect(order).toEqual(['authority', 'approve', 'audit', 'receipt', 'queue', 'read']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
