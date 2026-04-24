#!/usr/bin/env node

const base = (process.env.SMOKE_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const url = `${base}/health`;
const maxAttempts = Number(process.env.SMOKE_ATTEMPTS || 3);
const retryDelayMs = Number(process.env.SMOKE_RETRY_DELAY_MS || 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(action) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === maxAttempts) break;
      console.warn(`[smoke:api] retry ${attempt}/${maxAttempts}: ${message}`);
      await sleep(retryDelayMs);
    }
  }
  throw lastError;
}

async function checkHealth() {
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
}

async function main() {
  console.log(`[smoke:api] attempts=${maxAttempts} retryDelay=${retryDelayMs}ms`);
  await withRetry(checkHealth);
  console.log('[smoke:api] ok');
}

main().catch((error) => {
  console.error(`[smoke:api] failed: ${error instanceof Error ? error.message : String(error)}`);
  globalThis.process.exitCode = 1;
});
