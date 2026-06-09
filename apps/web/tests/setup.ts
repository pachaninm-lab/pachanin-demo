import '@testing-library/jest-dom';
import { resolve } from 'node:path';
import { server } from '@/mocks/server';
import { beforeAll, afterEach, afterAll } from 'vitest';

// Many suites read source files relative to the package root. Pin the working
// directory to apps/web so results do not depend on where vitest was launched.
process.chdir(resolve(__dirname, '..'));

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Close server after all tests
afterAll(() => server.close());
