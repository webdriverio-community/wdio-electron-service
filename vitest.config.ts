import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'example/**/*'],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      exclude: ['test/**/*'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
});
