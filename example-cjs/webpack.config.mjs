import url from 'node:url';
import path from 'node:path';
import webpack from 'webpack';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const plugins = [new webpack.ProgressPlugin()];
const mode = 'development';

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
      filename: `main.js`,
    },
    plugins,
    resolve: {
      extensions: ['.ts', '.js'],
    },
    target: 'electron-main',
    node: {
      __dirname: true,
      __filename: true,
    },
    experiments: {
      topLevelAwait: true,
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
      filename: `preload.js`,
    },
    plugins,
    resolve: {
      extensions: ['.ts', '.js'],
    },
    target: 'electron-preload',
    node: {
      __dirname: true,
      __filename: true,
    },
    experiments: {
      topLevelAwait: true,
    },
  },
];
