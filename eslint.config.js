import eslint from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import vitest from '@vitest/eslint-plugin';
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
    ignores: ['apps/**/src/preload.ts', 'apps/**/src/util.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Electron renderer process files
  {
    files: ['apps/**/src/preload.ts', 'apps/**/src/util.ts'],
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
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'with-single-extends',
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
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': ['warn'],
    },
  },
  // Example app TS files
  {
    files: ['apps/builder-cjs/**/*.ts'],
    //    ignores: ['apps/builder-cjs/dist/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'apps/builder-cjs/tsconfig.eslint.json',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['apps/builder-esm/**/*.ts'],
    //    ignores: ['apps/builder-esm/dist/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'apps/builder-esm/tsconfig.eslint.json',
      },
    },
  },
  {
    files: ['apps/forge-cjs/**/*.ts'],
    //    ignores: ['apps/forge-cjs/out/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'apps/forge-cjs/tsconfig.eslint.json',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['apps/forge-esm/**/*.ts'],
    //    ignores: ['apps/builder-cjs/**/dist/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'apps/forge-esm/tsconfig.eslint.json',
      },
    },
  },
  {
    files: ['apps/no-binary-cjs/**/*.ts'],
    //    ignores: ['apps/builder-cjs/**/dist/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'apps/no-binary-cjs/tsconfig.eslint.json',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['apps/no-binary-esm/**/*.ts'],
    //    ignores: ['apps/no-binary-esm/**/dist/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'apps/no-binary-esm/tsconfig.eslint.json',
      },
    },
  },
  // Example E2E TS files
  {
    files: ['e2e/**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...wdio.configs['flat/recommended'].globals,
      },
    },
    plugins: {
      wdio,
    },
    rules: {
      ...wdio.configs['flat/recommended'].rules,
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  // Test files
  {
    files: ['packages/**/test/**/*.spec.ts'],
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
