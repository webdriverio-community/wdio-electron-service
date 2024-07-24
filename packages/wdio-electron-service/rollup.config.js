import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  {
    input: 'dist/mock.js',
    output: {
      file: 'dist/mock.bundle.js',
      inlineDynamicImports: true,
      format: 'esm',
    },
    plugins: [nodeResolve()],
    external: ['electron'],
  },
];
