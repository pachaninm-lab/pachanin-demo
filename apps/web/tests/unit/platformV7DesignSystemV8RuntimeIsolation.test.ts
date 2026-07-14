import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const v8Runtime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');
const legacyRuntime = read('apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx');
const legacyTemplate = read('apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx');
const fixedHeaderContract = read('apps/web/app/platform-v7/_styles/fixed-header-contract.css');

const roleRoutes = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'compliance',
  'arbitrator',
  'executive',
];

const criticalRoutes = [
  '/platform-v7/deals',
  '/platform-v7/documents',
  '/platform-v7/disputes',
  '/platform-v7/money',
  '/platform-v7/bank/release-safety',
  '/platform-v7/fgis-access',
  '/platform-v7/deal-logistics',
  '/platform-v7/deal-acceptance',
  '/platform-v7/deal-documents-basis',
];

describe('platform-v7 Design System v8 runtime isolation', () => {
  it('registers all twelve role roots and the accepted transaction routes in one server-safe policy', () => {
    for (const role of roleRoutes) expect(routePolicy).toContain(`'/platform-v7/${role}'`);
    for (const route of criticalRoutes) expect(routePolicy).toContain(`'${route}'`);
    expect(routePolicy).toContain("'/platform-v7/deals/'");
    expect(routePolicy).toContain("'/platform-v7/auction'");
    expect(routePolicy).toContain('isDesignSystemV8Route');
    expect(routePolicy).not.toContain("'use client'");
    expect(routePolicy).not.toContain('window.');
    expect(routePolicy).not.toContain('document.');
  });

  it('selects the minimal v8 style/runtime boundary on the server after verified role enforcement', () => {
    expect(layout).toContain("from '@/lib/platform-v7/design-system-v8-route-policy'");
    expect(layout).toContain('if (isDesignSystemV8Route(pathname))');
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime')");
    expect(layout).toContain('<PlatformV7DesignSystemV8Runtime>{protectedContent}</PlatformV7DesignSystemV8Runtime>');
    expect(layout.indexOf('if (!role) redirect')).toBeLessThan(layout.indexOf('if (isDesignSystemV8Route(pathname))'));
    expect(layout.indexOf('if (isDesignSystemV8Route(pathname))')).toBeLessThan(
      layout.lastIndexOf("await import('@/components/platform-v7/PlatformV7FullStyleRuntime')"),
    );
  });

  it('does not mount legacy template guards on governed routes', () => {
    expect(template).toContain("from '@/lib/platform-v7/design-system-v8-route-policy'");
    expect(template).toContain('isDesignSystemV8Route(pathname)');
    expect(template).toContain('return children');
    expect(template.indexOf('isDesignSystemV8Route(pathname)')).toBeLessThan(
      template.indexOf("await import('@/components/platform-v7/PlatformV7ProtectedTemplateRuntime')"),
    );
    expect(legacyTemplate).toContain('PlatformV7TemplateGuards');
  });

  it('keeps the governed runtime token-only and free of DOM/style repair code', () => {
    expect(v8Runtime).toContain("packages/design-tokens/tokens.css");
    expect(v8Runtime).toContain('<ChatSupportWidget />');
    expect(v8Runtime).not.toContain('PlatformV7FullStyleRuntime');
    expect(v8Runtime).not.toContain('PlatformV7TemplateGuards');
    expect(v8Runtime).not.toContain('MutationObserver');
    expect(v8Runtime).not.toContain('ResizeObserver');
    expect(v8Runtime).not.toContain('setInterval');
    expect(v8Runtime).not.toContain('setTimeout');
    expect(v8Runtime).not.toContain('<style');
    expect(v8Runtime).not.toContain("@/styles/");
    expect(legacyRuntime).toContain("@/styles/platform-v7-final-polish.css");
  });

  it('prevents root compatibility CSS from overriding the governed AppShell module', () => {
    expect(fixedHeaderContract).not.toContain('.pc-v4-header');
    expect(fixedHeaderContract).not.toContain('.pc-shell-root-v4');
    expect(fixedHeaderContract).toContain('.pc-site-header');
    expect(fixedHeaderContract).toContain('[data-staff-platform-shell]');
  });
});
