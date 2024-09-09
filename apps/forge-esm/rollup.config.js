import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { defineConfig } from 'rollup';

export default defineConfig([
  {
    input: 'dist/preload.js',
    output: {
      file: 'dist/preload.bundle.cjs',
      inlineDynamicImports: true,
      format: 'cjs',
    },
    plugins: [nodeResolve(), commonjs()],
    external: ['electron'],
  },
  {
    input: 'dist/main.js',
    output: {
      file: 'dist/main.bundle.js',
      inlineDynamicImports: true,
      format: 'esm',
    },
    plugins: [nodeResolve()],
    external: ['electron'],
  },
]);
