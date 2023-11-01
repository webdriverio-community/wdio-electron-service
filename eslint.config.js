import eslint from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import vitest from 'eslint-plugin-vitest';
import * as wdio from 'eslint-plugin-wdio';
import globals from 'globals';

export default [
  // Ignored dirs
  {
    ignores: ['**/dist/**/*', '@types/**/*'],
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
      ...eslint.configs.recommended.rules,
    },
  },
  // Node & Electron main process files and scripts
  {
    files: ['**/*.{js,mjs,ts}'],
    ignores: ['example/src/preload.ts', 'example/src/util.ts', 'example-cjs/src/preload.ts', 'example-cjs/src/util.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Electron renderer process files
  {
    files: ['example/src/preload.ts', 'example/src/util.ts', 'example-cjs/src/preload.ts', 'example-cjs/src/util.ts'],
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
        project: './tsconfig.base.json',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...ts.configs['eslint-recommended'].rules,
      ...ts.configs.recommended.rules,
      'no-undef': 'off', // redundant - TS will fail to compile with undefined vars
      '@typescript-eslint/no-empty-interface': [
        'error',
        {
          allowSingleExtends: true,
        },
      ],
      '@typescript-eslint/no-namespace': [
        'error',
        {
          allowDeclarations: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': [
        'warn'
      ]
    },
  },
  // Example app TS files
  {
    files: ['example/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example/tsconfig.json',
      },
    },
  },
  {
    files: ['example-cjs/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example-cjs/tsconfig.json',
      },
    },
  },
  // Example E2E TS files
  {
    files: ['example/e2e/*.spec.ts', 'example-cjs/e2e/*.spec.ts'],
    languageOptions: {
      globals: {
        ...wdio.configs.recommended.globals,
      },
    },
    plugins: {
      wdio,
    },
    rules: {
      ...wdio.configs.recommended.rules,
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  // Test files
  {
    files: ['test/**/*.spec.ts'],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
  },
  // ensure all rules work with prettier
  prettier,
];
