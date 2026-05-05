import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  const candidates = [join(process.cwd(), relativePath), join(process.cwd(), 'apps/web', relativePath)];
  const path = candidates.find((candidate) => existsSync(candidate));

  if (!path) {
    throw new Error(`Cannot find ${relativePath}. Checked: ${candidates.join(', ')}`);
  }

  return readFileSync(path, 'utf8');
}

describe('platform-v7 mobile notification/header safe CSS', () => {
  const css = readRepoFile('styles/platform-v7-mobile-notification-safe.css');
  const accessibilityCss = readRepoFile('app/v9-accessibility.css');

  it('is imported after showcase hardening', () => {
    expect(accessibilityCss).toContain("@import '../styles/platform-v7-showcase-hardening.css';");
    expect(accessibilityCss).toContain("@import '../styles/platform-v7-mobile-notification-safe.css';");
  });

  it('keeps header actions and icon buttons visible', () => {
    expect(css).toContain('.pc-header-actions');
    expect(css).toContain('.pc-shell-iconbtn');
    expect(css).toContain('overflow: visible !important;');
  });

  it('keeps the badge inside the tap target', () => {
    expect(css).toContain(".pc-shell-iconbtn > span[aria-hidden='true']");
    expect(css).toContain('top: 2px !important;');
    expect(css).toContain('right: 2px !important;');
    expect(css).toContain('transform: none !important;');
  });

  it('protects mobile safe-area spacing and fixed button basis', () => {
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('env(safe-area-inset-right)');
    expect(css).toContain('flex-basis: 46px;');
  });

  it('reserves the right side on narrow mobile screens', () => {
    expect(css).toContain('@media (max-width: 480px)');
    expect(css).toContain('.pc-mobile-role,');
    expect(css).toContain('display: none !important;');
    expect(css).toContain('max-width: calc(100vw - 156px) !important;');
    expect(css).toContain('flex-basis: 44px !important;');
  });

  it('has a fallback for very narrow screens', () => {
    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toContain('max-width: calc(100vw - 144px) !important;');
    expect(css).toContain('flex-basis: 42px !important;');
  });
});
