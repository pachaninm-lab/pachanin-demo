import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 public entry QA contract', () => {
  const config = read('apps/web/playwright.public-entry.config.ts');
  const e2e = read('apps/web/e2e/platform-v7-public-entry-industrial.spec.ts');
  const lighthouse = read('apps/web/lighthouserc.public-entry.cjs');

  it('covers required browser engines and mobile profiles', () => {
    for (const project of [
      'desktop-chromium',
      'desktop-firefox',
      'desktop-webkit',
      'iphone-se-webkit',
      'iphone-13-webkit',
      'iphone-pro-max-webkit',
      'pixel-chromium',
      'desktop-edge',
    ]) {
      expect(config).toContain(project);
    }
    expect(config).toContain('PLAYWRIGHT_INCLUDE_EDGE');
  });

  it('covers the complete supported width matrix', () => {
    for (const width of [320, 360, 375, 390, 414, 430, 1280, 1440, 1920]) {
      expect(e2e).toContain(`width: ${width}`);
    }
  });

  it('covers locale, authentication, recovery, focus, support and white-screen scenarios', () => {
    for (const marker of [
      "['ru', 'en', 'zh', 'ru']",
      'role query parameters never create a role picker',
      'login prevents duplicate parallel requests',
      'network failure returns focusable error state',
      'forgot-password response is universal',
      'support can be closed with Escape',
      'does not overlap hero CTAs',
      'do not produce a blank screen',
    ]) {
      expect(e2e).toContain(marker);
    }
  });

  it('contains explicit accessibility, visual and performance gates', () => {
    expect(e2e).toContain('@axe-core/playwright');
    expect(e2e).toContain('toHaveScreenshot');
    expect(e2e).toContain('PLAYWRIGHT_VISUAL_BASELINES');
    expect(e2e).toContain('largest-contentful-paint');
    expect(e2e).toContain('layout-shift');
    expect(e2e).toContain('durationThreshold');
    expect(lighthouse).toContain("'largest-contentful-paint': ['error', { maxNumericValue: 2500");
    expect(lighthouse).toContain("'cumulative-layout-shift': ['error', { maxNumericValue: 0.1");
    expect(lighthouse).toContain("'total-blocking-time': ['error', { maxNumericValue: 200");
  });

  it('does not treat missing visual baselines or axe as a pass', () => {
    expect(e2e).toContain('absence is not a visual-regression pass');
    expect(e2e).toContain('This is not an accessibility pass');
  });
});
