module.exports = {
  preset: 'ts-jest/presets/default-esm',
  coverageReporters: ['html', 'lcov', 'text'],
  coverageDirectory: '<rootDir>/coverage',
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/src/*.ts'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts'],
  rootDir: '.',
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  modulePathIgnorePatterns: ['dist', '.node_modules_production'],
  testMatch: ['<rootDir>/test/*.spec.ts'],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'https://github.com/webdriverio-community/wdio-electron-service',
  },
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'), // https://github.com/uuidjs/uuid/pull/616#issuecomment-1111006686
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
      useESM: true,
      tsconfig: './tsconfig.json',
      packageJson: './package.json',
    },
  },
};
