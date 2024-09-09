import typescript from '@rollup/plugin-typescript';

export default {
  input: '*.spec.ts',
  output: {
    dir: 'js',
    format: 'esm',
  },
  plugins: [typescript()],
};
