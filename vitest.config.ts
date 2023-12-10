import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'example*/**/*'],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      include: ['src/**/*'],
      thresholds: {
        lines: 75,
        functions: 65,
        branches: 75,
        statements: 75,
      },
    },
  },
});
