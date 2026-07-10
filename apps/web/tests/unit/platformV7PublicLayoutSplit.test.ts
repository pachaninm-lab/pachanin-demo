import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const rootLayout = read('apps/web/app/layout.tsx');
const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const loginTemplate = read('apps/web/app/platform-v7/login/template.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedTemplate = read('apps/web/components/platform-v7/PlatformV7ProtectedTemplate.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const localeSwitch = read('apps/web/components/platform-v7/PublicLocaleSwitch.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const middleware = read('apps/web/middleware.ts');

describe('platform-v7 final public/protected split', () => {
  it('bounds the public root hydration payload', () => {
    expect(rootLayout).toContain("headers().get('x-pc-pathname')");
    expect(rootLayout).toContain('{ publicEntry: allMessages.publicEntry as AbstractIntlMessages }');
    expect(rootLayout).not.toContain('cacheResetScript');
    expect(rootLayout).not.toContain('serviceWorker.getRegistrations');
    expect(rootLayout).toContain("process.env.NEXT_PUBLIC_DEV_MODE === 'true'");
  });

  it('resolves public routes before creating protected providers', () => {
    expect(layout).toContain("from 'next/headers'");
    expect(layout).toContain("headers().get('x-pc-pathname')");
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout).not.toContain("import { ToastProvider }");
    expect(layout).not.toContain("import { PlatformThemeSync }");
    expect(layout).not.toContain("import { PlatformV7ShellSwitch }");
    expect(protectedRuntime).toContain('<ToastProvider>');
    expect(protectedRuntime).toContain('<PlatformThemeSync />');
    expect(protectedRuntime).toContain('<PlatformV7ShellSwitch>{children}</PlatformV7ShellSwitch>');
  });

  it('bypasses DOM guards and role CSS for public routes', () => {
    expect(template).toContain("headers().get('x-pc-pathname')");
    expect(template).toContain("await import('@/components/platform-v7/PlatformV7ProtectedTemplate')");
    expect(template).not.toContain('PlatformV7TemplateGuards position=');
    expect(template).not.toContain("platform-v7-protected-grid-stable.css");
    expect(protectedTemplate).toContain("platform-v7-protected-grid-stable.css");
    expect(protectedTemplate).toContain("<PlatformV7TemplateGuards position='before' />");
    expect(protectedTemplate).toContain("<PlatformV7TemplateGuards position='after' />");
  });

  it('renders the canonical login page instead of the legacy overlay', () => {
    expect(loginTemplate).toContain('return children;');
    expect(loginTemplate).not.toContain('LoginLegacyOverlay');
  });

  it('renders a hydration-stable RU EN ZH locale control', () => {
    expect(localeSwitch).not.toContain("'use client'");
    expect(localeSwitch).not.toContain('useLocale');
    expect(localeSwitch).not.toContain('useTranslations');
    expect(localeSwitch).not.toContain('window.');
    expect(localeSwitch).toContain("href={`?lang=${code}`}");
    expect(localeSwitch).toContain("{ code: 'ru', label: 'RU'");
    expect(localeSwitch).toContain("{ code: 'en', label: 'EN'");
    expect(localeSwitch).toContain("{ code: 'zh', label: 'ZH'");
    expect(publicHeader).toContain("html:lang(ru) .pc-site-locale-options");
    expect(publicHeader).toContain("html:lang(en) .pc-site-locale-options");
    expect(publicHeader).toContain("html:lang(zh-CN) .pc-site-locale-options");
  });

  it('keeps protected routes inside the maintained shell', () => {
    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(protectedShell).toContain('<PlatformV7SingleEntryGuard />');
    expect(protectedShell).toContain('<PlatformV7ShellUxController />');
    expect(protectedShell).toContain('<RbacCabinetGuard />');
    expect(protectedShell).toContain('<CalculatorHeaderWidget />');
    expect(protectedShell).toContain('<SupportHeaderIcon />');
    expect(protectedShell).toContain('<RoleAssistantWidget />');
  });

  it('keeps canonical routing and public indexing policy', () => {
    expect(layout).toContain("pathname === '/platform-v7'");
    expect(layout).toContain('{ index: true, follow: true }');
    expect(middleware).toContain("p === '/platform-v7/ai'");
    expect(middleware).toContain("u.pathname = '/platform-v7/assistant'");
  });
});
