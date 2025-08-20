import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';

const nodeResolvePlugin = nodeResolve();
const commonjsPlugin = commonjs();

export default defineConfig([
  {
    input: 'dist/preload.js',
    output: {
      file: 'dist/preload.bundle.js',
      inlineDynamicImports: true,
      format: 'cjs',
    },
    plugins: [nodeResolvePlugin, commonjsPlugin],
    external: ['electron'],
  },
  {
    input: 'dist/main.js',
    output: {
      file: 'dist/main.bundle.js',
      inlineDynamicImports: true,
      format: 'cjs',
    },
    plugins: [nodeResolvePlugin, commonjsPlugin],
    external: ['electron'],
  },
]);
