import { describe, expect, it } from 'vitest';
import { platformV7Breadcrumbs, shouldShowPlatformV7Breadcrumbs } from '@/lib/platform-v7/breadcrumbs';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';

const breadcrumbPaths = [
  '/platform-v7/control-tower',
  '/platform-v7/deals/DL-9102',
  '/platform-v7/logistics/TM-9103',
  '/platform-v7/bank/release-safety',
  '/platform-v7/disputes/DK-2024-89',
];

describe('platform-v7 shell model breadcrumbs', () => {
  it('uses breadcrumb registry helpers for shell model breadcrumbs', () => {
    for (const path of breadcrumbPaths) {
      const model = platformV7ShellModel(path, 'buyer');

      expect(model.breadcrumbs).toEqual(platformV7Breadcrumbs(path));
      expect(model.showBreadcrumbs).toBe(shouldShowPlatformV7Breadcrumbs(path));
    }
  });

  it('keeps breadcrumb hrefs inside platform v7 routes', () => {
    for (const path of breadcrumbPaths) {
      const model = platformV7ShellModel(path, 'buyer');

      for (const breadcrumb of model.breadcrumbs) {
        expect(breadcrumb.href.startsWith('/platform-v7')).toBe(true);
        expect(breadcrumb.href.includes('/platform-v4')).toBe(false);
        expect(breadcrumb.href.includes('/platform-v9')).toBe(false);
      }
    }
  });

  it('keeps breadcrumb labels non-empty and last marker singular', () => {
    for (const path of breadcrumbPaths) {
      const model = platformV7ShellModel(path, 'buyer');
      const lastItems = model.breadcrumbs.filter((breadcrumb) => breadcrumb.isLast);

      expect(lastItems).toHaveLength(1);
      for (const breadcrumb of model.breadcrumbs) {
        expect(breadcrumb.label.trim()).not.toBe('');
      }
    }
  });
});
