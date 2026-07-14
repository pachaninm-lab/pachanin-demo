import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const controlTower = read('apps/web/app/platform-v7/control-tower/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const knownRoutePolicy = read('apps/web/lib/platform-v7/known-route-policy.ts');
const v8Runtime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');
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
  '/platform-v7/control-tower',
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
  it('registers all twelve role roots and accepted transaction routes in one server-safe policy', () => {
    for (const role of roleRoutes) expect(routePolicy).toContain(`'/platform-v7/${role}'`);
    for (const route of criticalRoutes) expect(routePolicy).toContain(`'${route}'`);
    expect(routePolicy).toContain("'/platform-v7/deals/'");
    expect(routePolicy).toContain("'/platform-v7/auction'");
    expect(routePolicy).toContain('isDesignSystemV8Route');
    expect(routePolicy).not.toContain("'use client'");
    expect(routePolicy).not.toContain('window.');
    expect(routePolicy).not.toContain('document.');
  });

  it('fails unknown routes closed before authentication and mounts only the governed protected runtime', () => {
    expect(layout).toContain("from 'next/navigation'");
    expect(layout).toContain('notFound');
    expect(layout).toContain("from '@/lib/platform-v7/known-route-policy'");
    expect(layout).toContain('if (!isKnownPlatformV7Route(pathname)) notFound()');
    expect(layout.indexOf('if (!isKnownPlatformV7Route(pathname)) notFound()')).toBeLessThan(
      layout.indexOf('const role = await verifiedCabinetRole()'),
    );
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime')");
    expect(layout).toContain('<PlatformV7DesignSystemV8Runtime>{protectedContent}</PlatformV7DesignSystemV8Runtime>');
    expect(layout).not.toContain('PlatformV7FullStyleRuntime');
    expect(knownRoutePolicy).toContain('isKnownPlatformV7Route');
    expect(knownRoutePolicy).toContain('PLATFORM_V7_DYNAMIC_ROUTES');
  });

  it('keeps the route template free of historical DOM and style repair runtimes', () => {
    expect(template).toContain('return children');
    expect(template).not.toContain('headers()');
    expect(template).not.toContain('PlatformV7ProtectedTemplateRuntime');
    expect(template).not.toContain('PlatformV7TemplateGuards');
    expect(template).not.toContain('MutationObserver');
    expect(template).not.toContain('ResizeObserver');
  });

  it('keeps the governed runtime token-only and free of DOM/style repair code', () => {
    expect(v8Runtime).toContain('packages/design-tokens/tokens.css');
    expect(v8Runtime).toContain('<ChatSupportWidget />');
    expect(v8Runtime).not.toContain('PlatformV7FullStyleRuntime');
    expect(v8Runtime).not.toContain('PlatformV7TemplateGuards');
    expect(v8Runtime).not.toContain('MutationObserver');
    expect(v8Runtime).not.toContain('ResizeObserver');
    expect(v8Runtime).not.toContain('setInterval');
    expect(v8Runtime).not.toContain('setTimeout');
    expect(v8Runtime).not.toContain('<style');
    expect(v8Runtime).not.toContain('@/styles/');
  });

  it('keeps one canonical role-safe operator or executive workspace instead of a duplicate synthetic cockpit', () => {
    expect(controlTower).toContain('readVerifiedCabinetSessionRole');
    expect(controlTower).toContain('readVerifiedCabinetRole');
    expect(controlTower).toContain("role === 'executive'");
    expect(controlTower).toContain("redirect('/platform-v7/executive')");
    expect(controlTower).toContain("redirect('/platform-v7/operator')");
    expect(controlTower).not.toContain('selectRuntimeDeals');
    expect(controlTower).not.toContain('canonicalDomainDeals');
    expect(controlTower).not.toContain('ControlTowerCharts');
    expect(controlTower).not.toContain('dangerouslySetInnerHTML');
    expect(controlTower).not.toContain('style=');
    expect(controlTower).not.toContain('useSearchParams');
    expect(controlTower).not.toContain('localStorage');
  });

  it('prevents root compatibility CSS from overriding the governed AppShell module', () => {
    expect(fixedHeaderContract).not.toContain('.pc-v4-header');
    expect(fixedHeaderContract).not.toContain('.pc-shell-root-v4');
    expect(fixedHeaderContract).toContain('.pc-site-header');
    expect(fixedHeaderContract).toContain('[data-staff-platform-shell]');
  });
});
