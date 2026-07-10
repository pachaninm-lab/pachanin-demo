import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('platform-v7 public live hardening', () => {
  it('self-hosts the configured fonts and keeps root theme hydration stable', () => {
    const css = read('apps/web/app/v9.css');
    const layout = read('apps/web/app/layout.tsx');
    expect(css).not.toContain('fonts.googleapis.com');
    expect(css).not.toContain('fonts.gstatic.com');
    expect(css).toContain("var(--font-inter, 'Inter')");
    expect(css).toContain("var(--font-jetbrains-mono, 'JetBrains Mono')");
    expect(layout).toContain('data-theme="light"');
    expect(layout).toContain('suppressHydrationWarning');
    expect(layout).not.toContain('rel="preconnect" href="https://fonts.googleapis.com"');
  });

  it('indexes only the public landing while auth and protected surfaces remain noindex by default', () => {
    const middleware = read('apps/web/middleware.ts');
    const page = read('apps/web/app/platform-v7/page.tsx');
    const platformLayout = read('apps/web/app/platform-v7/layout.tsx');
    expect(middleware).toContain("indexable ? 'index, follow, max-image-preview:large'");
    expect(middleware).toContain('isEntry && !privateModeEnabled');
    expect(middleware).toContain("'noindex, nofollow, noarchive, nosnippet, noimageindex'");
    expect(page).toContain('export const metadata: Metadata');
    expect(page).toContain('index: true');
    expect(platformLayout).toContain('index: false');
  });

  it('keeps the mobile process rail keyboard-accessible', () => {
    const page = read('apps/web/app/platform-v7/page.tsx');
    expect(page).toContain("className='entry-process-row' tabIndex={0} role='region'");
  });

  it('does not ship the protected cabinet graph in the public shell entry chunk', () => {
    const shellSwitch = read('apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx');
    const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
    expect(shellSwitch).toContain('dynamic(');
    expect(shellSwitch).not.toContain("from '@/components/v7r/AppShellV4'");
    expect(shellSwitch).not.toContain('RoleAssistantWidget');
    expect(protectedShell).toContain("from '@/components/v7r/AppShellV4'");
    expect(protectedShell).toContain('RoleAssistantWidget');
  });

  it('renders the public intelligence strip on the server in the request locale', () => {
    const strip = read('apps/web/components/v7r/PlatformV7IntelligenceStrip.tsx');
    expect(strip).not.toContain("'use client'");
    expect(strip).toContain('getLocale');
    expect(strip).not.toContain('readStoredLanguage');
    expect(strip).not.toContain('useEffect');
  });

  it('does not emit unsupported permissions-policy directives', () => {
    const middleware = read('apps/web/middleware.ts');
    expect(middleware).not.toContain('bluetooth=()');
  });
});
