import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://pachanin-web.vercel.app',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-375',
      testMatch: /platform-v7-mobile-smoke\.spec\.ts/,
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'visual-desktop',
      testMatch: /platform-v7-visual-smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
});
