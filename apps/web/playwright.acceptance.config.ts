import { defineConfig, devices } from '@playwright/test';

// The acceptance run signs in for real, and a real login sets Secure cookies
// because the app runs in production mode. WebKit will not store a Secure
// cookie delivered over plain http://localhost, so the matrix is served over
// TLS — which is also what production does. The port stays 3000 because Next
// builds its own request URL from the TLS socket's scheme and its configured
// port; on any other port the browser's Origin and Next's computed origin
// disagree and the same-origin CSRF check correctly rejects every login.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:3000';
const secret = process.env.PC_ACCEPTANCE_JWT_SECRET || 'pc-design-system-v8-acceptance-secret-2026';
const tlsCert = process.env.PC_ACCEPTANCE_TLS_CERT || '.acceptance-tls/tls.crt';
const tlsKey = process.env.PC_ACCEPTANCE_TLS_KEY || '.acceptance-tls/tls.key';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /platform-v7-(design-system-v8-acceptance|public-product-experience-v3|public-intelligence-layer|strategic-home-v3|home-brand-visibility|hero-card-min14)\.spec\.ts/,
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
    // Self-signed certificate, generated per run for localhost only.
    ignoreHTTPSErrors: true,
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
    command: 'node tests/e2e/support/acceptance-https-server.mjs',
    url: `${baseURL}/platform-v7`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      JWT_SECRET: secret,
      PC_CABINET_SESSION_SECRET: secret,
      PC_ACCEPTANCE_TLS_CERT: tlsCert,
      PC_ACCEPTANCE_TLS_KEY: tlsKey,
      PC_ACCEPTANCE_HTTPS_PORT: '3000',
      // The acceptance run logs in for real, so the web server needs the same
      // API and second-factor configuration production has. Without these the
      // login route fails closed and no cabinet can open.
      API_URL: process.env.API_URL || 'http://127.0.0.1:4000/api',
      MFA_LOGIN_TICKET_SECRET:
        process.env.MFA_LOGIN_TICKET_SECRET || 'pc-design-system-v8-acceptance-mfa-ticket-secret-2026',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
