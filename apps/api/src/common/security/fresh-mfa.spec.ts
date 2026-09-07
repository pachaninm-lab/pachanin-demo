import { ForbiddenException } from '@nestjs/common';

import {
  isFreshMfa,
  MFA_CLOCK_SKEW_TOLERANCE_MS,
  MFA_FRESHNESS_WINDOW_MS,
  requireFreshMfa,
} from './fresh-mfa';

/**
 * ASVS V7.5.1: изменение чувствительных атрибутов учётной записи требует
 * повторной аутентификации.
 */
describe('requireFreshMfa', () => {
  const now = Date.parse('2026-09-07T12:00:00.000Z');
  const fresh = (offsetMs: number) => ({
    mfaVerified: true,
    mfaVerifiedAt: new Date(now - offsetMs).toISOString(),
  });

  it('accepts a factor confirmed inside the window', () => {
    expect(isFreshMfa(fresh(0), now)).toBe(true);
    expect(isFreshMfa(fresh(MFA_FRESHNESS_WINDOW_MS - 1), now)).toBe(true);
    expect(isFreshMfa(fresh(MFA_FRESHNESS_WINDOW_MS), now)).toBe(true);
  });

  it('refuses a factor confirmed before the window', () => {
    expect(isFreshMfa(fresh(MFA_FRESHNESS_WINDOW_MS + 1), now)).toBe(false);
    expect(isFreshMfa(fresh(24 * 60 * 60 * 1000), now)).toBe(false);
  });

  it('refuses a configured but unconfirmed factor', () => {
    // Having MFA set up is not the same as having just used it.
    expect(isFreshMfa({ mfaVerified: false, mfaVerifiedAt: new Date(now).toISOString() }, now)).toBe(false);
    expect(isFreshMfa({ mfaVerifiedAt: new Date(now).toISOString() }, now)).toBe(false);
  });

  it('refuses a timestamp it cannot read as a time', () => {
    // No decision can be made on an unparseable mark, so the answer is no.
    for (const mark of ['', 'yesterday', 'null', undefined]) {
      expect(isFreshMfa({ mfaVerified: true, mfaVerifiedAt: mark as string }, now)).toBe(false);
    }
    expect(isFreshMfa(null, now)).toBe(false);
    expect(isFreshMfa(undefined, now)).toBe(false);
  });

  it('allows only clock skew from the future, not a permanently fresh mark', () => {
    // A timestamp from the future would otherwise never age out of the window.
    expect(isFreshMfa(fresh(-MFA_CLOCK_SKEW_TOLERANCE_MS), now)).toBe(true);
    expect(isFreshMfa(fresh(-(MFA_CLOCK_SKEW_TOLERANCE_MS + 1)), now)).toBe(false);
    expect(isFreshMfa(fresh(-(365 * 24 * 60 * 60 * 1000)), now)).toBe(false);
  });

  it('throws the same code the existing call sites already return', () => {
    // Clients must not be able to tell the new gate from the old ones by code.
    expect(() => requireFreshMfa(fresh(0), now)).not.toThrow();
    try {
      requireFreshMfa(fresh(MFA_FRESHNESS_WINDOW_MS + 1), now);
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'FRESH_MFA_REQUIRED' });
    }
  });

  it('states one window rather than leaving each caller to choose', () => {
    expect(MFA_FRESHNESS_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(MFA_CLOCK_SKEW_TOLERANCE_MS).toBe(30_000);
  });
});
