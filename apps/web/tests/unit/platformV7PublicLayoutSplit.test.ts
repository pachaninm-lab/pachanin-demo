import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const absolute = (file: string) => path.join(process.cwd(), file);
const read = (file: string) => fs.readFileSync(absolute(file), 'utf8');
const rootLayout = read('apps/web/app/layout.tsx');
const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const nextConfig = read('apps/web/next.config.js');
const isolatedLayout = read('apps/web/app/pc-public-entry/platform-v7/layout.tsx');
const isolatedLanding = read('apps/web/app/pc-public-entry/platform-v7/page.tsx');
const approvedHomeDock = read('apps/web/app/pc-public-entry/platform-v7/home-approved-contact-dock.css');
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

const removedRuntimes = [
  'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx',
  'apps/web/components/platform-v7/PlatformV7PublicRuntime.tsx',
];

const publicSupportingShellCss = 'apps/web/app/platform-v7/_styles/public-supporting-shell.css';

describe('platform-v7 public/protected runtime split', () => {
  it('returns public route content without creating a universal client or supporting shell', () => {
    expect(layout).toContain("from 'next/headers'");
    expect(layout).toContain("(await headers()).get('x-pc-pathname')");
    expect(layout).toContain('if (isPublicPath(pathname)) {');
    expect(layout).toContain('<HydrationSafeChatSupport />');
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout).not.toContain('PlatformV7PublicPageShell');
    expect(layout).not.toContain("from '@/components/platform-v7/PublicSiteHeader'");
    expect(layout).not.toContain('PlatformV7FullStyleRuntime');
    expect(layout).not.toContain('PlatformV7ShellSwitch');
  });

  it('fails unknown protected paths closed before auth, RBAC or role shell creation', () => {
    expect(layout).toContain('function isKnownProtectedPath(value: string)');
    expect(layout).toContain('ALIAS_EXACT_PATHS.has(value)');
    expect(layout).toContain('ALIAS_DYNAMIC_PATHS.some((pattern) => pattern.test(value))');
    expect(layout).toContain('if (!isKnownProtectedPath(pathname)) notFound();');
    expect(layout.indexOf('if (!isKnownProtectedPath(pathname)) notFound();'))
      .toBeLessThan(layout.indexOf('const role = await verifiedCabinetRole();'));
    expect(layout.indexOf('if (!isKnownProtectedPath(pathname)) notFound();'))
      .toBeLessThan(layout.indexOf("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')"));
  });

  it('rewrites only the three public entry URLs into a physically isolated route tree', () => {
    expect(nextConfig).toContain("{ source: '/platform-v7', destination: '/pc-public-entry/platform-v7' }");
    expect(nextConfig).toContain("{ source: '/platform-v7/login', destination: '/pc-public-entry/platform-v7/login' }");
    expect(nextConfig).toContain("{ source: '/platform-v7/forgot-password', destination: '/pc-public-entry/platform-v7/forgot-password' }");
    expect(isolatedLanding).toContain("import './home-approved-contact-dock.css'");
    expect(isolatedLanding).toContain("from '@/app/platform-v7/page'");
    expect(isolatedLanding).toContain("data-contact-dock-visual='approved'");
    expect(isolatedLogin).toContain("from '@/app/platform-v7/login/page'");
    expect(isolatedRecovery).toContain("from '@/app/platform-v7/forgot-password/page'");
    expect(isolatedLayout).toContain('<HydrationSafeChatSupport />');
  });

  it('restores only the last approved contact dock visual on the public homepage', () => {
    expect(approvedHomeDock).toContain("[data-contact-dock-visual='approved']");
    expect(approvedHomeDock).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(approvedHomeDock).toContain('width: min(390px');
    expect(approvedHomeDock).toContain('border: 1px solid rgba(8, 122, 59, .42)');
    expect(approvedHomeDock).toContain('border-radius: 20px');
    expect(approvedHomeDock).toContain('min-height: 54px');
    expect(approvedHomeDock).toContain('min-height: 52px');
    expect(approvedHomeDock).toContain('width: 30px');
    expect(approvedHomeDock).toContain('width: 28px');
    expect(approvedHomeDock).toContain('font-size: 12.5px');
    expect(approvedHomeDock).toContain('font-size: 11.5px');
    expect(approvedHomeDock).toContain('bottom: max(2px, calc(env(safe-area-inset-bottom, 0px) + 2px))');
    expect(approvedHomeDock).toContain('.pc-public-contact-dock-assistant strong');
    expect(approvedHomeDock).toContain('color: inherit');
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
    expect(protectedShell).toContain('<AppShellV4 initialRole={verifiedRole}>');
    expect(protectedShell).toContain('<PlatformV7SingleEntryGuard />');
    expect(protectedShell).toContain('<RbacCabinetGuard />');
  });

  it('uses server-rendered locale navigation on isolated public entry routes', () => {
    expect(publicLocaleLink).not.toContain("'use client'");
    expect(publicLocaleLink).toContain("getTranslations('publicEntry.language')");
    expect(publicLocaleLink).toContain('href={`${pathname}?lang=${next}`}');
    expect(landing).toContain('localeControl={<PublicLocaleLink />}');
    expect(login).toContain('localeControl={<PublicLocaleLink />}');
    expect(recovery).toContain('localeControl={<PublicLocaleLink />}');
    expect(publicHeader).toContain("<a href='/platform-v7' className='pc-site-brand'");
  });

  it('loads entry CSS from concrete routes and keeps the shared supporting-page contract explicit', () => {
    expect(rootLayout).not.toContain('platform-v7-dark-role-fixes.css');
    expect(rootLayout).toContain("import './platform-v7/_styles/public-supporting-shell.css'");
    expect(layout).not.toContain("import '@/styles/");
    expect(template).not.toContain("import '@/styles/");
    expect(landing).toContain("import '@/styles/platform-v7-public-header.css'");
    expect(landing).toContain("import '@/styles/platform-v7-public-product-experience-v5.css'");
    expect(loginLayout).toContain("import '@/styles/platform-v7-public-auth.css'");
    expect(recovery).toContain("import '@/styles/platform-v7-public-auth.css'");
    expect(publicHeaderCss).toContain('.pc-site-header');
    expect(publicAuthCss).toContain('.pc-auth-page');
    expect(publicLandingCss).toContain('.pc-v7-public-entry');
    expect(fs.existsSync(absolute(publicSupportingShellCss))).toBe(true);
    for (const runtime of removedRuntimes) expect(fs.existsSync(absolute(runtime))).toBe(false);
  });

  it('keeps the remaining fixed-header contract static and free of runtime measurement', () => {
    expect(rootLayout).toContain("import './platform-v7/_styles/fixed-header-contract.css'");
    expect(fixedHeaderCss).toContain('.pc-site-header');
    expect(fixedHeaderCss).toContain('[data-staff-platform-shell] > header');
    expect(fixedHeaderCss).toContain('env(safe-area-inset-top, 0px)');
    expect(layout).not.toContain('ResizeObserver');
    expect(layout).not.toContain('MutationObserver');
    expect(layout).not.toContain('visualViewport');
  });
});
