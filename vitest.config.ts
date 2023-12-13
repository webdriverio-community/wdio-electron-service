import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'example*/**/*'],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      include: ['src/**/*'],
      exclude: ['src/cjs/*.ts', 'src/index.ts', 'src/types.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
