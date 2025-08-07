import tsParser from '@typescript-eslint/parser';
import vitest from '@vitest/eslint-plugin';
import * as wdio from 'eslint-plugin-wdio';

export default [
  // Ignored dirs
  {
    ignores: [
      '**/dist/**/*',
      '@types/**/*',
      'fixtures/config-formats/invalid-syntax.ts',
      'fixtures/package-tests/**/*',
      '**/coverage/**/*',
    ],
  },
  // Example E2E TS files - WebdriverIO specific rules
  {
    files: ['e2e/**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        project: './tsconfig.base.json',
      },
      globals: {
        ...wdio.configs['flat/recommended'].globals,
      },
    },
    plugins: {
      wdio,
    },
    rules: {
      ...wdio.configs['flat/recommended'].rules,
    },
  },
  // Test files - Vitest specific rules
  {
    files: ['packages/**/test/**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        project: 'packages/*/tsconfig.eslint.json',
      },
    },
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
  },
];
