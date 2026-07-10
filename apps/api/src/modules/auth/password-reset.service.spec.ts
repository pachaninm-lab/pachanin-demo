import { BadRequestException } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { issuePasswordResetToken } from './password-reset-token';

function repositoryMock() {
  const tx = {};
  return {
    tx,
    prisma: {},
    transaction: jest.fn(async (work: (client: unknown) => Promise<unknown>) => work(tx)),
    findUserByEmail: jest.fn(),
    findRecentPending: jest.fn(),
    expirePending: jest.fn(),
    createChallenge: jest.fn(),
    getChallengeForUpdate: jest.fn(),
    replacePassword: jest.fn(),
    consumeChallenge: jest.fn(),
    revokeAllUserSessions: jest.fn(),
    latestAuditHash: jest.fn().mockResolvedValue(null),
    insertAudit: jest.fn(),
  };
}

describe('PasswordResetService', () => {
  const deliveryKey = 'delivery-key-that-is-longer-than-thirty-two-characters';
  const originalDeliveryKey = process.env.PASSWORD_RESET_DELIVERY_KEY;

  beforeEach(() => {
    process.env.PASSWORD_RESET_DELIVERY_KEY = deliveryKey;
  });

  afterAll(() => {
    if (originalDeliveryKey === undefined) delete process.env.PASSWORD_RESET_DELIVERY_KEY;
    else process.env.PASSWORD_RESET_DELIVERY_KEY = originalDeliveryKey;
  });

  it('returns the same universal response without issuing when the delivery boundary is absent', async () => {
    const repository = repositoryMock();
    const service = new PasswordResetService(repository as never);

    const result = await service.request('known@example.com', '203.0.113.1');

    expect(result).toEqual({
      accepted: true,
      message: 'If the account exists, password reset instructions will be sent.',
    });
    expect(repository.findUserByEmail).not.toHaveBeenCalled();
    expect(repository.createChallenge).not.toHaveBeenCalled();
  });

  it('does not reveal whether an account exists', async () => {
    const repository = repositoryMock();
    repository.findUserByEmail.mockResolvedValue(null);
    const service = new PasswordResetService(repository as never);

    const result = await service.request('missing@example.com', '203.0.113.2', deliveryKey);

    expect(result).toEqual({
      accepted: true,
      message: 'If the account exists, password reset instructions will be sent.',
    });
    expect(repository.createChallenge).not.toHaveBeenCalled();
  });

  it('issues a delivery token only after the durable challenge is created', async () => {
    const repository = repositoryMock();
    repository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'known@example.com',
      status: 'ACTIVE',
      deleted_at: null,
    });
    repository.findRecentPending.mockResolvedValue(null);
    const service = new PasswordResetService(repository as never);

    const result = await service.request(' Known@Example.com ', '203.0.113.3', deliveryKey);

    expect(repository.createChallenge).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      accepted: true,
      delivery: {
        email: 'known@example.com',
        expiresInSeconds: 900,
      },
    });
    expect((result as { delivery: { token: string } }).delivery.token).toMatch(/^pr_/);
  });

  it('does not return an undeliverable token when a concurrent request wins the cooldown race', async () => {
    const repository = repositoryMock();
    repository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'known@example.com',
      status: 'ACTIVE',
      deleted_at: null,
    });
    repository.findRecentPending
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing', expires_at: new Date(Date.now() + 60_000) });
    const service = new PasswordResetService(repository as never);

    const result = await service.request('known@example.com', '203.0.113.4', deliveryKey);

    expect(result).toEqual({
      accepted: true,
      message: 'If the account exists, password reset instructions will be sent.',
    });
    expect(repository.createChallenge).not.toHaveBeenCalled();
  });

  it('atomically replaces the password, consumes the token and revokes every active session', async () => {
    const repository = repositoryMock();
    const issued = issuePasswordResetToken();
    repository.getChallengeForUpdate.mockResolvedValue({
      id: issued.id,
      user_id: 'user-1',
      token_hash: issued.hash,
      status: 'PENDING',
      requested_ip_hash: null,
      expires_at: new Date(Date.now() + 60_000),
      consumed_at: null,
      created_at: new Date(),
    });
    repository.replacePassword.mockResolvedValue(true);
    repository.consumeChallenge.mockResolvedValue(true);
    const service = new PasswordResetService(repository as never);

    const result = await service.confirm(issued.token, 'New-Secure-Password-2026', '203.0.113.5');

    expect(result).toEqual({ success: true, sessionsRevoked: true });
    expect(repository.replacePassword).toHaveBeenCalledWith(repository.tx, 'user-1', expect.any(String), expect.any(Date));
    expect(repository.consumeChallenge).toHaveBeenCalledWith(repository.tx, issued.id, expect.any(Date));
    expect(repository.revokeAllUserSessions).toHaveBeenCalledWith(repository.tx, 'user-1', 'PASSWORD_RESET');
    expect(repository.expirePending).toHaveBeenCalledWith(repository.tx, 'user-1', issued.id);
  });

  it('rejects a replayed or consumed reset token', async () => {
    const repository = repositoryMock();
    const issued = issuePasswordResetToken();
    repository.getChallengeForUpdate.mockResolvedValue({
      id: issued.id,
      user_id: 'user-1',
      token_hash: issued.hash,
      status: 'CONSUMED',
      expires_at: new Date(Date.now() + 60_000),
    });
    const service = new PasswordResetService(repository as never);

    await expect(service.confirm(issued.token, 'New-Secure-Password-2026')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replacePassword).not.toHaveBeenCalled();
    expect(repository.revokeAllUserSessions).not.toHaveBeenCalled();
  });
});
