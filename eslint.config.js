import eslint from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import * as wdio from 'eslint-plugin-wdio';
import globals from 'globals';
import importX from 'eslint-plugin-import-x';

export default [
  // Ignored dirs
  {
    ignores: ['**/dist/**/*', '@types/**/*'],
  },
  // Ignored files
  {
    ignores: ['**/*.config.js'],
  },
  // All files
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.es2021,
      },
      parserOptions: {
        ...importX.flatConfigs.recommended.parserOptions,
      },
    },
    plugins: {
      'import-x': importX,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...importX.flatConfigs.recommended.rules,
      'import-x/no-named-as-default': 'off',
      'import-x/no-unresolved': 'off',
    },
    settings: {
      'import-x/ignore': [/@rollup.*/, /shelljs/],
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
    settings: {
      ...importX.flatConfigs.electron.settings,
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
    settings: {
      ...importX.flatConfigs.electron.settings,
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
      'import-x': importX,
    },
    settings: {
      ...importX.configs.typescript.settings,
    },
    rules: {
      ...ts.configs['eslint-recommended'].rules,
      ...ts.configs.recommended.rules,
      ...importX.flatConfigs.typescript.rules,
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
  // Package TS files
  {
    files: ['packages/*/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'packages/*/tsconfig.eslint.json',
      },
    },
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: false }],
    },
  },
  // Package CJS TS files
  {
    files: ['packages/**/src/cjs/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'packages/*/tsconfig.eslint.json',
      },
    },
    rules: {
      'import-x/no-extraneous-dependencies': 'off',
    },
  },
  // Example app TS files
  {
    files: ['apps/builder-cjs/**/*.ts'],
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
    languageOptions: {
      parserOptions: {
        project: 'apps/builder-esm/tsconfig.eslint.json',
      },
    },
  },
  {
    files: ['apps/forge-cjs/**/*.ts'],
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
    languageOptions: {
      parserOptions: {
        project: 'apps/forge-esm/tsconfig.eslint.json',
      },
    },
  },
  {
    files: ['apps/no-binary-cjs/**/*.ts'],
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
