import { defineConfig, devices } from '@playwright/test';

// Serve the unchanged production build behind an ephemeral, trusted TLS fixture.
// WebKit correctly refuses production Secure cookies on the old HTTP origin.
const tlsProxy = `
const fs = require("node:fs");
const https = require("node:https");
const http = require("node:http");
const server = https.createServer({
  key: fs.readFileSync(require("node:path").join(process.env.GEKTA_TEST_TLS_DIR, "server.key")),
  cert: fs.readFileSync(require("node:path").join(process.env.GEKTA_TEST_TLS_DIR, "server.crt")),
}, (request, response) => {
  const upstream = http.request({ hostname: "127.0.0.1", port: 3001,
    path: request.url, method: request.method,
    headers: { ...request.headers, "x-forwarded-proto": "https" },
  }, incoming => {
    response.writeHead(incoming.statusCode, incoming.headers);
    incoming.pipe(response);
  });
  upstream.on("error", () => { response.writeHead(502); response.end(); });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
});
server.listen(3000, "127.0.0.1");
`;

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
  webServer: [{
    command: 'pnpm start --hostname 127.0.0.1 --port 3001',
    url: 'http://127.0.0.1:3001/gekta',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  }, {
    command: `node -e '${tlsProxy.replaceAll("'", "'\\''")}'`,
    url: 'https://127.0.0.1:3000/gekta',
    reuseExistingServer: false,
    timeout: 120_000,
  }],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://127.0.0.1:3000',
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
