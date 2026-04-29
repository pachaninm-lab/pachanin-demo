import { describe, expect, it } from 'vitest';
import { platformV7NavItems, platformV7RoleStage } from '@/lib/platform-v7/navigation';

const roles = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'] as const;

describe('platform v7 navigation registry', () => {
  it('wires every role to nav and stage copy', () => {
    for (const role of roles) {
      expect(platformV7NavItems(role).length).toBeGreaterThan(0);
      expect(platformV7RoleStage(role).trim()).not.toBe('');
    }
  });
});
