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

const ticket = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  challengeId: 'challenge-1',
  user: { email: 'user@example.com', role: 'BUYER', surfaceRole: 'buyer' },
};

describe('MFA provisional login ticket', () => {
  it('encrypts and opens a bounded ticket', () => {
    const sealed = sealMfaLoginTicket(ticket, 1_000, env);
    const opened = openMfaLoginTicket(sealed, 1_001, env);

    expect(sealed).not.toContain('access-token');
    expect(sealed).not.toContain('refresh-token');
    expect(opened).toMatchObject({
      v: 1,
      ...ticket,
      exp: 1_000 + MFA_PENDING_TTL_SECONDS,
    });
  });

  it('rejects tampering, expiry and a different secret', () => {
    const sealed = sealMfaLoginTicket(ticket, 1_000, env);
    const tampered = `${sealed.slice(0, -1)}A`;

    expect(openMfaLoginTicket(tampered, 1_001, env)).toBeNull();
    expect(openMfaLoginTicket(sealed, 1_000 + MFA_PENDING_TTL_SECONDS, env)).toBeNull();
    expect(openMfaLoginTicket(sealed, 1_001, {
      ...env,
      MFA_LOGIN_TICKET_SECRET: 'different-ticket-secret-with-more-than-thirty-two-characters',
    })).toBeNull();
  });

  it('fails closed when the secret is missing', () => {
    expect(() => sealMfaLoginTicket(ticket, 1_000, {})).toThrow();
    expect(openMfaLoginTicket('invalid', 1_001, {})).toBeNull();
  });

  it('uses an HttpOnly strict short-lived cookie', () => {
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
