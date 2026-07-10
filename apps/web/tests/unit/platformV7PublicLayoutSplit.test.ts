import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const rootLayout = read('apps/web/app/layout.tsx');
const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const landingStyles = read('apps/web/app/platform-v7/_styles/landing.ts');
const authStyles = read('apps/web/app/platform-v7/_styles/auth.ts');
const fullPlatformStyles = read('apps/web/app/platform-v7/_styles/full-platform.ts');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const landing = read('apps/web/app/platform-v7/page.tsx');
const login = read('apps/web/app/platform-v7/login/page.tsx');
const loginClient = read('apps/web/app/platform-v7/login/LoginFormClient.tsx');
const recovery = read('apps/web/app/platform-v7/forgot-password/page.tsx');
const recoveryClient = read('apps/web/app/platform-v7/forgot-password/ForgotPasswordFormClient.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const publicLocaleLink = read('apps/web/components/platform-v7/PublicLocaleLink.tsx');
const brandMark = read('apps/web/components/v7r/BrandMark.tsx');
const intelligenceStrip = read('apps/web/components/v7r/PlatformV7IntelligenceStrip.tsx');
const publicHeaderCss = read('apps/web/styles/platform-v7-public-header.css');
const publicAuthCss = read('apps/web/styles/platform-v7-public-auth.css');
const publicLandingCss = read('apps/web/styles/platform-v7-public-landing.css');
const middleware = read('apps/web/middleware.ts');

describe('platform-v7 public/protected runtime split', () => {
  it('resolves public paths before creating the protected client tree', () => {
    expect(layout).toContain("from 'next/headers'");
    expect(layout).toContain("headers().get('x-pc-pathname')");
    expect(layout).toContain("await import('./_styles/landing')");
    expect(layout).toContain("await import('./_styles/auth')");
    expect(layout).toContain("await import('./_styles/full-platform')");
    expect(layout).toContain('if (isPublicPath(pathname)) return children');
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout.indexOf("await import('./_styles/landing')")).toBeLessThan(layout.indexOf("await import('./_styles/full-platform')"));
    expect(layout.indexOf("await import('./_styles/auth')")).toBeLessThan(layout.indexOf("await import('./_styles/full-platform')"));
    expect(layout).not.toContain('PlatformV7ShellSwitch');
    expect(layout).not.toContain('ToastProvider');
    expect(layout).not.toContain('PlatformThemeSync');
  });

  it('does not wrap target public routes in client providers or templates', () => {
    expect(rootLayout).toContain('LEAN_PUBLIC_ENTRY_PATHS');
    expect(rootLayout).toContain('leanPublicEntry\n    ? children');
    expect(rootLayout).toContain('messages={await getMessages()}');
    expect(template).toContain("headers().get('x-pc-pathname')");
    expect(template).toContain('if (isPublicPath(pathname)) return children');
    expect(template).toContain("await import('@/components/platform-v7/PlatformV7ProtectedTemplateRuntime')");
    expect(template).not.toContain('PlatformV7TemplateSwitch');
  });

  it('keeps protected providers and shell in a protected-only runtime', () => {
    expect(protectedRuntime).toContain('<ToastProvider>');
    expect(protectedRuntime).toContain('<PlatformThemeSync />');
    expect(protectedRuntime).toContain('<PlatformV7ProtectedShell pathname={pathname}>');
    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(protectedShell).toContain('<PlatformV7SingleEntryGuard />');
    expect(protectedShell).toContain('<RbacCabinetGuard />');
  });

  it('uses a server-rendered locale link and native navigation on target routes', () => {
    expect(publicLocaleLink).not.toContain("'use client'");
    expect(publicLocaleLink).toContain("getTranslations('publicEntry.language')");
    expect(publicLocaleLink).toContain("href={`${pathname}?lang=${next}`}");
    expect(landing).toContain('localeControl={<PublicLocaleLink />}');
    expect(login).toContain('localeControl={<PublicLocaleLink />}');
    expect(recovery).toContain('localeControl={<PublicLocaleLink />}');
    expect(landing).not.toContain("from 'next/link'");
    expect(publicHeader).toContain("<a href='/platform-v7' className='pc-site-brand'");
  });

  it('loads only route-critical public styles before hydration', () => {
    expect(layout).not.toContain("import '@/styles/");
    expect(template).not.toContain("import '@/styles/");
    expect(landingStyles).toContain("import '@/styles/platform-v7-public-header.css'");
    expect(landingStyles).toContain("import '@/styles/platform-v7-public-landing.css'");
    expect(landingStyles).toContain("import '@/styles/platform-v7-public-entry-stable.css'");
    expect(landingStyles).not.toContain('platform-v7-protected-grid-stable.css');
    expect(authStyles).toContain("import '@/styles/platform-v7-public-header.css'");
    expect(authStyles).toContain("import '@/styles/platform-v7-public-auth.css'");
    expect(authStyles).not.toContain('platform-v7-public-landing.css');
    expect(authStyles).not.toContain('platform-v7-protected-grid-stable.css');
    expect(fullPlatformStyles).toContain("import '@/styles/platform-v7-protected-grid-stable.css'");
    expect(fullPlatformStyles).toContain("import '@/styles/platform-v7-dark-role-fixes.css'");

    for (const source of [publicHeader, publicLocaleLink, brandMark, landing, intelligenceStrip, login, loginClient, recovery, recoveryClient]) {
      expect(source).not.toContain('<style');
      expect(source).not.toContain('dangerouslySetInnerHTML');
    }

    expect(brandMark).not.toContain('BRAND_MARK_CSS_RESET');
    expect(publicHeaderCss).toContain('.pc-site-header');
    expect(publicHeaderCss).toContain('.pc-site-locale-switch');
    expect(publicAuthCss).toContain('.pc-auth-page');
    expect(publicAuthCss).toContain('.pc-recovery-page');
    expect(publicLandingCss).toContain('.pc-v7-public-entry');
    expect(publicLandingCss).toContain('.entry-intelligence-section');
  });

  it('does not reset browser caches or mount dev tooling without an explicit flag', () => {
    expect(rootLayout).not.toContain('cacheResetScript');
    expect(rootLayout).not.toContain('serviceWorker.getRegistrations');
    expect(rootLayout).not.toContain('caches.keys()');
    expect(rootLayout).toContain("process.env.NEXT_PUBLIC_DEV_MODE === 'true'");
    expect(rootLayout).toContain('showDevPanel ? <FeatureFlagsDevPanel /> : null');
  });

  it('canonicalises the legacy /ai route to the maintained assistant route', () => {
    expect(middleware).toContain("p === '/platform-v7/ai'");
    expect(middleware).toContain("u.pathname = '/platform-v7/assistant'");
  });
});
