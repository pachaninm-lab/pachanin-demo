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

    expect(shell).toContain('pc-v4-header');
    expect(shell).toContain('position: fixed');
    expect(shell).toContain('BrandMark');
    expect(shell).toContain('Прозрачная Цена');
    expect(shell).toContain('--pc-header-offset');
    expect(shell).toContain('padding: calc(var(--pc-header-offset) + 10px)');
  });

  it('keeps mobile tools mounted into the header action row without duplicating desktop buttons', () => {
    const rail = read('apps/web/components/platform-v7/MobileHeaderActionRail.tsx');

    expect(rail).toContain("document.querySelector('.pc-v4-actions')");
    expect(rail).toContain('createPortal(button, headerMount)');
    expect(rail).toContain("display:none!important");
    expect(rail).toContain('p7-mobile-tools-trigger');
  });

  it('keeps logout redirecting to stable login instead of the public home page', () => {
    const rail = read('apps/web/components/platform-v7/MobileHeaderActionRail.tsx');

    expect(rail).toContain("LOGOUT_TARGET = '/platform-v7/login?logout=1'");
    expect(rail).toContain("clearCookie('pc-role')");
    expect(rail).toContain("clearCookie('pc-session')");
    expect(rail).toContain('router.replace(LOGOUT_TARGET');
    expect(rail).not.toContain("router.replace('/platform-v7'");
  });
});
