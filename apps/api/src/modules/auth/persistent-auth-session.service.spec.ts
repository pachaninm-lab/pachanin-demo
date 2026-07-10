import { UnauthorizedException } from '@nestjs/common';
import { PersistentAuthSessionService } from './persistent-auth-session.service';

describe('PersistentAuthSessionService', () => {
  function createService() {
    const tx = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    };
    return { service: new PersistentAuthSessionService(prisma as any), prisma, tx };
  }

  it('stores only token and IP hashes when issuing a session', async () => {
    const { service, prisma } = createService();
    const result = await service.issue('user-one', 'Mobile Safari', '203.0.113.10');

    expect(result.refreshToken).toBeTruthy();
    expect(result.sessionId).toBeTruthy();
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);

    const serializedCall = JSON.stringify(prisma.$executeRaw.mock.calls[0]);
    expect(serializedCall).not.toContain(result.refreshToken);
    expect(serializedCall).not.toContain('203.0.113.10');
  });

  it('rotates refresh token in a serializable transaction', async () => {
    const { service, prisma, tx } = createService();
    tx.$queryRaw.mockResolvedValue([{
      id: 'session-one',
      user_id: 'user-one',
      refresh_token_hash: 'hash',
      refresh_family_id: 'family-one',
      refresh_generation: 0,
      expires_at: new Date(Date.now() + 60_000),
      revoked_at: null,
    }]);

    const result = await service.rotate('refresh-token-one', 'Mobile Safari', '203.0.113.10');

    expect(result.userId).toBe('user-one');
    expect(result.generation).toBe(1);
    expect(result.refreshToken).not.toBe('refresh-token-one');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('revokes the complete token family when a rotated token is reused', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([{
      id: 'session-old',
      user_id: 'user-one',
      refresh_token_hash: 'hash',
      refresh_family_id: 'family-one',
      refresh_generation: 0,
      expires_at: new Date(Date.now() + 60_000),
      revoked_at: new Date(),
    }]);

    await expect(service.rotate('reused-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects an absent or expired server-side session', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw.mockResolvedValue([{ active: false }]);

    await expect(service.assertActive('missing-session')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
