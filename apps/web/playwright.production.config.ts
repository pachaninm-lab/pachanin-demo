import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://vermillion-kitsune-0e7b97.netlify.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'production-mobile-375',
      testMatch: /platform-v7-production-auth-smoke\.spec\.ts/,
      use: {
        ...devices['iPhone 12'],
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'production-desktop',
      testMatch: /platform-v7-production-auth-smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
});
