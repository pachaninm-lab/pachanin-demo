import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./apps/web/tests/setup.ts'],
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
