import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleSeeField } from '@/lib/platform-v7/role-access';

describe('platform-v7 sensitive field boundaries', () => {
  it('keeps buyer away from direct contact and bank fields', () => {
    expect(canPlatformV7RoleSeeField('buyer', 'phone').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('buyer', 'email').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('buyer', 'exactAddress').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('buyer', 'bankDetails').allowed).toBe(false);
  });

  it('keeps driver away from payment and document fields', () => {
    expect(canPlatformV7RoleSeeField('driver', 'bankDetails').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('driver', 'fullDocuments').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('driver', 'responsiblePerson').allowed).toBe(false);
  });

  it('keeps investor away from operational personal data', () => {
    expect(canPlatformV7RoleSeeField('investor', 'phone').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('investor', 'email').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('investor', 'exactAddress').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('investor', 'fullDocuments').allowed).toBe(false);
  });
});
