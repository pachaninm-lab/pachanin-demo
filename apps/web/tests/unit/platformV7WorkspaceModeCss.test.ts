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

describe('platform-v7 workspace mode CSS', () => {
  const css = readRepoFile('styles/platform-v7-workspace-mode.css');
  const mobileCss = readRepoFile('styles/platform-v7-mobile-notification-safe.css');
  const accessibilityCss = readRepoFile('app/v9-accessibility.css');

  it('is reachable through the imported mobile header CSS layer', () => {
    expect(accessibilityCss).toContain("@import '../styles/platform-v7-mobile-notification-safe.css';");
    expect(mobileCss).toContain("@import './platform-v7-workspace-mode.css';");
  });

  it('reduces oversized presentation headings', () => {
    expect(css).toContain('.pc-main :where(h1)');
    expect(css).toContain('font-size: clamp(30px, 5.8vw, 48px) !important;');
    expect(css).toContain('.pc-main :where(h2)');
    expect(css).toContain('font-size: clamp(23px, 4.5vw, 34px) !important;');
  });

  it('makes showcase cards denser and less exhibition-like', () => {
    expect(css).toContain('border-radius: 20px !important;');
    expect(css).toContain('box-shadow: var(--pc-shadow-sm) !important;');
    expect(css).toContain('min-height: 0 !important;');
  });

  it('keeps mobile workspace headings compact', () => {
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain('font-size: clamp(27px, 8vw, 34px) !important;');
  });
});
