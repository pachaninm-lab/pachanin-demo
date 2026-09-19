import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 header consistency', () => {
  it('keeps the shell using one fixed header with brand and mobile-safe offset', () => {
    const shell = read('apps/web/components/v7r/AppShellV4.tsx');
    const css = read('apps/web/components/v7r/AppShellV4.module.css');

    expect(shell).toContain('pc-v4-header');
    expect(shell).toContain('BrandMark');
    expect(shell).toContain('Прозрачная Цена');
    expect(css).toContain('--shell-header-offset');
    expect(css).toMatch(/\.header\s*\{[^}]*position: fixed/);
    expect(css).toContain('padding: calc(var(--shell-header-offset) + 12px)');
  });

  it('keeps the global header mounts exposed for portalled tools without duplicating desktop buttons', () => {
    const shell = read('apps/web/components/v7r/AppShellV4.tsx');
    const menu = read('apps/web/components/platform-v7/HeaderUtilityMenu.tsx');
    const menuCss = read('apps/web/components/platform-v7/HeaderUtilityMenu.module.css');

    expect(shell).toContain('pc-v4-actions');
    expect(shell).toContain('pc-v4-brand');
    expect(shell).toContain('pc-v4-drawer');
    expect(shell).toContain('pc-v4-main');
    expect(menu).toContain("useMount('.pc-v4-actions')");
    expect(menu).toContain('createPortal(trigger, headerMount)');
    expect(menuCss).toContain(".simplifiedShell :global(.pc-v4-actions > .pc-v4-search)");
    expect(menuCss).toContain('display: none !important');
  });

  it('keeps logout redirecting to stable login instead of the public home page', () => {
    const menu = read('apps/web/components/platform-v7/HeaderUtilityMenu.tsx');

    expect(menu).toContain("LOGOUT_TARGET = '/platform-v7/login?logout=1'");
    expect(menu).toContain("clearCookie('pc-role')");
    expect(menu).toContain('clearCookie(SESSION_COOKIE)');
    expect(menu).toContain('router.replace(LOGOUT_TARGET');
    expect(menu).not.toContain("router.replace('/platform-v7'");
  });
});
