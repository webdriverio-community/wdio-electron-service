import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      include: ['src/**/*'],
      exclude: ['src/cjs/*.ts', 'src/index.ts', 'src/types.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
