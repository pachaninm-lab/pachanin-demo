import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { BankCallbackKeyService } from './bank-callback-key.service';
import { buildBankSignaturePayload } from './bank-callback-signature';

const admin: RequestUser = {
  id: 'admin-1',
  email: 'admin@example.test',
  orgId: 'org-admin',
  tenantId: 'tenant-admin',
  sessionId: 'session-admin',
  role: Role.ADMIN,
  mfaVerified: true,
};

const now = new Date('2026-07-10T19:00:00.000Z');
const timestamp = Math.floor(now.getTime() / 1000);
const body = {
  dealId: 'DEAL-001',
  eventId: 'bank-event-1',
  operation: 'RESERVE',
  operationId: 'bank-reserve:DEAL-001',
  status: 'SUCCESS',
  bankRef: 'bank-ref-1',
};

function signature(partnerId: string, keyId: string, secret: string): string {
  const payload = buildBankSignaturePayload({
    partnerId,
    keyId,
    timestamp,
    eventId: body.eventId,
    body,
  });
  return `hmac-sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

function setup(status: 'ACTIVE' | 'UNKNOWN' | 'REVOKED' | 'NOT_YET_VALID' | 'EXPIRED' = 'ACTIVE', secretRef = 'BANK_CALLBACK_SECRET_V1') {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{
      lifecycle_status: status,
      secret_ref: status === 'ACTIVE' ? secretRef : null,
      valid_from: new Date('2026-07-01T00:00:00.000Z'),
      valid_until: new Date('2026-08-01T00:00:00.000Z'),
      revoked_at: status === 'REVOKED' ? new Date('2026-07-05T00:00:00.000Z') : null,
    }]),
  } as unknown as jest.Mocked<PrismaService>;
  const tx = { $queryRaw: jest.fn() };
  const rls = {
    withTrustedContext: jest.fn(async (_user, work) => work(tx, {})),
  } as unknown as jest.Mocked<RlsTransactionService>;
  return { prisma, tx, rls, service: new BankCallbackKeyService(prisma, rls) };
}

describe('BankCallbackKeyService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.BANK_CALLBACK_SECRET_V1 = '1'.repeat(64);
    process.env.BANK_CALLBACK_SECRET_V2 = '2'.repeat(64);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('accepts any active key in an overlapping rotation window', async () => {
    const first = setup('ACTIVE', 'BANK_CALLBACK_SECRET_V1').service;
    await expect(first.verifyCallback({
      partnerId: 'safe-deals',
      keyId: 'v1',
      timestampHeader: String(timestamp),
      eventIdHeader: body.eventId,
      signature: signature('safe-deals', 'v1', process.env.BANK_CALLBACK_SECRET_V1!),
      body,
      now,
    })).resolves.toMatchObject({ partnerId: 'safe-deals', keyId: 'v1' });

    const second = setup('ACTIVE', 'BANK_CALLBACK_SECRET_V2').service;
    await expect(second.verifyCallback({
      partnerId: 'safe-deals',
      keyId: 'v2',
      timestampHeader: String(timestamp),
      eventIdHeader: body.eventId,
      signature: signature('safe-deals', 'v2', process.env.BANK_CALLBACK_SECRET_V2!),
      body,
      now,
    })).resolves.toMatchObject({ partnerId: 'safe-deals', keyId: 'v2' });
  });

  it.each(['UNKNOWN', 'REVOKED', 'NOT_YET_VALID', 'EXPIRED'] as const)(
    'fails closed with one generic response for %s key metadata',
    async (status) => {
      const { service } = setup(status);
      await expect(service.verifyCallback({
        partnerId: 'safe-deals',
        keyId: 'v1',
        timestampHeader: String(timestamp),
        eventIdHeader: body.eventId,
        signature: signature('safe-deals', 'v1', process.env.BANK_CALLBACK_SECRET_V1!),
        body,
        now,
      })).rejects.toMatchObject({
        status: 401,
        response: expect.objectContaining({ code: 'BANK_CALLBACK_AUTHENTICATION_FAILED' }),
      } as Partial<UnauthorizedException>);
    },
  );

  it('rejects wrong signature, stale timestamp and event mismatch before money commands', async () => {
    const { service } = setup();
    await expect(service.verifyCallback({
      partnerId: 'safe-deals',
      keyId: 'v1',
      timestampHeader: String(timestamp),
      eventIdHeader: body.eventId,
      signature: 'hmac-sha256=wrong',
      body,
      now,
    })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.verifyCallback({
      partnerId: 'safe-deals',
      keyId: 'v1',
      timestampHeader: String(timestamp - 301),
      eventIdHeader: body.eventId,
      signature: signature('safe-deals', 'v1', process.env.BANK_CALLBACK_SECRET_V1!),
      body,
      now,
    })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.verifyCallback({
      partnerId: 'safe-deals',
      keyId: 'v1',
      timestampHeader: String(timestamp),
      eventIdHeader: 'different-event',
      signature: signature('safe-deals', 'v1', process.env.BANK_CALLBACK_SECRET_V1!),
      body,
      now,
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('registers and revokes metadata only through ADMIN MFA trusted context', async () => {
    const { service, tx, rls } = setup();
    tx.$queryRaw.mockResolvedValueOnce([{ registered: true }]);
    await expect(service.registerKey({
      partnerId: 'safe-deals',
      keyId: 'v2',
      secretRef: 'BANK_CALLBACK_SECRET_V2',
      validFrom: '2026-07-10T19:00:00.000Z',
      validUntil: '2026-08-10T19:00:00.000Z',
    }, admin)).resolves.toEqual({ registered: true, partnerId: 'safe-deals', keyId: 'v2' });

    tx.$queryRaw.mockResolvedValueOnce([{ revoked: true }]);
    await expect(service.revokeKey('safe-deals', 'v1', 'Partner key compromised', admin))
      .resolves.toEqual({ revoked: true, partnerId: 'safe-deals', keyId: 'v1' });
    expect(rls.withTrustedContext).toHaveBeenCalledTimes(2);
  });

  it('rejects non-admin or non-MFA rotation attempts', async () => {
    const { service } = setup();
    await expect(service.registerKey({
      partnerId: 'safe-deals',
      keyId: 'v2',
      secretRef: 'BANK_CALLBACK_SECRET_V2',
      validFrom: '2026-07-10T19:00:00.000Z',
    }, { ...admin, role: Role.ACCOUNTING })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.revokeKey('safe-deals', 'v1', 'Rotating old key', { ...admin, mfaVerified: false }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
