import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  openGektaEmailTicket,
  openGektaMfaTicket,
  sealGektaEmailTicket,
  sealGektaMfaTicket,
} from '@/lib/server/gekta-mfa-ticket';

describe('Gekta pending authentication tickets', () => {
  const originalTicketSecret = process.env.MFA_LOGIN_TICKET_SECRET;

  beforeEach(() => {
    process.env.MFA_LOGIN_TICKET_SECRET = 'test-only-ticket-secret-that-is-longer-than-thirty-two-characters';
  });

  afterEach(() => {
    if (originalTicketSecret === undefined) delete process.env.MFA_LOGIN_TICKET_SECRET;
    else process.env.MFA_LOGIN_TICKET_SECRET = originalTicketSecret;
  });

  it('encrypts the MFA challenge and preserves only the bounded server ticket', () => {
    const challengeToken = 'mc.test-challenge-token-that-never-reaches-react';
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const sealed = sealGektaMfaTicket({ challengeToken, enrollmentRequired: true, expiresAt });
    expect(sealed).toBeTruthy();
    expect(sealed).not.toContain(challengeToken);
    expect(openGektaMfaTicket(sealed!)).toEqual({ challengeToken, enrollmentRequired: true, expiresAt });
  });

  it('rejects modification, expiry and a missing production-strength secret', () => {
    const sealed = sealGektaMfaTicket({
      challengeToken: 'mc.another-long-challenge-token-value',
      enrollmentRequired: false,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })!;
    const parts = sealed.split('.');
    parts[2] = `${parts[2].startsWith('A') ? 'B' : 'A'}${parts[2].slice(1)}`;
    expect(openGektaMfaTicket(parts.join('.'))).toBeNull();
    expect(openGektaMfaTicket(sealed, Date.now() + 61_000)).toBeNull();
    process.env.MFA_LOGIN_TICKET_SECRET = 'too-short';
    expect(openGektaMfaTicket(sealed)).toBeNull();
  });

  it('moves an email token into a separate purpose-bound encrypted envelope', () => {
    const emailToken = 're.test-email-token-that-is-long-enough';
    const sealed = sealGektaEmailTicket(emailToken);
    expect(sealed).toBeTruthy();
    expect(sealed).not.toContain(emailToken);
    expect(openGektaEmailTicket(sealed!)).toBe(emailToken);
    // Domain separation prevents an email token from becoming an MFA ticket.
    expect(openGektaMfaTicket(sealed!)).toBeNull();
  });
});
