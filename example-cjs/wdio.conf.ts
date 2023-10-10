import path from 'node:path';
import fs from 'node:fs';

import { getBinaryPath } from 'wdio-electron-service/utils';

const packageJson = JSON.parse(fs.readFileSync('./package.json').toString());
const {
  build: { productName },
} = packageJson;

process.env.TEST = 'true';

exports.config = {
  services: ['electron'],
  capabilities: [
    {
      'browserName': 'electron',
      'browserVersion': '27.0.0',
      'wdio:electronServiceOptions': {
        appBinaryPath: getBinaryPath(__dirname, productName),
        appArgs: ['foo', 'bar=baz'],
      },
    },
  ],
  waitforTimeout: 5000,
  connectionRetryCount: 10,
  connectionRetryTimeout: 30000,
  logLevel: 'debug',
  runner: 'local',
  outputDir: 'wdio-logs',
  specs: ['./e2e/*.spec.ts'],
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      esm: false,
      project: path.join(__dirname, 'tsconfig.json'),
    },
  },
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
};
