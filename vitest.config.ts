import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'example*/**/*'],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      include: ['src/**/*'],
      // exclude symlinked CJS files from coverage
      exclude: ['src/cjs/constants.ts', 'src/cjs/main.ts', 'src/cjs/preload.ts', 'src/cjs/types.ts'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
      },
    },
  },
});
