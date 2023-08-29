const { join } = require('path');
const fs = require('fs');
const { getDirname } = require('cross-dirname');

const dirname = getDirname();
const packageJson = JSON.parse(fs.readFileSync('../app/package.json'));
const {
  build: { productName },
} = packageJson;

process.env.TEST = true;

module.exports = {
  config: {
    services: [
      [
        'electron',
        {
          appPath: join(dirname, '..', 'app', 'dist'),
          appName: productName,
          appArgs: ['foo', 'bar=baz'],
          electronVersion: '26.0.0',
        },
      ],
    ],
    capabilities: [
      {
        browserName: 'electron',
      },
    ],
    waitforTimeout: 5000,
    connectionRetryCount: 10,
    connectionRetryTimeout: 30000,
    logLevel: 'debug',
    runner: 'local',
    outputDir: 'wdio-logs',
    specs: ['./test/*.spec.ts'],
    autoCompileOpts: {
      autoCompile: true,
      tsNodeOpts: {
        esm: false,
        transpileOnly: true,
        files: true,
        project: join(dirname, 'tsconfig.test.json'),
      },
    },
    framework: 'mocha',
    mochaOpts: {
      ui: 'bdd',
      timeout: 30000,
    },
  },
};
