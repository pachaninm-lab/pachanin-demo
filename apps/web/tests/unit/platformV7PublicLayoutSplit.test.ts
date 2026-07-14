import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(process.cwd(), file));

const rootLayout = read('apps/web/app/layout.tsx');
const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const publicRuntime = read('apps/web/components/platform-v7/PlatformV7PublicRuntime.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const supportingCss = read('apps/web/app/platform-v7/_styles/supporting-v8.module.css');
const nextConfig = read('apps/web/next.config.js');
const isolatedLanding = read('apps/web/app/pc-public-entry/platform-v7/page.tsx');
const isolatedLogin = read('apps/web/app/pc-public-entry/platform-v7/login/page.tsx');
const isolatedRecovery = read('apps/web/app/pc-public-entry/platform-v7/forgot-password/page.tsx');
const publicLocaleLink = read('apps/web/components/platform-v7/PublicLocaleLink.tsx');

describe('platform-v7 final public/protected runtime split', () => {
  it('keeps the three public entry URLs physically isolated and lean', () => {
    expect(nextConfig).toContain("{ source: '/platform-v7', destination: '/pc-public-entry/platform-v7' }");
    expect(nextConfig).toContain("{ source: '/platform-v7/login', destination: '/pc-public-entry/platform-v7/login' }");
    expect(nextConfig).toContain("{ source: '/platform-v7/forgot-password', destination: '/pc-public-entry/platform-v7/forgot-password' }");
    for (const source of [isolatedLanding, isolatedLogin, isolatedRecovery]) {
      expect(source).not.toContain('PlatformV7FullStyleRuntime');
      expect(source).not.toContain('PlatformV7TemplateGuards');
    }
  });

  it('uses a token-only runtime for supporting public routes', () => {
    for (const route of ['/platform-v7/help', '/platform-v7/pricing', '/platform-v7/roadmap']) {
      expect(layout).toContain(route);
    }
    expect(layout).toContain('PUBLIC_SUPPORTING_PATHS');
    expect(layout).toContain('PlatformV7PublicPageShell');
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7PublicRuntime')");
    expect(publicRuntime).toContain('packages/design-tokens/tokens.css');
    expect(publicRuntime).not.toContain('@/styles/platform-v7-');
    expect(publicRuntime).not.toContain('MutationObserver');
    expect(publicRuntime).not.toContain('ResizeObserver');
    expect(supportingCss).toContain('env(safe-area-inset-top, 0px)');
    expect(supportingCss).toContain('@media (forced-colors: active)');
  });

  it('keeps protected providers behind server role verification', () => {
    expect(layout).toContain('if (!role) redirect');
    expect(layout).toContain('if (!canRoleAccessCabinet');
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime')");
    expect(protectedRuntime).toContain('<ToastProvider>');
    expect(protectedRuntime).toContain('<PlatformThemeSync />');
    expect(protectedRuntime).toContain('<PlatformV7ProtectedShell pathname={pathname}>');
    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(protectedShell).toContain('<PlatformV7SingleEntryGuard />');
    expect(protectedShell).toContain('<RbacCabinetGuard />');
  });

  it('removes client-side presentation repair from the platform template', () => {
    expect(template).toContain('return children');
    expect(template).not.toContain('next/headers');
    expect(template).not.toContain('PlatformV7ProtectedTemplateRuntime');
    expect(template).not.toContain('isDesignSystemV8Route');
    expect(exists('apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx')).toBe(false);
    expect(exists('apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx')).toBe(false);
    expect(exists('apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx')).toBe(false);
  });

  it('keeps locale selection server-rendered and URL-driven', () => {
    expect(publicLocaleLink).not.toContain("'use client'");
    expect(publicLocaleLink).toContain("getTranslations('publicEntry.language')");
    expect(publicLocaleLink).toContain('href={`${pathname}?lang=${next}`}');
    expect(layout).toContain('localeControl');
    expect(layout).not.toContain('localStorage');
  });

  it('keeps root public entries outside the client message provider', () => {
    expect(rootLayout).toContain('LEAN_PUBLIC_ENTRY_PATHS');
    expect(rootLayout).toContain('leanPublicEntry\n    ? children');
    expect(rootLayout).toContain('messages={await getMessages()}');
  });
});
