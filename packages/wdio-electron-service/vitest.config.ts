import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'example*/**/*'],
    environment: 'jsdom',
    setupFiles: 'test/setup.ts',
    silent: true,
    coverage: {
      enabled: true,
      include: ['src/**/*'],
      exclude: ['src/cjs/*.ts', 'src/index.ts'],
      // thresholds: {
      //   lines: 85,
      //   functions: 85,
      //   branches: 85,
      //   statements: 85,
      // },
    },
  },
});
