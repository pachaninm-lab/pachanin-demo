import { describe, expect, it } from 'vitest';

import {
  shouldFallbackToLoginAfterPlain,
  smtpSecurityForPort,
} from '@/lib/server/transactional-mail';

describe('transactional SMTP transport security', () => {
  it('keeps implicit TLS on the canonical SMTPS port', () => {
    expect(smtpSecurityForPort(465)).toBe('implicit-tls');
  });

  it('uses STARTTLS on the canonical submission port', () => {
    expect(smtpSecurityForPort(587)).toBe('starttls');
  });

  it('fails closed for unapproved SMTP ports', () => {
    expect(smtpSecurityForPort(25)).toBeNull();
    expect(smtpSecurityForPort(2525)).toBeNull();
  });

  it('falls back to LOGIN only after explicit PLAIN credential rejection', () => {
    expect(shouldFallbackToLoginAfterPlain(535)).toBe(true);
    expect(shouldFallbackToLoginAfterPlain(454)).toBe(false);
    expect(shouldFallbackToLoginAfterPlain(500)).toBe(false);
  });
});
