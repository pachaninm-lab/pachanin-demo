import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const shellSwitch = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx'), 'utf8');
const protectedShell = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx'), 'utf8');
const middleware = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');

describe('platform-v7 public/protected shell split', () => {
  it('keeps the server layout static-safe instead of reading request headers', () => {
    expect(layout).not.toContain("from 'next/headers'");
    expect(layout).not.toContain("headerStore.get('x-pc-pathname')");
    expect(layout).toContain('<PlatformV7ShellSwitch>{children}</PlatformV7ShellSwitch>');
    expect(layout).toContain("platform-v7-shell-critical.css");
  });

  it('keeps public routes outside the protected app shell', () => {
    expect(shellSwitch).toContain('PUBLIC_EXACT_PATHS');
    expect(shellSwitch).toContain("'/platform-v7'");
    expect(shellSwitch).toContain("'/platform-v7/open'");
    expect(shellSwitch).toContain("'/platform-v7/login'");
    expect(shellSwitch).toContain("'/platform-v7/register'");
    expect(shellSwitch).toContain("'/platform-v7/demo'");
    expect(shellSwitch).toContain("'/platform-v7/contact'");
    expect(shellSwitch).toContain("'/platform-v7/request'");
    expect(shellSwitch).toContain('if (isPublicPath(pathname)) return <>{children}</>');
  });

  it('keeps protected routes inside AppShellV4 with guards and role shell controls', () => {
    expect(shellSwitch).toContain('dynamic(');
    expect(shellSwitch).toContain('PlatformV7ProtectedShell');
    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(protectedShell).toContain('<PlatformV7SingleEntryGuard />');
    expect(protectedShell).toContain('<PlatformV7ShellUxController />');
    expect(protectedShell).toContain('<RbacCabinetGuard />');
    expect(protectedShell).toContain('<CalculatorHeaderWidget />');
    expect(protectedShell).toContain('<SupportHeaderIcon />');
    expect(protectedShell).toContain('<RoleAssistantWidget />');
    expect(protectedShell).not.toContain('<CommandPalette />');
  });

  it('canonicalises the legacy /ai route to the maintained assistant route', () => {
    expect(middleware).toContain("p === '/platform-v7/ai'");
    expect(middleware).toContain("u.pathname = '/platform-v7/assistant'");
  });
});
