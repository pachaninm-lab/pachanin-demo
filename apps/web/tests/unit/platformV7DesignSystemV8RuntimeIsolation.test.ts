import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDesignSystemV8Route } from '../../lib/platform-v7/design-system-v8-route-policy';

const root = process.cwd();
const absolute = (relativePath: string) => path.join(root, relativePath);
const read = (relativePath: string) => fs.readFileSync(absolute(relativePath), 'utf8');

const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const controlTower = read('apps/web/app/platform-v7/control-tower/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const v8Runtime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');
const fixedHeaderContract = read('apps/web/app/platform-v7/_styles/fixed-header-contract.css');

const removedRuntimeFiles = [
  'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx',
  'apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx',
  'apps/web/components/platform-v7/PlatformV7ProductionCopyPatch.tsx',
  'apps/web/components/platform-v7/PlatformV7ScrollRestorationGuard.tsx',
];

const roleRoutes = [
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'elevator',
  'lab', 'surveyor', 'bank', 'compliance', 'arbitrator', 'executive',
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

function quotedRoutes(block: string): string[] {
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function extractPublicPolicy(): { exact: Set<string>; prefixes: string[] } {
  const exactBlock = layout.match(/const PUBLIC_EXACT_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
  const prefixBlock = layout.match(/const PUBLIC_PREFIX_PATHS = \[([\s\S]*?)\];/)?.[1] ?? '';
  return {
    exact: new Set([
      '/platform-v7',
      '/platform-v7/login',
      '/platform-v7/forgot-password',
      ...quotedRoutes(exactBlock),
    ]),
    prefixes: quotedRoutes(prefixBlock),
  };
}

function extractStaffPrefix(): string {
  return layout.match(/const STAFF_PREFIX = '([^']+)'/)?.[1] ?? '';
}

function extractExactAliases(): Set<string> {
  const block = layout.match(/const ALIAS_EXACT_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
  return new Set(quotedRoutes(block));
}

function extractDynamicAliases(): RegExp[] {
  const block = layout.match(/const ALIAS_DYNAMIC_PATHS = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
  return block
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => line.startsWith('/^') && line.endsWith('/'))
    .map((line) => new RegExp(line.slice(1, -1)));
}

function walkPages(directory: string, output: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) walkPages(child, output);
    else if (entry.isFile() && entry.name === 'page.tsx') output.push(child);
  }
  return output;
}

function routeFromPage(pagePath: string): string {
  const appRoot = absolute('apps/web/app/platform-v7');
  const segments = path.relative(appRoot, pagePath).split(path.sep);
  segments.pop();
  const routeSegments = segments.filter((segment) => !/^\(.+\)$/.test(segment) && !segment.startsWith('@'));
  return ['/platform-v7', ...routeSegments].join('/').replace(/\/$/, '') || '/platform-v7';
}

function sampleRoute(route: string): string {
  return route.replace(/\[[^/]+\]/g, 'sample-id');
}

function matchesPrefix(route: string, prefix: string): boolean {
  return Boolean(prefix) && (route === prefix || route.startsWith(`${prefix}/`));
}

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

  it('fails unknown paths before auth and selects the v8 boundary only after verified role enforcement', () => {
    expect(layout).toContain("from '@/lib/platform-v7/design-system-v8-route-policy'");
    expect(layout).toContain('if (!isKnownProtectedPath(pathname)) notFound()');
    expect(layout).toContain('if (!role) redirect');
    expect(layout).toContain('if (!canRoleAccessCabinet(role, pathname))');
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime')");
    expect(layout).toContain('<PlatformV7DesignSystemV8Runtime>{protectedContent}</PlatformV7DesignSystemV8Runtime>');
    expect(layout).toContain('if (!isDesignSystemV8Route(pathname)) return protectedContent');
    expect(layout.indexOf('if (!isKnownProtectedPath(pathname)) notFound()')).toBeLessThan(
      layout.indexOf('if (!role) redirect'),
    );
    expect(layout.indexOf('if (!role) redirect')).toBeLessThan(
      layout.indexOf('if (!isDesignSystemV8Route(pathname)) return protectedContent'),
    );
    expect(layout).not.toContain('PlatformV7FullStyleRuntime');
  });

  it('keeps every server redirect route reachable through an explicit route class', () => {
    const publicPolicy = extractPublicPolicy();
    const staffPrefix = extractStaffPrefix();
    const exactAliases = extractExactAliases();
    const dynamicAliases = extractDynamicAliases();
    const redirectRoutes = walkPages(absolute('apps/web/app/platform-v7'))
      .filter((pagePath) => /\bredirect\s*\(/.test(fs.readFileSync(pagePath, 'utf8')))
      .map(routeFromPage);

    expect(staffPrefix).toBe('/platform-v7/staff');

    for (const route of redirectRoutes) {
      const sample = sampleRoute(route);
      const publicRoute = publicPolicy.exact.has(route)
        || publicPolicy.prefixes.some((prefix) => matchesPrefix(sample, prefix));
      const covered = publicRoute
        || matchesPrefix(sample, staffPrefix)
        || isDesignSystemV8Route(sample)
        || exactAliases.has(route)
        || dynamicAliases.some((pattern) => pattern.test(sample));
      expect(covered, `redirect route is absent from route policy: ${route}`).toBe(true);
    }
  });

  it('keeps the route template free of client guards and mutation repair', () => {
    expect(template).toContain('return children');
    expect(template).not.toContain("'use client'");
    expect(template).not.toContain('headers()');
    expect(template).not.toContain('PlatformV7ProtectedTemplateRuntime');
    expect(template).not.toContain('PlatformV7TemplateGuards');
  });

  it('physically removes historical runtime, copy-repair and scroll-polling files', () => {
    for (const file of removedRuntimeFiles) expect(fs.existsSync(absolute(file))).toBe(false);
  });

  it('keeps the governed runtime token-only, hydration-safe and free of DOM/style repair code', () => {
    expect(v8Runtime).toContain('packages/design-tokens/tokens.css');
    expect(v8Runtime).not.toContain('<HydrationSafeChatSupport />');
    expect(v8Runtime).not.toContain('<ChatSupportWidget />');
    expect(v8Runtime).not.toContain('PlatformV7FullStyleRuntime');
    expect(v8Runtime).not.toContain('PlatformV7TemplateGuards');
    expect(v8Runtime).not.toContain('MutationObserver');
    expect(v8Runtime).not.toContain('ResizeObserver');
    expect(v8Runtime).not.toContain('setInterval');
    expect(v8Runtime).not.toContain('setTimeout');
    expect(v8Runtime).not.toContain('<style');
    expect(v8Runtime).not.toContain('@/styles/');
  });

  it('keeps one canonical role-safe operator or executive workspace', () => {
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
