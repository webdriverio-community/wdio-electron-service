/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    /**
     * not to ESM ported packages
     */
    exclude: ['dist', '.idea', '.git', '.cache', '**/node_modules/**'],
    coverage: {
      enabled: true,
      exclude: ['**/build/**', '**/__fixtures__/**', '**/*.test.ts'],
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
});

// module.exports = {
//   preset: 'ts-jest/presets/default-esm',
//   coverageReporters: ['html', 'lcov', 'text'],
//   coverageDirectory: '<rootDir>/coverage',
//   testPathIgnorePatterns: ['<rootDir>/node_modules/'],
//   collectCoverage: true,
//   collectCoverageFrom: ['<rootDir>/src/*.ts'],
//   coverageThreshold: {
//     global: {
//       branches: 85,
//       functions: 85,
//       lines: 85,
//       statements: 85,
//     },
//   },
//   clearMocks: true,
//   extensionsToTreatAsEsm: ['.ts'],
//   rootDir: '.',
//   roots: ['<rootDir>'],
//   modulePaths: ['<rootDir>'],
//   modulePathIgnorePatterns: ['dist', '.node_modules_production'],
//   testMatch: ['<rootDir>/test/*.spec.ts'],
//   testEnvironment: 'jsdom',
//   testEnvironmentOptions: {
//     url: 'https://github.com/webdriverio-community/wdio-electron-service',
//   },
//   moduleNameMapper: {
//     '^(\\.{1,2}/.*)\\.js$': '$1',
//   },
//   globals: {
//     'ts-jest': {
//       isolatedModules: true,
//       useESM: true,
//       tsconfig: './tsconfig.json',
//       packageJson: './package.json',
//     },
//   },
// };
