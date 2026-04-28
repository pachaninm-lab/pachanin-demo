import { describe, expect, it } from 'vitest';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';
import { platformV7Breadcrumbs, shouldShowPlatformV7Breadcrumbs } from '@/lib/platform-v7/breadcrumbs';

const TEST_PATHS = [
  '/platform-v7/control-tower',
  '/platform-v7/deals',
  '/platform-v7/deals/DL-9102',
  '/platform-v7/bank',
  '/platform-v7/disputes/DK-2024-89',
  '/platform-v7/logistics',
  '/platform-v7/compliance',
];

describe('platform-v7 shell model breadcrumbs', () => {
  it('model.breadcrumbs equals platformV7Breadcrumbs(path) for all test paths', () => {
    TEST_PATHS.forEach((path) => {
      const model = platformV7ShellModel(path, 'operator');
      expect(model.breadcrumbs).toEqual(platformV7Breadcrumbs(path));
    });
  });

  it('model.showBreadcrumbs equals shouldShowPlatformV7Breadcrumbs(path)', () => {
    TEST_PATHS.forEach((path) => {
      const model = platformV7ShellModel(path, 'operator');
      expect(model.showBreadcrumbs).toBe(shouldShowPlatformV7Breadcrumbs(path));
    });
  });

  it('showBreadcrumbs is false at /platform-v7 root', () => {
    expect(platformV7ShellModel('/platform-v7', 'operator').showBreadcrumbs).toBe(false);
  });

  it('showBreadcrumbs is false at /platform-v7/roles', () => {
    expect(platformV7ShellModel('/platform-v7/roles', 'operator').showBreadcrumbs).toBe(false);
  });

  it('showBreadcrumbs is true for deep paths', () => {
    expect(platformV7ShellModel('/platform-v7/control-tower', 'operator').showBreadcrumbs).toBe(true);
    expect(platformV7ShellModel('/platform-v7/deals/DL-9102', 'operator').showBreadcrumbs).toBe(true);
  });

  it('all breadcrumb hrefs start with /platform-v7', () => {
    TEST_PATHS.forEach((path) => {
      platformV7ShellModel(path, 'operator').breadcrumbs.forEach((crumb) => {
        expect(crumb.href.startsWith('/platform-v7')).toBe(true);
      });
    });
  });

  it('no breadcrumb href contains platform-v4 or platform-v9', () => {
    TEST_PATHS.forEach((path) => {
      platformV7ShellModel(path, 'operator').breadcrumbs.forEach((crumb) => {
        expect(crumb.href).not.toContain('platform-v4');
        expect(crumb.href).not.toContain('platform-v9');
      });
    });
  });

  it('all breadcrumb labels are non-empty strings', () => {
    TEST_PATHS.forEach((path) => {
      platformV7ShellModel(path, 'operator').breadcrumbs.forEach((crumb) => {
        expect(crumb.label.trim()).not.toBe('');
      });
    });
  });

  it('exactly one breadcrumb per path has isLast === true', () => {
    TEST_PATHS.forEach((path) => {
      const crumbs = platformV7ShellModel(path, 'operator').breadcrumbs;
      const lastCount = crumbs.filter((c) => c.isLast).length;
      expect(lastCount).toBe(1);
    });
  });

  it('the last breadcrumb href equals the full pathname', () => {
    TEST_PATHS.forEach((path) => {
      const crumbs = platformV7ShellModel(path, 'operator').breadcrumbs;
      const last = crumbs.find((c) => c.isLast);
      expect(last?.href).toBe(path);
    });
  });
});
