import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const loginTemplate = read('apps/web/app/platform-v7/login/template.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedTemplate = read('apps/web/components/platform-v7/PlatformV7ProtectedTemplate.tsx');
const shellSwitch = read('apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx');
const middleware = read('apps/web/middleware.ts');
const rootLayout = read('apps/web/app/layout.tsx');
const intelligence = read('apps/web/components/v7r/PlatformV7IntelligenceStripClient.tsx');
const loginLayout = read('apps/web/app/platform-v7/login/layout.tsx');

describe('platform-v7 public/protected runtime split', () => {
  it('resolves the route on the server and imports protected runtime only for protected pages', () => {
    expect(layout).toContain("from 'next/headers'");
    expect(layout).toContain("headers().get('x-pc-pathname')");
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout).not.toContain("import { ToastProvider }");
    expect(layout).not.toContain("import { PlatformThemeSync }");
    expect(layout).not.toContain("import { PlatformV7ShellSwitch }");
    expect(layout).not.toContain("import '@/app/v9.css'");
    expect(layout).not.toContain("import '@/styles/platform-v7-entry-fix.css'");
    expect(layout).toContain("'/platform-v7/forgot-password'");
  });

  it('loads protected CSS and shell only behind the dedicated client boundary', () => {
    expect(protectedRuntime).toContain("'use client'");
    expect(protectedRuntime).toContain("import '@/app/v9.css'");
    expect(protectedRuntime).toContain("import '@/styles/platform-v7-entry-fix.css'");
    expect(protectedRuntime).toContain('<ToastProvider>');
    expect(protectedRuntime).toContain('<PlatformThemeSync />');
    expect(protectedRuntime).toContain('<PlatformV7ShellSwitch>{children}</PlatformV7ShellSwitch>');
    expect(shellSwitch).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(shellSwitch).toContain('<PlatformV7SingleEntryGuard />');
    expect(shellSwitch).toContain('<RbacCabinetGuard />');
  });

  it('bypasses protected template guards and style layers on public routes', () => {
    expect(template).toContain("headers().get('x-pc-pathname')");
    expect(template).toContain("await import('@/components/platform-v7/PlatformV7ProtectedTemplate')");
    expect(template).not.toContain('PlatformV7TemplateGuards position=');
    expect(template).not.toContain("import '@/styles/platform-v7-public-entry-stable.css'");
    expect(protectedTemplate).toContain('<PlatformV7TemplateGuards position=\'before\' />');
    expect(protectedTemplate).toContain('<PlatformV7TemplateGuards position=\'after\' />');
    expect(loginTemplate).toContain('return children;');
    expect(loginTemplate).not.toContain('LoginLegacyOverlay');
  });

  it('does not hydrate the public intelligence strip from legacy storage runtime', () => {
    expect(intelligence).toContain('useLocale');
    expect(intelligence).not.toContain('translation-runtime');
    expect(intelligence).not.toContain('useEffect');
    expect(intelligence).not.toContain('useState');
  });

  it('keeps public root hydration payload bounded and removes cache-reset side effects', () => {
    expect(rootLayout).toContain('isPublicPlatformPath');
    expect(rootLayout).toContain('{ publicEntry: allMessages.publicEntry }');
    expect(rootLayout).not.toContain('cacheResetScript');
    expect(rootLayout).not.toContain('serviceWorker.getRegistrations');
    expect(rootLayout).not.toContain('fonts.googleapis.com');
  });

  it('removes legacy login replacement and indexes only the canonical entry', () => {
    expect(loginLayout).not.toContain('LoginHeaderExitButton');
    expect(loginTemplate).not.toContain('LoginLegacyOverlay');
    expect(layout).toContain("pathname === '/platform-v7'");
    expect(layout).toContain('{ index: true, follow: true }');
    expect(middleware).toContain("'/platform-v7/forgot-password'");
    expect(middleware).not.toContain("response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');\n  response.headers.set('x-content-type-options'");
  });

  it('canonicalises the legacy /ai route to the maintained assistant route', () => {
    expect(middleware).toContain("p === '/platform-v7/ai'");
    expect(middleware).toContain("u.pathname = '/platform-v7/assistant'");
  });
});
