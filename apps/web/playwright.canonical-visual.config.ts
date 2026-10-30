import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /platform-v7-(canonical-visual-evidence|crop-photo-consistency)\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-canonical-visual', open: 'never' }]],
  outputDir: 'test-results/canonical-visual',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    ...devices['Desktop Chrome'],
    browserName: 'chromium',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:3000/platform-v7?lang=ru',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
