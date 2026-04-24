#!/usr/bin/env node

const DEFAULT_PATHS = [
  '/platform-v7',
  '/platform-v7/control-tower',
  '/platform-v7/deals',
  '/platform-v7/deals/DL-9102',
  '/platform-v7/buyer',
  '/platform-v7/compliance',
  '/platform-v7/field',
  '/platform-v7/disputes/DK-2024-89',
];

const baseUrl = normalizeBaseUrl(
  process.env.SMOKE_WEB_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000'
);

const paths = (process.env.SMOKE_WEB_PATHS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

const checks = paths.length ? paths : DEFAULT_PATHS;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 12000);

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function withTimeout(promise, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`${label} timed out after ${ms}ms`)), ms);
  return Promise.resolve(promise(controller.signal)).finally(() => clearTimeout(timer));
}

async function checkPath(path) {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const startedAt = Date.now();
  const response = await withTimeout((signal) => fetch(url, { redirect: 'follow', signal }), timeoutMs, url);
  const elapsed = Date.now() - startedAt;
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status} ${response.statusText}`);
  }
  if (!text || text.length < 200) {
    throw new Error(`${path} returned suspiciously small body (${text.length} chars)`);
  }
  if (!text.includes('__next') && !text.includes('<html')) {
    throw new Error(`${path} does not look like a rendered Next.js page`);
  }

  return { path, status: response.status, elapsed };
}

async function main() {
  console.log(`[smoke:web] base=${baseUrl}`);
  const results = [];
  for (const path of checks) {
    const result = await checkPath(path);
    results.push(result);
    console.log(`[smoke:web] ok ${result.status} ${result.elapsed}ms ${result.path}`);
  }
  console.log(`[smoke:web] passed ${results.length}/${checks.length}`);
}

main().catch((error) => {
  console.error(`[smoke:web] failed: ${error.message}`);
  process.exit(1);
});
