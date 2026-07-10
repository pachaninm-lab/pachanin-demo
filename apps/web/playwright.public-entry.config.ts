import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.PUBLIC_ENTRY_BASE_URL || 'http://127.0.0.1:3000';
const includeEdge = process.env.PLAYWRIGHT_INCLUDE_EDGE === '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: /platform-v7-public-entry-industrial\.spec\.ts/,
  outputDir: 'test-results/public-entry',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report/public-entry', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report/public-entry', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    ignoreHTTPSErrors: false,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'iphone-se-webkit', use: { ...devices['iPhone SE'] } },
    { name: 'iphone-13-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'iphone-pro-max-webkit', use: { ...devices['iPhone 13 Pro Max'] } },
    { name: 'pixel-chromium', use: { ...devices['Pixel 7'] } },
    ...(includeEdge
      ? [{ name: 'desktop-edge', use: { ...devices['Desktop Edge'], channel: 'msedge' as const, viewport: { width: 1440, height: 900 } } }]
      : []),
  ],
});
