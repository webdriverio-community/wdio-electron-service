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
      include: ['src/**/*.ts'],
      exclude: [
        // CLI entry point, tested via integration
        'src/cli.ts',
        // Type-only files
        'src/cli/types.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 75,
        lines: 70,
      },
    },
    testTimeout: 30000, // 30 seconds for integration tests
    setupFiles: [],
    pool: 'threads',
  },
});
