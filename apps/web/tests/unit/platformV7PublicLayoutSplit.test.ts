import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const rootLayout = read('apps/web/app/layout.tsx');
const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const fullStyleRuntime = read('apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const nextConfig = read('apps/web/next.config.js');
const isolatedLanding = read('apps/web/app/pc-public-entry/platform-v7/page.tsx');
const isolatedLogin = read('apps/web/app/pc-public-entry/platform-v7/login/page.tsx');
const isolatedRecovery = read('apps/web/app/pc-public-entry/platform-v7/forgot-password/page.tsx');
const landing = read('apps/web/app/platform-v7/page.tsx');
const loginLayout = read('apps/web/app/platform-v7/login/layout.tsx');
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
const fixedHeaderCss = read('apps/web/app/platform-v7/_styles/fixed-header-contract.css');
const supportingShellCss = read('apps/web/app/platform-v7/_styles/public-supporting-shell.css');
const middleware = read('apps/web/middleware.ts');

describe('platform-v7 public/protected runtime split', () => {
  it('resolves lean public paths before creating the full or protected client tree', () => {
    expect(layout).toContain("from 'next/headers'");
    expect(layout).toContain("headers().get('x-pc-pathname')");
    expect(layout).toContain('if (pathname === LANDING_PATH || AUTH_PATHS.has(pathname)) return children');
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7FullStyleRuntime')");
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout.indexOf('if (pathname === LANDING_PATH || AUTH_PATHS.has(pathname)) return children')).toBeLessThan(
      layout.indexOf("await import('@/components/platform-v7/PlatformV7FullStyleRuntime')"),
    );
    expect(layout).not.toContain("await import('./_styles/");
    expect(layout).not.toContain('PlatformV7ShellSwitch');
    expect(layout).not.toContain('ToastProvider');
    expect(layout).not.toContain('PlatformThemeSync');
  });

  it('rewrites only the three public entry URLs into a physically isolated route tree', () => {
    expect(nextConfig).toContain("{ source: '/platform-v7', destination: '/pc-public-entry/platform-v7' }");
    expect(nextConfig).toContain("{ source: '/platform-v7/login', destination: '/pc-public-entry/platform-v7/login' }");
    expect(nextConfig).toContain("{ source: '/platform-v7/forgot-password', destination: '/pc-public-entry/platform-v7/forgot-password' }");
    expect(isolatedLanding).toContain("from '@/app/platform-v7/page'");
    expect(isolatedLogin).toContain("from '@/app/platform-v7/login/page'");
    expect(isolatedRecovery).toContain("from '@/app/platform-v7/forgot-password/page'");
    expect(isolatedLogin).toContain("import '@/styles/platform-v7-public-auth.css'");
    expect(isolatedRecovery).toContain("import '@/styles/platform-v7-public-auth.css'");
    for (const source of [isolatedLanding, isolatedLogin, isolatedRecovery]) {
      expect(source).not.toContain('PlatformV7FullStyleRuntime');
      expect(source).not.toContain('platform-v7-protected-grid-stable.css');
      expect(source).not.toContain('platform-v7-dark-role-fixes.css');
    }
  });

  it('does not wrap original or rewritten public entry paths in the client message provider', () => {
    expect(rootLayout).toContain('LEAN_PUBLIC_ENTRY_PATHS');
    expect(rootLayout).toContain("'/platform-v7'");
    expect(rootLayout).toContain("'/platform-v7/login'");
    expect(rootLayout).toContain("'/platform-v7/forgot-password'");
    expect(rootLayout).toContain("'/pc-public-entry/platform-v7'");
    expect(rootLayout).toContain("'/pc-public-entry/platform-v7/login'");
    expect(rootLayout).toContain("'/pc-public-entry/platform-v7/forgot-password'");
    expect(rootLayout).toContain('leanPublicEntry\n    ? children');
    expect(rootLayout).toContain('messages={await getMessages()}');
    expect(template).toContain("headers().get('x-pc-pathname')");
    expect(template).toContain('if (isPublicPath(pathname)) return children');
    expect(template).toContain("await import('@/components/platform-v7/PlatformV7ProtectedTemplateRuntime')");
    expect(template).not.toContain('PlatformV7TemplateSwitch');
  });

  it('does not preload or activate protected font variables on lean public entry routes', () => {
    expect(rootLayout.match(/preload: false/g)?.length).toBe(3);
    expect(rootLayout).toContain("const fontVariables = leanPublicEntry ? '' : `${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`;");
    expect(rootLayout).toContain("className={`notranslate${fontVariables ? ` ${fontVariables}` : ''}`}");
    expect(rootLayout).not.toContain("className={`notranslate ${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}");
  });

  it('keeps the landing route free of the lucide client module graph', () => {
    expect(landing).not.toContain("from 'lucide-react'");
    expect(intelligenceStrip).not.toContain("from 'lucide-react'");
    expect(publicLocaleLink).not.toContain("from 'lucide-react'");
    expect(layout).not.toContain("from 'lucide-react'");
    expect(landing).toContain('function EntryGlyph');
    expect(intelligenceStrip).toContain("const glyphs = ['✓', '→', '₽']");
    expect(publicLocaleLink).toContain("<b aria-hidden='true'>文</b>");
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

  it('loads lean CSS from concrete routes and full CSS only from the non-lean runtime', () => {
    expect(rootLayout).not.toContain('platform-v7-dark-role-fixes.css');
    expect(layout).not.toContain("import '@/styles/");
    expect(template).not.toContain("import '@/styles/");

    expect(landing).toContain("import '@/styles/platform-v7-public-header.css'");
    expect(landing).toContain("import '@/styles/platform-v7-public-landing.css'");
    expect(landing).toContain("import '@/styles/platform-v7-public-entry-stable.css'");
    expect(landing).not.toContain('platform-v7-protected-grid-stable.css');
    expect(landing).not.toContain('platform-v7-dark-role-fixes.css');

    expect(loginLayout).toContain("import '@/styles/platform-v7-public-header.css'");
    expect(loginLayout).toContain("import '@/styles/platform-v7-public-auth.css'");
    expect(loginLayout).not.toContain('platform-v7-public-landing.css');
    expect(loginLayout).not.toContain('platform-v7-protected-grid-stable.css');

    expect(recovery).toContain("import '@/styles/platform-v7-public-header.css'");
    expect(recovery).toContain("import '@/styles/platform-v7-public-auth.css'");
    expect(recovery).not.toContain('platform-v7-public-landing.css');
    expect(recovery).not.toContain('platform-v7-protected-grid-stable.css');

    expect(fullStyleRuntime).toContain("'use client'");
    expect(fullStyleRuntime).toContain("import '@/styles/platform-v7-protected-grid-stable.css'");
    expect(fullStyleRuntime).toContain("import '@/styles/platform-v7-dark-role-fixes.css'");
    expect(fullStyleRuntime).toContain('return children');

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

  it('keeps the header fixed and offsets every platform surface', () => {
    expect(rootLayout).toContain("import './platform-v7/_styles/fixed-header-contract.css'");
    expect(rootLayout).toContain("import './platform-v7/_styles/public-supporting-shell.css'");

    for (const selector of [
      '.pc-site-header',
      '.p7-flow-header',
      '.p7-demo-clean > header',
      '.p7-docs-clean > header',
      '.p7-contact-header',
      '.open-header',
      '.p7-request-header',
      '.pc-v4-header',
      '.pc-fixed-header',
      '[data-staff-platform-shell] > header',
    ]) {
      expect(fixedHeaderCss).toContain(selector);
    }

    expect(fixedHeaderCss).toContain('position: fixed !important');
    expect(fixedHeaderCss).toContain('env(safe-area-inset-top, 0px)');
    expect(fixedHeaderCss).toContain('--pc-local-fixed-header-height');
    expect(fixedHeaderCss).toContain('transform: none !important');
    expect(fullStyleRuntime).toContain('ResizeObserver');
    expect(fullStyleRuntime).toContain('MutationObserver');
    expect(fullStyleRuntime).toContain("window.visualViewport?.addEventListener('resize'");
    expect(fullStyleRuntime).toContain("activeRoot.style.setProperty('--pc-local-fixed-header-height'");
    expect(supportingShellCss).toContain('[data-public-supporting-shell]');
  });

  it('adds the canonical public header to supporting routes that had none', () => {
    for (const route of ['/platform-v7/help', '/platform-v7/pricing', '/platform-v7/roadmap']) {
      expect(layout).toContain(route);
    }
    expect(layout).toContain('PUBLIC_HEADERLESS_PATHS');
    expect(layout).toContain('async function PlatformV7PublicPageShell');
    expect(layout).toContain('<PublicSiteHeader');
    expect(layout).toContain('localeControl={<PublicLocaleLink />}');
    expect(layout).toContain("href='/platform-v7/login'");
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
