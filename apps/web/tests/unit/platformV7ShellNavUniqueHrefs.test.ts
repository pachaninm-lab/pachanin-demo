import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';

const rolePaths: Array<{ role: PlatformRole; path: string }> = [
  { role: 'operator', path: '/platform-v7/control-tower' },
  { role: 'buyer', path: '/platform-v7/buyer' },
  { role: 'seller', path: '/platform-v7/seller' },
  { role: 'logistics', path: '/platform-v7/logistics' },
  { role: 'driver', path: '/platform-v7/driver' },
  { role: 'surveyor', path: '/platform-v7/surveyor' },
  { role: 'elevator', path: '/platform-v7/elevator' },
  { role: 'lab', path: '/platform-v7/lab' },
  { role: 'bank', path: '/platform-v7/bank' },
  { role: 'arbitrator', path: '/platform-v7/arbitrator' },
  { role: 'compliance', path: '/platform-v7/compliance' },
  { role: 'executive', path: '/platform-v7/executive' },
];

describe('platform-v7 shell nav unique hrefs', () => {
  it('keeps nav hrefs unique inside every role menu', () => {
    for (const { role, path } of rolePaths) {
      const model = platformV7ShellModel(path, role);
      const hrefs = model.navItems.map((item) => item.href);

      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});
