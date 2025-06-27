import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    exclude: ['test/fixtures/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'test/**',
        'dist/**',
        'src/cli.ts', // CLI entry point, tested via integration
      ],
    },
    testTimeout: 30000, // 30 seconds for integration tests
    setupFiles: [],
    pool: 'threads',
  },
});
