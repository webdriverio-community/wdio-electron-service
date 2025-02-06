import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/*.spec.ts'],
    exclude: [...configDefaults.exclude],
    environment: 'node',
    silent: true,
    coverage: {
      enabled: true,
      include: ['src/*.ts'],
      exclude: ['src/cjs/*.ts', 'src/constants.ts', 'src/log.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
    restoreMocks: true,
  },
});
