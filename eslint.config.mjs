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
      ...eslint.configs.recommended.rules,
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
          destructuredArrayIgnorePattern: '^_'
        }
      ],
    },
  },
  // Example app TS files
  {
    files: ['example/app/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example/app/tsconfig.json',
      },
    },
  },
  // Example e2e TS files
  {
    files: ['example/e2e/test/*.spec.ts', 'example/e2e-cjs/test/*.spec.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example/e2e-cjs/tsconfig.json',
      },
      globals: {
        ...wdio.configs.recommended.globals,
      },
    },
    plugins: {
      wdio,
    },
    rules: {
      ...wdio.configs.recommended.rules,
      '@typescript-eslint/no-var-requires': 'off'
    },
  },
  {
    files: ['example/e2e/test/*.spec.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example/e2e/tsconfig.json',
      },
    },
  },
  {
    files: ['example/e2e-cjs/test/*.spec.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example/e2e-cjs/tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off'
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
