import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { AuthService } from './auth.service';
import { PersistentAuthRepository } from './persistent-auth.repository';

/**
 * ASVS V7.5.2: владелец учётной записи видит свои активные сессии и может
 * завершить любую или все, подтвердив фактор.
 */
describe('own session management', () => {
  const service = Object.create(AuthService.prototype) as AuthService;
  const now = Date.now();
  const fresh = (id = 'u1', sessionId = 's-current') => ({
    id,
    sessionId,
    mfaVerified: true,
    mfaVerifiedAt: new Date(now - 60_000).toISOString(),
  } as never);
  const stale = { id: 'u1', sessionId: 's-current', mfaVerified: true, mfaVerifiedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString() } as never;

  const row = (id: string) => ({
    id,
    mfa_level: 'TOTP',
    mfa_verified_at: new Date(now - 60_000),
    created_at: new Date(now - 3_600_000),
    last_seen_at: new Date(now - 30_000),
    expires_at: new Date(now + 3_600_000),
  });

  function wire(overrides: Record<string, unknown> = {}) {
    const repository = {
      prisma: {},
      listActiveUserSessions: jest.fn(async () => [row('s-current'), row('s-other')]),
      revokeOwnSession: jest.fn(async () => 1),
      revokeAllUserSessions: jest.fn(async () => undefined),
      transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
      ...overrides,
    };
    Object.assign(service, { repository, audit: jest.fn(async () => undefined) });
    return repository;
  }

  it('lists only the caller own sessions and marks the current one', async () => {
    const repository = wire();
    const sessions = await service.listOwnSessions(fresh());

    expect(repository.listActiveUserSessions).toHaveBeenCalledWith(repository.prisma, 'u1');
    expect(sessions.map((s) => s.id)).toEqual(['s-current', 's-other']);
    expect(sessions[0].current).toBe(true);
    expect(sessions[1].current).toBe(false);
  });

  it('never returns the hashed fingerprints the row carries', () => {
    // user_agent_hash and ip_hash exist on auth.sessions. They are hashed, tell
    // the owner nothing, and are a fingerprint, so they must not be projected.
    const source = readFileSync(join(__dirname, 'persistent-auth.repository.ts'), 'utf8');
    const select = source.slice(
      source.indexOf('async listActiveUserSessions('),
      source.indexOf('async revokeOwnSession('),
    );
    expect(select).not.toContain('user_agent_hash');
    expect(select).not.toContain('ip_hash');
    expect(select).toContain('s.user_id = ${userId}');
  });

  it('viewing does not require a fresh factor, terminating does', async () => {
    wire();
    // Seeing that your account is compromised must not be gated behind a step-up.
    await expect(service.listOwnSessions(stale)).resolves.toBeDefined();

    await expect(service.revokeOwnSession(stale, 's-other')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.revokeAllOwnSessions(stale)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes the termination by user in SQL, not by a check before it', () => {
    // revokeSession() takes any id and is not user-scoped; calling it with a
    // foreign id would be a direct object reference. The own-session path puts
    // user_id in the WHERE so a foreign id changes no row at all.
    const source = readFileSync(join(__dirname, 'persistent-auth.repository.ts'), 'utf8');
    const revoke = source.slice(
      source.indexOf('async revokeOwnSession('),
      source.indexOf('async revokeAllUserSessions('),
    );
    expect(revoke).toContain('WHERE id = ${sessionId}');
    expect(revoke).toContain('AND user_id = ${userId}');
    expect(revoke).toContain("AND status IN ('ACTIVE', 'MFA_PENDING')");
  });

  it('answers the same way for a foreign, an already-ended and a missing session', async () => {
    // Distinguishing them would make the endpoint an oracle for session ids.
    wire({ revokeOwnSession: jest.fn(async () => 0) });
    await expect(service.revokeOwnSession(fresh(), 'someone-elses')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.revokeOwnSession(fresh(), 'already-ended')).rejects.toMatchObject({
      response: { code: 'SESSION_NOT_FOUND' },
    });
  });

  it('terminates one session with the caller own id, never an id from the request', async () => {
    const repository = wire();
    await expect(service.revokeOwnSession(fresh(), 's-other')).resolves.toMatchObject({ success: true });
    expect(repository.revokeOwnSession).toHaveBeenCalledWith({}, 'u1', 's-other', 'USER_REVOKED');
  });

  it('terminates all sessions of the caller, including the current one', async () => {
    const repository = wire();
    await expect(service.revokeAllOwnSessions(fresh())).resolves.toMatchObject({ success: true });
    expect(repository.revokeAllUserSessions).toHaveBeenCalledWith({}, 'u1', 'USER_REVOKED_ALL');
  });

  it('records both terminations in the audit trail', async () => {
    wire();
    await service.revokeOwnSession(fresh(), 's-other');
    await service.revokeAllOwnSessions(fresh());
    const audit = (service as unknown as { audit: jest.Mock }).audit;
    const actions = audit.mock.calls.map((call) => call[1].action);
    expect(actions).toContain('auth.sessions.revoke_own');
    expect(actions).toContain('auth.sessions.revoke_all_own');
  });

  it('the repository exposes a user-scoped listing rather than reusing the admin one', () => {
    expect(typeof PersistentAuthRepository.prototype.listActiveUserSessions).toBe('function');
    expect(typeof PersistentAuthRepository.prototype.revokeOwnSession).toBe('function');
  });
});
