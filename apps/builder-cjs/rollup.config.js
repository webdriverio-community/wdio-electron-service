import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
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
