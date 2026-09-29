import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    testTimeout: 15000,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
  },
});
