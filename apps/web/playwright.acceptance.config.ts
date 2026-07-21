import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const secret = process.env.PC_ACCEPTANCE_JWT_SECRET || 'pc-design-system-v8-acceptance-secret-2026';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /platform-v7-(design-system-v8-acceptance|public-product-experience-v3|public-intelligence-layer)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'design-system-v8-acceptance-results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'desktop-firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'desktop-webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'android-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'iphone-webkit',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'pnpm start',
    url: `${baseURL}/platform-v7`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      JWT_SECRET: secret,
      PC_CABINET_SESSION_SECRET: secret,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
