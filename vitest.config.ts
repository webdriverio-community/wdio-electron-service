import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'example/**/*'],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      exclude: ['test/**/*'],
      lines: 75,
      functions: 75,
      branches: 75,
      statements: 75,
    },
  },
});
