import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const absolute = (file: string) => path.join(process.cwd(), file);
const read = (file: string) => fs.readFileSync(absolute(file), 'utf8');

const landing = read('apps/web/app/platform-v7/page.tsx');
const strategic = read('apps/web/styles/platform-v7-strategic-home-v3.css');
const finalCss = read('apps/web/components/platform-v7/PlatformV7HomeFinalPolish.css');

describe('platform-v7 public homepage typography', () => {
  it('uses an inline critical system-font shell instead of redundant render-blocking legacy layers', () => {
    expect(landing).toContain('CRITICAL_HOME_CSS');
    expect(landing).toContain('--pc-entry-font-body');
    expect(landing).toContain('-apple-system, BlinkMacSystemFont');
    expect(landing).not.toContain('platform-v7-public-header.css');
    expect(landing).not.toContain('platform-v7-public-mobile-safe-area.css');
    expect(landing).not.toContain('platform-v7-public-typography.css');
    expect(landing).not.toContain('platform-v7-i18n-cjk.css');
    expect(landing).not.toContain('platform-v7-hero-infrastructure-message.css');
  });

  it('keeps one stable local font system across the strategic landing', () => {
    expect(strategic).toContain('--pc-v6-font-body');
    expect(strategic).toContain('--pc-v6-font-display');
    expect(strategic).toContain('font-family: var(--pc-v6-font-body)');
    expect(landing).toContain('font-family: var(--pc-v6-font-display)');
    expect(landing).toContain('font-family: -apple-system, BlinkMacSystemFont');
  });

  it('does not introduce remote fonts or synthetic ultra-heavy weights', () => {
    const combined = `${landing}\n${strategic}\n${finalCss}`;
    expect(combined).not.toMatch(/@import\s+url/i);
    expect(combined).not.toMatch(/https?:\/\//i);
    expect(combined).not.toContain('font-weight: 950');
    expect(combined).not.toContain('fontWeight: 950');
  });

  it('keeps phone and desktop hero typography deliberate', () => {
    expect(landing).toContain('@media (max-width: 767px)');
    expect(landing).toContain('@media (max-width: 359px)');
    expect(landing).toContain('@media (min-width: 768px)');
    expect(landing).toContain('font-size: clamp(33px, 8.7vw, 36px)');
    expect(landing).toContain('font-size: clamp(48px, 5vw, 64px)');
    expect(landing).toContain('.pc-v6-hero-brand::after { display: none; }');
    expect(landing).toContain('.pc-v6-hero-title-line { display: block; }');
    expect(finalCss).toContain('font-size: clamp(32px, 8.35vw, 36px) !important');
  });

  it('preserves readable body copy and defers only offscreen sections in the final stylesheet', () => {
    expect(landing).toContain('font-size: 18px');
    expect(landing).toContain('line-height: 1.5');
    expect(landing).toContain('text-rendering: auto');
    expect(finalCss).toContain('@supports (content-visibility: auto)');
    expect(finalCss).toContain('content-visibility: auto;');
    expect(finalCss).not.toMatch(/\.pc-v7-public-entry \.pc-v6-hero[^}]*content-visibility/);
    expect(finalCss).not.toMatch(/\.pc-v7-public-entry #participants[^}]*content-visibility/);
  });
});
