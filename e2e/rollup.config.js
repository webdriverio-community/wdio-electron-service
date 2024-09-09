import typescript from '@rollup/plugin-typescript';

const tsPlugin = typescript({ tsconfig: 'tsconfig.json' });

export default [
  {
    input: 'api.spec.ts',
    output: {
      dir: 'js',
      format: 'esm',
    },
    plugins: [tsPlugin],
  },
  {
    input: 'application.spec.ts',
    output: {
      dir: 'js',
      format: 'esm',
    },
    plugins: [tsPlugin],
  },
  {
    input: 'dom.spec.ts',
    output: {
      dir: 'js',
      format: 'esm',
    },
    plugins: [tsPlugin],
  },
  {
    input: 'interaction.spec.ts',
    output: {
      dir: 'js',
      format: 'esm',
    },
    plugins: [tsPlugin],
  },
];
