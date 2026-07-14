import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDesignSystemV8Route } from '../../lib/platform-v7/design-system-v8-route-policy';

const absolute = (file: string) => path.join(process.cwd(), file);
const read = (file: string) => fs.readFileSync(absolute(file), 'utf8');
const rootLayout = read('apps/web/app/layout.tsx');
const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const nextConfig = read('apps/web/next.config.js');
const isolatedLanding = read('apps/web/app/pc-public-entry/platform-v7/page.tsx');
const isolatedLogin = read('apps/web/app/pc-public-entry/platform-v7/login/page.tsx');
const isolatedRecovery = read('apps/web/app/pc-public-entry/platform-v7/forgot-password/page.tsx');
const landing = read('apps/web/app/platform-v7/page.tsx');
const loginLayout = read('apps/web/app/platform-v7/login/layout.tsx');
const login = read('apps/web/app/platform-v7/login/page.tsx');
const recovery = read('apps/web/app/platform-v7/forgot-password/page.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const publicLocaleLink = read('apps/web/components/platform-v7/PublicLocaleLink.tsx');
const publicHeaderCss = read('apps/web/styles/platform-v7-public-header.css');
const publicAuthCss = read('apps/web/styles/platform-v7-public-auth.css');
const publicLandingCss = read('apps/web/styles/platform-v7-public-landing.css');
const fixedHeaderCss = read('apps/web/app/platform-v7/_styles/fixed-header-contract.css');
const supportingShellCss = read('apps/web/app/platform-v7/_styles/public-supporting-shell.css');

const removedRuntimes = [
  'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx',
];

function extractExactAliases(): Set<string> {
  const block = layout.match(/const ALIAS_EXACT_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
  return new Set([...block.matchAll(/'([^']+)'/g)].map((match) => match[1]));
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

describe('platform-v7 public/protected runtime split', () => {
  it('resolves public paths without creating a legacy client style tree', () => {
    expect(layout).toContain("from 'next/headers'");
    expect(layout).toContain("headers().get('x-pc-pathname')");
    expect(layout).toContain('if (pathname === LANDING_PATH || AUTH_PATHS.has(pathname)) return children');
    expect(layout).toContain('if (isPublicPath(pathname))');
    expect(layout).toContain('<PlatformV7PublicPageShell>{children}</PlatformV7PublicPageShell>');
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout).not.toContain('PlatformV7FullStyleRuntime');
    expect(layout).not.toContain('PlatformV7ShellSwitch');
  });

  it('fails unknown routes closed before login, RBAC and shell creation', () => {
    expect(layout).toContain("import { notFound, redirect } from 'next/navigation'");
    expect(layout).toContain('if (!isKnownProtectedPath(pathname)) notFound()');
    expect(layout.indexOf('if (!isKnownProtectedPath(pathname)) notFound()')).toBeLessThan(
      layout.indexOf('const role = await verifiedCabinetRole()'),
    );
    expect(layout).toContain('ALIAS_EXACT_PATHS');
    expect(layout).toContain('ALIAS_DYNAMIC_PATHS');
    expect(layout).toContain("'/platform-v7/support'");
    expect(layout).toContain('/^\\/platform-v7\\/support\\/[^/]+$/');
  });

  it('keeps the alias allowlist synchronized with server redirect pages', () => {
    const exactAliases = extractExactAliases();
    const dynamicAliases = extractDynamicAliases();
    const redirectRoutes = walkPages(absolute('apps/web/app/platform-v7'))
      .filter((pagePath) => /\bredirect\s*\(/.test(fs.readFileSync(pagePath, 'utf8')))
      .map(routeFromPage);

    for (const route of redirectRoutes) {
      const sample = sampleRoute(route);
      const covered = isDesignSystemV8Route(sample)
        || exactAliases.has(route)
        || dynamicAliases.some((pattern) => pattern.test(sample));
      expect(covered, `redirect route is absent from fail-closed policy: ${route}`).toBe(true);
    }
  });

  it('rewrites only the three public entry URLs into a physically isolated route tree', () => {
    expect(nextConfig).toContain("{ source: '/platform-v7', destination: '/pc-public-entry/platform-v7' }");
    expect(nextConfig).toContain("{ source: '/platform-v7/login', destination: '/pc-public-entry/platform-v7/login' }");
    expect(nextConfig).toContain("{ source: '/platform-v7/forgot-password', destination: '/pc-public-entry/platform-v7/forgot-password' }");
    expect(isolatedLanding).toContain("from '@/app/platform-v7/page'");
    expect(isolatedLogin).toContain("from '@/app/platform-v7/login/page'");
    expect(isolatedRecovery).toContain("from '@/app/platform-v7/forgot-password/page'");
  });

  it('keeps the route template server-only and free of historical patching', () => {
    expect(template).toContain('return children');
    expect(template).not.toContain("'use client'");
    expect(template).not.toContain('PlatformV7ProtectedTemplateRuntime');
    expect(template).not.toContain('PlatformV7TemplateGuards');
  });

  it('does not preload or activate protected font variables on lean public entry routes', () => {
    expect(rootLayout.match(/preload: false/g)?.length).toBe(3);
    expect(rootLayout).toContain("const fontVariables = leanPublicEntry ? '' : `${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`;");
    expect(rootLayout).toContain("className={`notranslate${fontVariables ? ` ${fontVariables}` : ''}`}");
  });

  it('keeps protected providers and shell in the protected-only runtime', () => {
    expect(protectedRuntime).toContain('<ToastProvider>');
    expect(protectedRuntime).toContain('<PlatformThemeSync />');
    expect(protectedRuntime).toContain('<PlatformV7ProtectedShell pathname={pathname} verifiedRole={verifiedRole}>');
    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(protectedShell).toContain('<PlatformV7SingleEntryGuard />');
    expect(protectedShell).toContain('<RbacCabinetGuard />');
  });

  it('uses server-rendered locale navigation on public entry routes', () => {
    expect(publicLocaleLink).not.toContain("'use client'");
    expect(publicLocaleLink).toContain("getTranslations('publicEntry.language')");
    expect(publicLocaleLink).toContain('href={`${pathname}?lang=${next}`}');
    expect(landing).toContain('localeControl={<PublicLocaleLink />}');
    expect(login).toContain('localeControl={<PublicLocaleLink />}');
    expect(recovery).toContain('localeControl={<PublicLocaleLink />}');
    expect(publicHeader).toContain("<a href='/platform-v7' className='pc-site-brand'");
  });

  it('loads public CSS from concrete routes instead of a universal runtime bundle', () => {
    expect(rootLayout).not.toContain('platform-v7-dark-role-fixes.css');
    expect(layout).not.toContain("import '@/styles/");
    expect(template).not.toContain("import '@/styles/");
    expect(landing).toContain("import '@/styles/platform-v7-public-header.css'");
    expect(landing).toContain("import '@/styles/platform-v7-public-landing.css'");
    expect(loginLayout).toContain("import '@/styles/platform-v7-public-auth.css'");
    expect(recovery).toContain("import '@/styles/platform-v7-public-auth.css'");
    expect(publicHeaderCss).toContain('.pc-site-header');
    expect(publicAuthCss).toContain('.pc-auth-page');
    expect(publicLandingCss).toContain('.pc-v7-public-entry');
    for (const runtime of removedRuntimes) expect(fs.existsSync(absolute(runtime))).toBe(false);
  });

  it('keeps the fixed-header contract static and removes runtime measurement', () => {
    expect(rootLayout).toContain("import './platform-v7/_styles/fixed-header-contract.css'");
    expect(rootLayout).toContain("import './platform-v7/_styles/public-supporting-shell.css'");
    expect(fixedHeaderCss).toContain('.pc-site-header');
    expect(fixedHeaderCss).toContain('[data-staff-platform-shell] > header');
    expect(fixedHeaderCss).toContain('env(safe-area-inset-top, 0px)');
    expect(supportingShellCss).toContain('[data-public-supporting-shell]');
    expect(layout).not.toContain('ResizeObserver');
    expect(layout).not.toContain('MutationObserver');
    expect(layout).not.toContain('visualViewport');
  });
});
