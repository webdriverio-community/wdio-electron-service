export default {
  esm: {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'es',
      sourcemap: process.env.NODE_ENV === 'development',
    },
    nodeExternals: {
      exclude: ['lodash'],
      optionalDependencies: false,
    },
  },
  cjs: {
    input: 'src/index.ts',
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      sourcemap: process.env.NODE_ENV === 'development',
    },
  },
  transformations: [
    {
      find: /^@\/(.*)$/,
      replacement: function (match, p1) {
        return new URL(`./src/${p1}`, import.meta.url).pathname;
      },
    },
  ],
};
