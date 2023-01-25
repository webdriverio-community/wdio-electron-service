import webpack from 'webpack';
import { getDirname } from 'cross-dirname';

const dirname = getDirname();
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
      path: `${dirname}/dist`,
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
      path: `${dirname}/dist`,
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
