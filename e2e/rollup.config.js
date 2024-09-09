import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

const tsPlugin = typescript({ tsconfig: 'tsconfig.json' });

export default defineConfig([
  {
    input: 'api.spec.ts',
    output: {
      dir: 'js',
      format: 'esm',
    },
    plugins: [tsPlugin],
    external: ['@wdio/globals', '@vitest/spy', 'wdio-electron-service'],
  },
  {
    input: 'application.spec.ts',
    output: {
      dir: 'js',
      format: 'esm',
    },
    plugins: [tsPlugin],
    external: ['@wdio/globals', 'wdio-electron-service'],
  },
  {
    input: 'dom.spec.ts',
    output: {
      dir: 'js',
      format: 'esm',
    },
    plugins: [tsPlugin],
    external: ['@testing-library/webdriverio', '@wdio/globals', 'wdio-electron-service'],
  },
  {
    input: 'interaction.spec.ts',
    output: {
      dir: 'js',
      format: 'esm',
    },
    plugins: [tsPlugin],
    external: ['@testing-library/webdriverio', '@wdio/globals', 'wdio-electron-service'],
  },
]);
