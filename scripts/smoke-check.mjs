#!/usr/bin/env node

const base = (process.env.SMOKE_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const url = `${base}/health`;

async function main() {
  console.log(`[smoke:api] checking ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  const data = JSON.parse(text);
  if (data.status !== 'ok') {
    throw new Error(`Unexpected health response: ${text.slice(0, 160)}`);
  }

  console.log('[smoke:api] ok');
}

main().catch((error) => {
  console.error(`[smoke:api] failed: ${error.message}`);
  globalThis.process.exitCode = 1;
});
