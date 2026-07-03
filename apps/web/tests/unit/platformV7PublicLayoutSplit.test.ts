import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const middleware = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');

describe('platform-v7 public layout split', () => {
  it('passes pathname from middleware to the server layout', () => {
    expect(middleware).toContain("requestHeaders.set('x-pc-pathname', req.nextUrl.pathname)");
    expect(middleware).toContain("response.headers.set('x-pc-pathname', req.nextUrl.pathname)");
    expect(layout).toContain("headerStore.get('x-pc-pathname')");
  });

  it('does not treat a missing pathname as the public entry', () => {
    expect(layout).toContain('function isPublicPath(pathname: string | null)');
    expect(layout).toContain('if (!pathname) return false;');
    expect(layout).not.toContain("if (!pathname) return '/platform-v7'");
  });

  it('renders public routes without the protected app shell on the server', () => {
    expect(layout).toContain('PUBLIC_EXACT_PATHS');
    expect(layout).toContain("'/platform-v7'");
    expect(layout).toContain("'/platform-v7/open'");
    expect(layout).toContain("'/platform-v7/login'");
    expect(layout).toContain("'/platform-v7/register'");
    expect(layout).toContain('if (isPublicPath(pathname))');
    const publicBranch = layout.slice(layout.indexOf('if (isPublicPath(pathname))'), layout.indexOf('return (', layout.indexOf('if (isPublicPath(pathname))') + 1));
    expect(publicBranch).not.toContain('AppShellV4');
    expect(publicBranch).not.toContain('PlatformV7ShellUxController');
    expect(layout).not.toContain('PublicEntryCleanup');
  });

  it('keeps protected routes inside AppShellV4 with guards and role shell controls', () => {
    expect(layout).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(layout).toContain('<PlatformV7SingleEntryGuard />');
    expect(layout).toContain('<PlatformV7ShellUxController />');
    expect(layout).toContain('<RbacCabinetGuard />');
    expect(layout).toContain('<CalculatorHeaderWidget />');
    expect(layout).toContain('<SupportHeaderIcon />');
    expect(layout).toContain('<RoleAssistantWidget />');
    expect(layout).not.toContain('<CommandPalette />');
  });

  it('canonicalises the legacy /ai route to the maintained assistant route', () => {
    // /platform-v7/assistant is the canonical assistant surface; the legacy
    // /platform-v7/ai path 308-redirects to it in middleware.
    expect(middleware).toContain("p === '/platform-v7/ai'");
    expect(middleware).toContain("u.pathname = '/platform-v7/assistant'");
  });
});
