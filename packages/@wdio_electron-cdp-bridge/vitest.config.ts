import { configDefaults, defineConfig } from 'vitest/config';

const runE2E = Boolean(process.env.RUN_E2E);

const include = runE2E ? ['e2e/**/*.spec.ts'] : ['test/**/*.spec.ts'];
const testTimeout = runE2E ? 15000 : 5000;

export default defineConfig({
  test: {
    include,
    exclude: [...configDefaults.exclude, 'example*/**/*'],
    environment: 'node',
    clearMocks: true,
    testTimeout,
    silent: runE2E,
    coverage: {
      enabled: true,
      include: ['src/**/*'],
      exclude: ['src/index.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
