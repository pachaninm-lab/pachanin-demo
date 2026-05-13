import { describe, expect, it } from 'vitest';
import { canShowWorkRouteNav } from '@/components/platform-v7/WorkRouteNav';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const staleRoles: PlatformRole[] = ['driver', 'seller', 'buyer', 'bank', 'logistics', 'compliance'];

describe('platform-v7 work route nav policy', () => {
  it('shows broad work nav on operator routes even when stored role is stale', () => {
    for (const staleRole of staleRoles) {
      expect(canShowWorkRouteNav(staleRole, '/platform-v7/control-tower')).toBe(true);
    }
  });

  it('shows broad work nav on executive routes even when stored role is stale', () => {
    for (const staleRole of staleRoles) {
      expect(canShowWorkRouteNav(staleRole, '/platform-v7/executive')).toBe(true);
    }
  });

  it('keeps role-scoped and field routes free from broad work nav', () => {
    for (const path of ['/platform-v7/seller', '/platform-v7/buyer', '/platform-v7/logistics', '/platform-v7/bank', '/platform-v7/driver/field', '/platform-v7/elevator', '/platform-v7/lab', '/platform-v7/surveyor']) {
      expect(canShowWorkRouteNav('operator', path)).toBe(false);
    }
  });
});
