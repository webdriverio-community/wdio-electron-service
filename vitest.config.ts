import { configDefaults, defineConfig } from 'vitest/config';

const symlinkedCJSFiles = ['src/cjs/constants.ts', 'src/cjs/main.ts', 'src/cjs/preload.ts', 'src/cjs/types.ts'];

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'example*/**/*'],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      include: ['src/**/*'],
      exclude: [...symlinkedCJSFiles, 'src/types.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
