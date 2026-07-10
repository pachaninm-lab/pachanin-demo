import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const rootLayout = read('apps/web/app/layout.tsx');
const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const templateSwitch = read('apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const middleware = read('apps/web/middleware.ts');

describe('platform-v7 public/protected runtime split', () => {
  it('resolves public paths before creating the protected client tree', () => {
    expect(layout).toContain("from 'next/headers'");
    expect(layout).toContain("headers().get('x-pc-pathname')");
    expect(layout).toContain('if (isPublicPath(pathname)) return children');
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7ProtectedRuntime')");
    expect(layout).not.toContain('PlatformV7ShellSwitch');
    expect(layout).not.toContain('ToastProvider');
    expect(layout).not.toContain('PlatformThemeSync');
  });

  it('keeps protected providers and shell in a protected-only runtime', () => {
    expect(protectedRuntime).toContain('<ToastProvider>');
    expect(protectedRuntime).toContain('<PlatformThemeSync />');
    expect(protectedRuntime).toContain('<PlatformV7ProtectedShell pathname={pathname}>');
    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(protectedShell).toContain('<PlatformV7SingleEntryGuard />');
    expect(protectedShell).toContain('<RbacCabinetGuard />');
  });

  it('keeps DOM mutation guards outside public templates', () => {
    expect(template).toContain('<PlatformV7TemplateSwitch>{children}</PlatformV7TemplateSwitch>');
    expect(template).not.toContain('PlatformV7ProductionCopyPatch');
    expect(templateSwitch).toContain('dynamic(');
    expect(templateSwitch).toContain('PlatformV7ProtectedTemplateRuntime');
    expect(templateSwitch).toContain('if (isPublicPath(pathname)) return <>{children}</>');
  });

  it('does not reset all browser caches or mount dev tooling without an explicit flag', () => {
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
