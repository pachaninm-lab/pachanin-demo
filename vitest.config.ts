import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'apps/web/lib/**/*.test.ts',
      'apps/web/tests/**/*.test.ts',
      'shared/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'packages/domain-core/src/**/*.ts',
        'apps/web/lib/**/*.ts',
        'shared/**/*.ts',
      ],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
  },
});
