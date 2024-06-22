import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/*.spec.ts'],
    exclude: [...configDefaults.exclude],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      include: ['src/*.ts'],
      exclude: ['src/cjs/*.ts', 'src/constants.ts', 'src/log.ts'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
      },
    },
  },
});
