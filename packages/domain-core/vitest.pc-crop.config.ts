import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/domain-core/src/commodity-profile.test.ts'],
    passWithNoTests: false,
    reporters: ['default'],
  },
});
