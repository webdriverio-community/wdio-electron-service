import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import vitest from 'eslint-plugin-vitest';
import globals from 'globals';

// TODO:
// enable eslint-plugin-n
// enable eslint-plugin-promise
// enable eslint-plugin-vitest (recommended preset)
// enable eslint-plugin-wdio

export default [
  'eslint:recommended',
  // Ignored dirs
  {
    ignores: ['**/dist/**/*'],
  },
  // All files
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.es2021,
      },
    },
    rules: {
      ...prettier.rules,
    },
  },
  // Node & Electron main process files and scripts
  {
    files: ['**/*.{js,mjs,ts}'],
    ignores: ['example/app/preload.ts', 'example/app/util.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Electron renderer process files
  {
    files: ['example/app/preload.ts', 'example/app/util.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  // TS files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { modules: true },
        ecmaVersion: 'latest',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...ts.configs['eslint-recommended'].rules,
      ...ts.configs.recommended.rules,
      'no-undef': 'off', // redundant - TS will fail to compile with undefined vars
    },
  },
  // Example app TS files
  {
    files: ['example/app/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example/app/tsconfig.json',
      },
    },
  },
  // Example e2e TS files
  {
    files: ['example/e2e/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example/e2e/tsconfig.json',
      },
    },
  },
  // Test files
  {
    files: ['test/**/*.spec.ts'],
    plugins: {
      vitest,
    },
    languageOptions: {
      globals: {
        // ...globals.jest,
      },
    },
    rules: {
      // ...vitest.rules,
    },
  },
];
