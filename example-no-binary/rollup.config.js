import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
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
  {
    input: 'dist/preload.js',
    output: {
      file: 'dist/preload.bundle.js',
      inlineDynamicImports: true,
      format: 'cjs',
    },
    plugins: [nodeResolve(), commonjs()],
    external: ['electron'],
  },
];
