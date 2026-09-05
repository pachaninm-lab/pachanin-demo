import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    /(?:platform-v7|gekta)-production-mobile-acceptance\.spec\.ts/,
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
    ['html', { outputFolder: 'playwright-report-production-mobile', open: 'never' }],
  ],
  outputDir: 'test-results/production-mobile',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai',
    ignoreHTTPSErrors: false,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'production-mobile-chromium',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
    {
      name: 'production-mobile-webkit',
      use: { ...devices['Desktop Safari'], browserName: 'webkit' },
    },
  ],
});
