import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const config = read('apps/web/playwright.acceptance.config.ts');
const spec = read('apps/web/tests/e2e/platform-v7-design-system-v8-acceptance.spec.ts');
const workflow = read('.github/workflows/platform-v7-design-system-v8-acceptance.yml');
const report = read('docs/platform-v7/qa/DESIGN_SYSTEM_V8_FINAL_ACCEPTANCE.md');
const acceptanceLogin = read('apps/web/tests/e2e/support/acceptance-login.ts');

describe('platform-v7 Design System v8 final acceptance contract', () => {
  it('defines Chromium, WebKit, desktop, iPhone and Android projects', () => {
    for (const project of ['desktop-chromium', 'desktop-webkit', 'android-chromium', 'iphone-webkit']) {
      expect(config).toContain(`name: '${project}'`);
    }
    expect(config).toContain("devices['Desktop Chrome']");
    expect(config).toContain("devices['Desktop Safari']");
    expect(config).toContain("devices['Pixel 5']");
    expect(config).toContain("devices['iPhone 13']");
    // The acceptance matrix no longer serves the build with `pnpm start`; it
    // runs a dedicated HTTPS server in front of the same production bundle,
    // which is closer to production, not further from it. The property that
    // matters - that a production bundle is what gets tested - is asserted
    // against the workflow below, where the build step lives.
    expect(config).toContain('webServer');
    expect(config).toContain('acceptance-https-server.mjs');
    expect(config).not.toContain("command: 'pnpm dev'");
  });

  /**
   * This demanded that the acceptance suite forge its own cabinet session with
   * signCabinetSession. That is no longer how it authenticates, and the change
   * was an upgrade: the suite drives the ordinary login route, so the server
   * verifies the password and issues the cabinet cookie through exactly the code
   * production runs. A test that mints its own session proves the layout accepts
   * what the test minted; this one proves the real path works.
   *
   * Restoring the old assertion would demand the weaker method back, so the
   * contract is asserted instead - real login in, and no forged session - and it
   * is now also load-bearing for #4785: a hand-made cabinet cookie would have to
   * carry the type and audience the reader requires, and the suite makes none.
   */
  it('authenticates every protected role through the real login route, not a forged session', () => {
    expect(spec).toContain('loginAs(page');
    expect(spec).not.toContain('signCabinetSession');
    expect(acceptanceLogin).toContain("post('/api/auth/login'");
    expect(acceptanceLogin).not.toContain('signCabinetSession');
    for (const role of [
      'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
      'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
    ]) {
      expect(spec).toContain(`['${role}', '/platform-v7/`);
    }
    expect(spec).toContain("page.goto('about:blank'");
    expect(spec.indexOf("page.goto('about:blank'")).toBeLessThan(spec.indexOf('page.context().clearCookies()'));
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
    // The browser list grew to include firefox; pinning the exact string would
    // make added coverage look like a failure. Both originally required engines
    // are still installed.
    expect(workflow).toMatch(/playwright install --with-deps [^\n]*chromium/u);
    expect(workflow).toMatch(/playwright install --with-deps [^\n]*webkit/u);
    expect(workflow).toContain('pnpm --filter @pc/web build');
    expect(workflow).toContain('playwright.acceptance.config.ts');
    expect(workflow).toContain('design-system-v8-acceptance-results.json');
    expect(workflow).toContain('upload-artifact@v4');
  });

  it('keeps architecture completion separate from production and external-integration proof', () => {
    expect(report).toContain('protected-legacy=0');
    // Reworded into an explicit list of what the matrix does NOT prove, which
    // says the same thing more plainly. The property is that the document keeps
    // refusing to read a green CI matrix as production proof.
    expect(report).toContain('не доказывает');
    expect(report).toContain('production и live-внешние интеграции подтверждены');
    expect(report).toContain('browser-accessibility matrix');
  });
});
