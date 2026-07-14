import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const config = read('apps/web/playwright.acceptance.config.ts');
const spec = read('apps/web/tests/e2e/platform-v7-design-system-v8-acceptance.spec.ts');
const workflow = read('.github/workflows/platform-v7-design-system-v8-acceptance.yml');
const report = read('docs/platform-v7/qa/DESIGN_SYSTEM_V8_FINAL_ACCEPTANCE.md');

describe('platform-v7 Design System v8 final acceptance contract', () => {
  it('defines Chromium, WebKit, desktop, iPhone and Android projects', () => {
    for (const project of ['desktop-chromium', 'desktop-webkit', 'android-chromium', 'iphone-webkit']) {
      expect(config).toContain(`name: '${project}'`);
    }
    expect(config).toContain("devices['Desktop Chrome']");
    expect(config).toContain("devices['Desktop Safari']");
    expect(config).toContain("devices['Pixel 5']");
    expect(config).toContain("devices['iPhone 13']");
    expect(config).toContain("command: 'pnpm start'");
  });

  it('uses cryptographically signed cabinet sessions for every protected role', () => {
    expect(spec).toContain('signCabinetSession');
    for (const role of [
      'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
      'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
    ]) {
      expect(spec).toContain(`['${role}', '/platform-v7/`);
    }
    expect(spec).not.toContain('pc-role');
    expect(spec).not.toContain('localStorage');
  });

  it('enforces accessibility, media, localization, hydration and layout stability', () => {
    expect(spec).toContain('AxeBuilder');
    expect(spec).toContain("withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])");
    expect(spec).toContain("forcedColors: 'active'");
    expect(spec).toContain("reducedMotion: 'reduce'");
    expect(spec).toContain("['ru', 'en', 'zh']");
    expect(spec).toContain('failed to hydrate');
    expect(spec).toContain('__pcV8LayoutShift');
    expect(spec).toContain('toBeLessThanOrEqual(0.1)');
    expect(spec).toContain("headerPosition).toBe('fixed')");
    expect(spec).toContain("navPosition).toBe('fixed')");
  });

  it('builds the production bundle and stores machine-readable browser evidence', () => {
    expect(workflow).toContain('pnpm exec playwright install --with-deps chromium webkit');
    expect(workflow).toContain('pnpm --filter @pc/web build');
    expect(workflow).toContain('playwright.acceptance.config.ts');
    expect(workflow).toContain('design-system-v8-acceptance-results.json');
    expect(workflow).toContain('upload-artifact@v4');
  });

  it('keeps architecture completion separate from production and external-integration proof', () => {
    expect(report).toContain('protected-legacy=0');
    expect(report).toContain('production и live-внешние интеграции не подтверждаются');
    expect(report).toContain('browser-accessibility matrix');
  });
});
