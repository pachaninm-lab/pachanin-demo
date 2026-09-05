import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    /gekta-production-mobile-acceptance\.spec\.ts/,
    /gekta-keyboard-start-acceptance\.spec\.ts/,
    /gekta-hero-density-acceptance\.spec\.ts/,
    /gekta-ios-safari-visual-polish-acceptance\.spec\.ts/,
  ],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-gekta-mobile-pr', open: 'never' }],
  ],
  outputDir: 'test-results/gekta-mobile-pr',
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:3000/gekta',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    ignoreHTTPSErrors: false,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'gekta-mobile-chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
    { name: 'gekta-mobile-webkit', use: { ...devices['Desktop Safari'], browserName: 'webkit' } },
  ],
});
