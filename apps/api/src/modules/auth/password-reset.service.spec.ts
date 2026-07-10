import { BadRequestException } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { issuePasswordResetToken } from './password-reset-token';

const DELIVERY_KEY = 'delivery-boundary-secret-with-more-than-thirty-two-characters';
const TOKEN_SECRET = 'password-reset-token-secret-with-more-than-thirty-two-characters';

describe('PasswordResetService', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    process.env.PASSWORD_RESET_DELIVERY_KEY = DELIVERY_KEY;
    process.env.PASSWORD_RESET_TOKEN_SECRET = TOKEN_SECRET;
  });

  afterAll(() => {
    process.env = previousEnv;
  });

  function setup(overrides: Record<string, unknown> = {}) {
    const tx = {
      mfaChallenge: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'challenge-1', expiresAt: new Date(Date.now() + 900_000) }),
      },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      authRefreshFamily: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      mfaChallenge: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      ...overrides,
    };
    const audit = { log: jest.fn() };
    return { service: new PasswordResetService(prisma as never, audit as never), prisma, audit, tx };
  }

  it('returns the same public response when the trusted delivery boundary is missing', async () => {
    const { service, prisma } = setup();

    await expect(service.request('unknown@example.com', '127.0.0.1')).resolves.toEqual({
      accepted: true,
      message: 'If the account exists, password reset instructions will be sent.',
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not expose account existence to the trusted BFF for an unknown account', async () => {
    const { service } = setup();

    const result = await service.request('unknown@example.com', '127.0.0.1', DELIVERY_KEY);

    expect(result).toEqual({
      accepted: true,
      message: 'If the account exists, password reset instructions will be sent.',
    });
    expect('delivery' in result).toBe(false);
  });

  it('issues a single short-lived delivery token for an eligible account', async () => {
    const { service, prisma, tx } = setup({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          status: 'ACTIVE',
          deletedAt: null,
        }),
      },
    });

    const result = await service.request(' User@Example.com ', '127.0.0.1', DELIVERY_KEY);

    expect(result).toMatchObject({
      accepted: true,
      delivery: {
        email: 'user@example.com',
        expiresInSeconds: 900,
      },
    });
    expect((result as { delivery: { token: string } }).delivery.token).toContain('.');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.mfaChallenge.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ purpose: 'PASSWORD_RESET', status: 'PENDING' }),
    }));
  });

  it('honours the per-account cooldown without issuing another token', async () => {
    const { service, prisma } = setup({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          status: 'ACTIVE',
          deletedAt: null,
        }),
      },
      mfaChallenge: {
        findFirst: jest.fn().mockResolvedValue({ id: 'challenge-existing', expiresAt: new Date(Date.now() + 600_000) }),
        updateMany: jest.fn(),
      },
    });

    const result = await service.request('user@example.com', '127.0.0.1', DELIVERY_KEY);

    expect('delivery' in result).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('consumes the challenge and revokes active sessions in one transaction', async () => {
    const { service, tx } = setup();
    const token = issuePasswordResetToken('challenge-1', 'user-1');

    await expect(service.confirm(token, 'New-Industrial-Passphrase-2026!', '127.0.0.1')).resolves.toEqual({
      success: true,
      sessionsRevoked: true,
    });

    expect(tx.mfaChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'challenge-1', status: 'PENDING' }),
      data: expect.objectContaining({ status: 'CONSUMED' }),
    }));
    expect(tx.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REVOKED', revokeReason: 'password_reset' }),
    }));
    expect(tx.authRefreshFamily.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REVOKED', revokeReason: 'password_reset' }),
    }));
  });

  it('rejects replay after the challenge was already consumed', async () => {
    const { service, tx } = setup();
    tx.mfaChallenge.updateMany.mockResolvedValueOnce({ count: 0 });
    const token = issuePasswordResetToken('challenge-1', 'user-1');

    await expect(service.confirm(token, 'New-Industrial-Passphrase-2026!', '127.0.0.1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
