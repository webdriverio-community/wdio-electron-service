import rollupTS from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

// Workaround for https://github.com/rollup/plugins/issues/1583
const tsPlugin = rollupTS({ tsconfig: 'tsconfig.json', module: 'nodeNext' });

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
    external: ['@wdio/globals', 'wdio-electron-service'],
  },
  {
    input: 'test/interaction.spec.ts',
    output: {
      dir: 'test/js',
      format: 'esm',
    },
    plugins: [tsPlugin],
    external: ['@wdio/globals', 'wdio-electron-service'],
  },
]);
