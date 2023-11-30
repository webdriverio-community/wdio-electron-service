import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'example/**/*'],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      exclude: ['test/**/*'],
      lines: 85,
      functions: 70,
      branches: 85,
      statements: 85,
    },
  },
});
