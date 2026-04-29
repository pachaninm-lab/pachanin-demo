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

const hiddenBreadcrumbPaths = ['/platform-v7', '/platform-v7/roles'];

describe('platform-v7 shell model breadcrumbs', () => {
  it('uses breadcrumb registry helpers for shell model breadcrumbs', () => {
    for (const path of breadcrumbPaths) {
      const model = platformV7ShellModel(path, 'buyer');

      expect(model.breadcrumbs).toEqual(platformV7Breadcrumbs(path));
      expect(model.showBreadcrumbs).toBe(shouldShowPlatformV7Breadcrumbs(path));
    }
  });

  it('hides breadcrumbs on root and roles index paths', () => {
    for (const path of hiddenBreadcrumbPaths) {
      const model = platformV7ShellModel(path, 'buyer');

      expect(model.showBreadcrumbs).toBe(false);
      expect(shouldShowPlatformV7Breadcrumbs(path)).toBe(false);
    }
  });

  it('shows breadcrumbs on deep shell paths', () => {
    for (const path of breadcrumbPaths) {
      const model = platformV7ShellModel(path, 'buyer');

      expect(model.showBreadcrumbs).toBe(true);
      expect(shouldShowPlatformV7Breadcrumbs(path)).toBe(true);
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
      expect(lastItems[0]?.href).toBe(path);
      for (const breadcrumb of model.breadcrumbs) {
        expect(breadcrumb.label.trim()).not.toBe('');
      }
    }
  });

  it('strips query and hash from breadcrumb hrefs', () => {
    const breadcrumbs = platformV7Breadcrumbs('/platform-v7/deals/DL-9102?tab=docs#trail');

    expect(breadcrumbs.at(-1)?.href).toBe('/platform-v7/deals/DL-9102');
  });
});
