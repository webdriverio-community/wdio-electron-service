import eslint from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import vitest from 'eslint-plugin-vitest';
import wdio from 'eslint-plugin-wdio';
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
    ...eslint.configs.recommended,
  },
  // Node & Electron main process files and scripts
  {
    files: ['**/*.{js,mjs,ts}'],
    ignores: ['example*/src/preload.ts', 'example*/src/util.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Electron renderer process files
  {
    files: ['example*/src/preload.ts', 'example*/src/util.ts'],
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
      'no-redeclare': 'off', // redundant - TS will fail to compile with duplicate declarations
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
      '@typescript-eslint/no-explicit-any': ['warn'],
    },
  },
  // Example app TS files
  {
    files: ['example/**/*.ts'],
    ignores: ['example/out/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example/tsconfig.eslint.json',
      },
    },
  },
  {
    files: ['example-cjs/**/*.ts'],
    ignores: ['example-cjs/out/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example-cjs/tsconfig.eslint.json',
      },
    },
  },
  {
    files: ['example-electron-builder/**/*.ts'],
    ignores: ['example-electron-builder/out/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'example-electron-builder/tsconfig.eslint.json',
      },
    },
  },
  // Example E2E TS files
  {
    files: ['example*/e2e/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
    ...wdio.configs['flat/recommended'],
  },
  // Test files
  {
    files: ['test/**/*.spec.ts'],
    ...vitest.configs.recommended,
  },
  // ensure all rules work with prettier
  prettier,
];
