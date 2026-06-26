import { describe, expect, it } from 'vitest';

import {
  PLATFORM_V7_ROLES,
  platformV7Can,
  platformV7PermissionFor,
} from '../../../src/platform-v7/rbac';

describe('platform-v7 RBAC permission boundary', () => {
  it('defines permissions for every platform role', () => {
    expect(PLATFORM_V7_ROLES).toHaveLength(12);

    for (const role of PLATFORM_V7_ROLES) {
      expect(platformV7Can(role, 'deal.read')).toBe(true);
    }
  });

  it('keeps driver out of money and dispute operations', () => {
    expect(platformV7Can('driver', 'money.read')).toBe(false);
    expect(platformV7Can('driver', 'money.release.request')).toBe(false);
    expect(platformV7Can('driver', 'dispute.write')).toBe(false);
  });

  it('keeps lab scoped to quality operations without money release', () => {
    expect(platformV7Can('lab', 'quality.write')).toBe(true);
    expect(platformV7Can('lab', 'money.release.request')).toBe(false);
    expect(platformV7Can('lab', 'money.basis.review')).toBe(false);
  });

  it('keeps executive as platform readonly', () => {
    expect(platformV7PermissionFor('executive', 'deal.read')?.scope).toBe('platform-readonly');
    expect(platformV7Can('executive', 'deal.write')).toBe(false);
    expect(platformV7Can('executive', 'money.release.request')).toBe(false);
  });

  it('keeps bank on basis review without fake release authority', () => {
    expect(platformV7Can('bank', 'money.basis.review')).toBe(true);
    expect(platformV7Can('bank', 'money.release.request')).toBe(false);
  });
});
