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
    latestAuditChainPosition: jest.fn().mockResolvedValue({ chainKey: 'auth-global', prevHash: null, nextSequence: 1n }),
    insertAudit: jest.fn(),
  };
}

function mailOutboxMock() {
  return {
    enqueue: jest.fn().mockResolvedValue({ queued: true, replayed: false, envelopeDigest: 'digest' }),
  };
}

describe('PasswordResetService durable mail outbox', () => {
  const deliveryKey = 'delivery-key-that-is-longer-than-thirty-two-characters';
  const originalDeliveryKey = process.env.PASSWORD_RESET_DELIVERY_KEY;

  beforeEach(() => {
    process.env.PASSWORD_RESET_DELIVERY_KEY = deliveryKey;
  });

  afterAll(() => {
    if (originalDeliveryKey === undefined) delete process.env.PASSWORD_RESET_DELIVERY_KEY;
    else process.env.PASSWORD_RESET_DELIVERY_KEY = originalDeliveryKey;
  });

  it('does not issue a challenge when the server delivery boundary is absent', async () => {
    const repository = repositoryMock();
    const mailOutbox = mailOutboxMock();
    const service = new PasswordResetService(repository as never, mailOutbox as never);

    const result = await service.request('known@example.com', '203.0.113.1');

    expect(result).toEqual({
      accepted: true,
      message: 'If the account exists, password reset instructions will be sent.',
    });
    expect(repository.findUserByEmail).not.toHaveBeenCalled();
    expect(repository.createChallenge).not.toHaveBeenCalled();
    expect(mailOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('does not reveal whether an account exists', async () => {
    const repository = repositoryMock();
    const mailOutbox = mailOutboxMock();
    repository.findUserByEmail.mockResolvedValue(null);
    const service = new PasswordResetService(repository as never, mailOutbox as never);

    const result = await service.request('missing@example.com', '203.0.113.2', deliveryKey, 'corr-missing', 'en');

    expect(result).toEqual({
      accepted: true,
      message: 'If the account exists, password reset instructions will be sent.',
    });
    expect(repository.createChallenge).not.toHaveBeenCalled();
    expect(mailOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('creates challenge and mail intent in one transaction without returning the bearer token', async () => {
    const repository = repositoryMock();
    const mailOutbox = mailOutboxMock();
    repository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'known@example.com',
      status: 'ACTIVE',
      deleted_at: null,
    });
    repository.findRecentPending.mockResolvedValue(null);
    const service = new PasswordResetService(repository as never, mailOutbox as never);

    const result = await service.request(
      ' Known@Example.com ',
      '203.0.113.3',
      deliveryKey,
      'corr-reset',
      'zh',
    );

    expect(repository.createChallenge).toHaveBeenCalledTimes(1);
    expect(mailOutbox.enqueue).toHaveBeenCalledTimes(1);
    expect(mailOutbox.enqueue).toHaveBeenCalledWith(
      repository.tx,
      expect.objectContaining({
        kind: 'PASSWORD_RESET',
        correlationId: 'corr-reset',
        idempotencyKey: expect.stringMatching(/^auth-mail:password-reset:pr_/),
        envelope: expect.objectContaining({
          to: 'known@example.com',
          subject: expect.any(String),
          text: expect.stringContaining('/platform-v7/forgot-password?token='),
        }),
        expiresAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      accepted: true,
      message: 'If the account exists, password reset instructions will be sent.',
    });
    expect(JSON.stringify(result)).not.toContain('pr_');
    expect(JSON.stringify(result)).not.toContain('known@example.com');
  });

  it('does not enqueue a second mail when a concurrent request wins the cooldown race', async () => {
    const repository = repositoryMock();
    const mailOutbox = mailOutboxMock();
    repository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'known@example.com',
      status: 'ACTIVE',
      deleted_at: null,
    });
    repository.findRecentPending
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing', expires_at: new Date(Date.now() + 60_000) });
    const service = new PasswordResetService(repository as never, mailOutbox as never);

    const result = await service.request('known@example.com', '203.0.113.4', deliveryKey, 'corr-race', 'ru');

    expect(result).toEqual({
      accepted: true,
      message: 'If the account exists, password reset instructions will be sent.',
    });
    expect(repository.createChallenge).not.toHaveBeenCalled();
    expect(mailOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('keeps password confirmation behind the existing notification boundary', async () => {
    const repository = repositoryMock();
    const mailOutbox = mailOutboxMock();
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
    repository.replacePassword.mockResolvedValue('person@example.test');
    repository.consumeChallenge.mockResolvedValue(true);
    const service = new PasswordResetService(repository as never, mailOutbox as never);

    const result = await service.confirm(issued.token, 'New-Secure-Password-2026', '203.0.113.5', deliveryKey);

    expect(result).toEqual({
      success: true,
      sessionsRevoked: true,
      notificationDelivery: { email: 'person@example.test' },
    });
    expect(repository.revokeAllUserSessions).toHaveBeenCalledWith(repository.tx, 'user-1', 'PASSWORD_RESET');
  });

  it('rejects a replayed or consumed reset token', async () => {
    const repository = repositoryMock();
    const mailOutbox = mailOutboxMock();
    const issued = issuePasswordResetToken();
    repository.getChallengeForUpdate.mockResolvedValue({
      id: issued.id,
      user_id: 'user-1',
      token_hash: issued.hash,
      status: 'CONSUMED',
      expires_at: new Date(Date.now() + 60_000),
    });
    const service = new PasswordResetService(repository as never, mailOutbox as never);

    await expect(service.confirm(issued.token, 'New-Secure-Password-2026', undefined, deliveryKey))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replacePassword).not.toHaveBeenCalled();
    expect(repository.revokeAllUserSessions).not.toHaveBeenCalled();
  });
});
