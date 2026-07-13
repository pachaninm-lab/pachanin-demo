import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const layout = read('apps/web/app/platform-v7/layout.tsx');
const contract = read('apps/web/styles/platform-v7-fixed-header-contract.css');
const runtime = read('apps/web/components/platform-v7/PlatformV7HeaderOffsetRuntime.tsx');
const supportingShell = read('apps/web/components/platform-v7/PlatformV7PublicPageShell.tsx');
const supportingShellCss = read('apps/web/styles/platform-v7-public-supporting-shell.css');

describe('platform-v7 fixed header contract', () => {
  it('applies one fixed-header contract to public, protected and staff surfaces', () => {
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
      expect(contract).toContain(selector);
      expect(runtime).toContain(selector);
    }

    expect(contract).toContain('position: fixed !important');
    expect(contract).toContain('env(safe-area-inset-top, 0px)');
    expect(contract).toContain('--pc-local-fixed-header-height');
    expect(contract).toContain('translate3d(0, 0, 0)');
  });

  it('measures dynamic header height after navigation, resizing and translation changes', () => {
    expect(runtime).toContain('ResizeObserver');
    expect(runtime).toContain('MutationObserver');
    expect(runtime).toContain("window.addEventListener('orientationchange'");
    expect(runtime).toContain('window.visualViewport?.addEventListener');
    expect(runtime).toContain("'[data-public-supporting-shell]'");
    expect(runtime).toContain("activeRoot.style.setProperty('--pc-local-fixed-header-height'");
  });

  it('keeps the landing and auth entry lean while mounting the runtime elsewhere', () => {
    expect(layout).toContain("import '@/styles/platform-v7-fixed-header-contract.css'");
    expect(layout).toContain('PlatformV7HeaderOffsetRuntime');
    expect(layout).toContain('if (pathname === LANDING_PATH || AUTH_PATHS.has(pathname)) return children;');
    expect(layout).toContain('const headerOffsetRuntime = <PlatformV7HeaderOffsetRuntime />;');
  });

  it('adds the canonical public header to supporting routes that had none', () => {
    for (const route of [
      '/platform-v7/help',
      '/platform-v7/pricing',
      '/platform-v7/roadmap',
    ]) {
      expect(layout).toContain(route);
    }

    expect(layout).toContain('PUBLIC_HEADERLESS_PATHS');
    expect(layout).toContain('<PlatformV7PublicPageShell>{children}</PlatformV7PublicPageShell>');
    expect(supportingShell).toContain('<PublicSiteHeader');
    expect(supportingShell).toContain("localeControl={<PublicLocaleLink />}");
    expect(supportingShell).toContain("href='/platform-v7/login'");
    expect(supportingShellCss).toContain('[data-public-supporting-shell]');
  });
});
