import url from 'node:url';
import path from 'node:path';
import webpack from 'webpack';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const plugins = [new webpack.ProgressPlugin()];
const mode = 'production';

export default [
  {
    mode,
    entry: ['./src/main.ts'],
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'tsconfig.json',
                transpileOnly: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
      ],
    },
    output: {
      path: `${__dirname}/dist`,
      filename: `main.mjs`,
      libraryTarget: 'module',
      module: true,
      chunkFormat: 'module',
    },
    plugins,
    resolve: {
      extensions: ['.ts', '.js'],
    },
    target: 'electron28.0-main',
    node: {
      __dirname: true,
      __filename: true,
    },
    experiments: {
      topLevelAwait: true,
      outputModule: true,
    },
  },
  {
    mode,
    entry: ['./src/preload.ts'],
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'tsconfig.json',
                transpileOnly: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
      ],
    },
    output: {
      path: `${__dirname}/dist`,
      filename: `preload.mjs`,
      libraryTarget: 'module',
      library: {
        type: 'module',
      },
      module: true,
      chunkFormat: 'module',
    },
    plugins,
    resolve: {
      extensions: ['.ts', '.js'],
    },
    target: 'electron28.0-preload',
    node: {
      __dirname: true,
      __filename: true,
    },
    experiments: {
      topLevelAwait: true,
      outputModule: true,
    },
  },
];
