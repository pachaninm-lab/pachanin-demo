import '@testing-library/jest-dom';
import { resolve } from 'node:path';
import { server } from '@/mocks/server';
import { beforeAll, afterEach, afterAll } from 'vitest';

// Many suites read source files relative to the package root. Pin the working
// directory to apps/web so results do not depend on where vitest was launched.
process.chdir(resolve(__dirname, '..'));

const LOCAL_BACKEND_ORIGIN = 'http://localhost:4000';
const TEST_APP_ORIGIN = 'http://localhost:3000';
const localBackendFetch = globalThis.fetch.bind(globalThis);
const MSW_BACKEND_PATHS = [
  /^\/api\/deals(?:\/[^/?]+)?(?:\/readiness|\/passport|\/release|\/nominal\/(?:reserve|confirm|complete))?$/,
  /^\/api\/fgis\/(?:sdiz|batch\/[^/?]+)$/,
  /^\/api\/disputes(?:\/[^/?]+)?$/,
  /^\/api\/bank\/status$/,
  /^\/api\/field\/events$/,
  /^\/api\/rfq(?:\/[^/?]+)?(?:\/offer|\/accept)?$/,
];

function installFetch(fetchImplementation: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: fetchImplementation,
  });
}

function localBackendPath(input: Parameters<typeof fetch>[0]) {
  const rawUrl = input instanceof Request ? input.url : String(input);
  const url = new URL(rawUrl, 'http://localhost');
  if (url.origin !== LOCAL_BACKEND_ORIGIN || !url.pathname.startsWith('/api/')) return null;
  return `${url.pathname}${url.search}`;
}

function localBackendFallback(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  const method = input instanceof Request ? input.method : String(init?.method || 'GET');
  const body = method.toUpperCase() === 'GET'
    ? { data: [], total: 0, source: 'vitest-local-backend-fallback' }
    : { success: true, sandbox: true, source: 'vitest-local-backend-fallback' };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hasMswBackendPath(pathWithSearch: string) {
  const pathname = pathWithSearch.split('?')[0];
  return MSW_BACKEND_PATHS.some((pattern) => pattern.test(pathname));
}

// Start MSW server before all tests. The descriptor remains configurable so
// individual Vitest suites can spy on or replace fetch without descriptor errors.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });

  installFetch(async (input, init) => {
    let backendPath: string | null = null;
    try {
      backendPath = localBackendPath(input);
    } catch {
      backendPath = null;
    }

    if (!backendPath) return localBackendFetch(input, init);
    if (!hasMswBackendPath(backendPath)) return localBackendFallback(input, init);

    try {
      const redirected = input instanceof Request
        ? new Request(`${TEST_APP_ORIGIN}${backendPath}`, input)
        : `${TEST_APP_ORIGIN}${backendPath}`;
      return await localBackendFetch(redirected, init);
    } catch {
      return localBackendFallback(input, init);
    }
  });
});

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Close server after all tests
afterAll(() => {
  installFetch(localBackendFetch);
  server.close();
});
