import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/unit/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['components/v9/**', 'lib/v9/**', 'stores/**'],
      thresholds: { lines: 70 },
    },
  },
  resolve: {
    // Resolve source packages against the web app's existing React peer.
    dedupe: ['react', 'react-dom'],
    alias: {
      // Match the existing TypeScript source mapping for this package, which
      // is deliberately excluded from pnpm workspace package linking.
      '@pc/design-system-v8': path.resolve(
        __dirname,
        '../../packages/design-system-v8/src/index.ts',
      ),
      // The boundary validates through the API's contract module itself rather
      // than a copy, so the test run must resolve the same file the build does.
      '@pc/ai-assistant-stream-contract': path.resolve(
        __dirname,
        '../api/src/modules/ai-insights/ai-assistant-stream.contract.ts',
      ),
      '@pc/ai-assistant-admission-manifest': path.resolve(
        __dirname,
        '../api/src/modules/ai-insights/ai-assistant-admission.manifest.ts',
      ),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
