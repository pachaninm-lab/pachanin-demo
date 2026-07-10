import { describe, expect, it } from 'vitest';
import {
  MFA_PENDING_TTL_SECONDS,
  mfaPendingCookieOptions,
  openMfaLoginTicket,
  sealMfaLoginTicket,
} from '../../lib/server/mfa-login-ticket';

const env = {
  MFA_LOGIN_TICKET_SECRET: 'mfa-login-ticket-secret-with-more-than-thirty-two-characters',
  NODE_ENV: 'production',
} as NodeJS.ProcessEnv;

const pending = {
  challengeToken: 'mc_challenge-token',
  user: { email: 'user@example.com', role: 'BUYER', surfaceRole: 'buyer' },
};

describe('MFA pending login ticket', () => {
  it('encrypts and opens a bounded challenge without session tokens', () => {
    const sealed = sealMfaLoginTicket(pending, 1_000, env);
    const opened = openMfaLoginTicket(sealed, 1_001, env);

    expect(sealed).not.toContain('mc_challenge-token');
    expect(sealed).not.toContain('user@example.com');
    expect(opened).toMatchObject({
      v: 1,
      ...pending,
      exp: 1_000 + MFA_PENDING_TTL_SECONDS,
    });
    expect(opened).not.toHaveProperty('accessToken');
    expect(opened).not.toHaveProperty('refreshToken');
  });

  it('rejects tampering, expiry and a different secret', () => {
    const sealed = sealMfaLoginTicket(pending, 1_000, env);
    const tampered = `${sealed.slice(0, -1)}A`;

    expect(openMfaLoginTicket(tampered, 1_001, env)).toBeNull();
    expect(openMfaLoginTicket(sealed, 1_000 + MFA_PENDING_TTL_SECONDS, env)).toBeNull();
    expect(openMfaLoginTicket(sealed, 1_001, {
      ...env,
      MFA_LOGIN_TICKET_SECRET: 'different-ticket-secret-with-more-than-thirty-two-characters',
    })).toBeNull();
  });

  it('fails closed when the encryption secret is absent', () => {
    expect(() => sealMfaLoginTicket(pending, 1_000, {})).toThrow();
    expect(openMfaLoginTicket('invalid', 1_001, {})).toBeNull();
  });

  it('uses a short-lived HttpOnly strict cookie', () => {
    const options = mfaPendingCookieOptions();
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: MFA_PENDING_TTL_SECONDS,
    });
  });
});
