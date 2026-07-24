import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const absolute = (file: string) => path.join(process.cwd(), file);
const read = (file: string) => fs.readFileSync(absolute(file), 'utf8');

const landing = read('apps/web/app/platform-v7/page.tsx');
const strategic = read('apps/web/styles/platform-v7-strategic-home-v3.css');
const hero = read('apps/web/styles/platform-v7-hero-infrastructure-message.css');

describe('platform-v7 public homepage typography', () => {
  it('uses an inline critical system-font shell instead of redundant render-blocking legacy layers', () => {
    expect(landing).toContain('CRITICAL_HOME_SHELL_CSS');
    expect(landing).toContain('--pc-entry-font-body');
    expect(landing).toContain('-apple-system, BlinkMacSystemFont');
    expect(landing).not.toContain('platform-v7-public-header.css');
    expect(landing).not.toContain('platform-v7-public-mobile-safe-area.css');
    expect(landing).not.toContain('platform-v7-public-typography.css');
  });

  it('keeps one stable local font system across the strategic landing', () => {
    expect(strategic).toContain('--pc-v6-font-body');
    expect(strategic).toContain('--pc-v6-font-display');
    expect(strategic).toContain('font-family: var(--pc-v6-font-body)');
    expect(hero).toContain('font-family: var(--pc-v6-font-display)');
    expect(hero).toContain('font-family: -apple-system, BlinkMacSystemFont');
  });

  it('does not introduce remote fonts or synthetic ultra-heavy weights', () => {
    const combined = `${landing}\n${strategic}\n${hero}`;
    expect(combined).not.toMatch(/@import\s+url/i);
    expect(combined).not.toMatch(/https?:\/\//i);
    expect(combined).not.toContain('font-weight: 950');
    expect(combined).not.toContain('fontWeight: 950');
  });

  it('keeps phone, tablet and desktop hero typography deliberate', () => {
    expect(hero).toContain('@media (max-width: 374px)');
    expect(hero).toContain('@media (min-width: 375px) and (max-width: 767px)');
    expect(hero).toContain('@media (min-width: 768px) and (max-width: 1023px)');
    expect(hero).toContain('@media (min-width: 1024px)');
    expect(hero).toContain('@media (min-width: 1280px)');
    expect(hero).toContain('font-size: clamp(38px, 9.4vw, 42px)');
    expect(hero).toContain('.pc-v6-hero-brand::after');
    expect(hero).toContain('.pc-v6-hero-title-line { display: inline; }');
  });

  it('preserves readable body copy and defers only offscreen non-interactive sections', () => {
    expect(hero).toContain('font-size: 17px');
    expect(hero).toContain('line-height: 1.54');
    expect(hero).toContain('text-rendering: auto');
    expect(hero).toContain('content-visibility: auto');
    expect(hero).not.toMatch(/\.pc-v6-scenario[^}]*content-visibility/);
    expect(hero).not.toMatch(/#connect-organization[^}]*content-visibility/);
  });
});
