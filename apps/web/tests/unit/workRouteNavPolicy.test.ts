import { describe, expect, it } from 'vitest';
import { canShowWorkRouteNav } from '@/components/platform-v7/WorkRouteNav';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const staleRoles: PlatformRole[] = ['driver', 'seller', 'buyer', 'bank', 'logistics', 'compliance'];

describe('platform-v7 work route nav policy', () => {
  it('keeps broad work nav retired on operator routes regardless of stored role', () => {
    for (const staleRole of staleRoles) {
      expect(canShowWorkRouteNav(staleRole, '/platform-v7/control-tower')).toBe(false);
    }
  });

  it('keeps broad work nav retired on executive routes regardless of stored role', () => {
    for (const staleRole of staleRoles) {
      expect(canShowWorkRouteNav(staleRole, '/platform-v7/executive')).toBe(false);
    }
  });

  it('keeps role-scoped and field routes free from broad work nav', () => {
    for (const path of ['/platform-v7/seller', '/platform-v7/buyer', '/platform-v7/logistics', '/platform-v7/bank', '/platform-v7/driver/field', '/platform-v7/elevator', '/platform-v7/lab', '/platform-v7/surveyor']) {
      expect(canShowWorkRouteNav('operator', path)).toBe(false);
    }
  });
});
