const config = {
  esm: {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'es',
    },
  },
  cjs: {
    input: 'src/index.ts',
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
    },
  },
};

export default config;
