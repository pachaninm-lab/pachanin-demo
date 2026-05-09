import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleSeeField } from '@/lib/platform-v7/role-access';

describe('platform-v7 visible field rules', () => {
  it('keeps seller away from payment and closed terms fields', () => {
    expect(canPlatformV7RoleSeeField('seller', 'bankDetails').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('seller', 'closedOfferTerms').allowed).toBe(false);
  });

  it('keeps logistics away from payment and closed terms fields', () => {
    expect(canPlatformV7RoleSeeField('logistics', 'bankDetails').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('logistics', 'closedOfferTerms').allowed).toBe(false);
  });

  it('keeps executive away from operational contact and payment fields', () => {
    expect(canPlatformV7RoleSeeField('executive', 'driverContact').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('executive', 'carrierContact').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('executive', 'bankDetails').allowed).toBe(false);
  });
});
