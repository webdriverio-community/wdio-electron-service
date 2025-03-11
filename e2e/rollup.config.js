import rollupTS from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

// Use the specific tsconfig for Rollup
const tsPlugin = rollupTS({ tsconfig: 'tsconfig.rollup.json', module: 'nodeNext' });

export default defineConfig([
  {
    input: 'test/api.spec.ts',
    output: {
      dir: 'test/js',
      format: 'esm',
    },
    plugins: [tsPlugin],
    external: ['@wdio/globals', '@vitest/spy', 'wdio-electron-service'],
  },
  {
    input: 'test/application.spec.ts',
    output: {
      dir: 'test/js',
      format: 'esm',
    },
    plugins: [tsPlugin],
    external: ['@wdio/globals', 'wdio-electron-service'],
  },
  {
    input: 'test/dom.spec.ts',
    output: {
      dir: 'test/js',
      format: 'esm',
    },
    plugins: [tsPlugin],
    external: ['@testing-library/webdriverio', '@wdio/globals', 'wdio-electron-service'],
  },
  {
    input: 'test/interaction.spec.ts',
    output: {
      dir: 'test/js',
      format: 'esm',
    },
    plugins: [tsPlugin],
    external: ['@testing-library/webdriverio', '@wdio/globals', 'wdio-electron-service'],
  },
]);
