import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /platform-v7-production-mobile-acceptance\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-production-mobile', open: 'never' }],
  ],
  outputDir: 'test-results/production-mobile',
  use: {
    ...devices['Desktop Chrome'],
    browserName: 'chromium',
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
    },
  ],
});
