import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'apps/web/lib/**/*.test.ts',
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
