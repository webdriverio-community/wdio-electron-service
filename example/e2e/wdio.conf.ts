import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';

import { getBinaryPath } from 'wdio-electron-service/utils';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync('../app/package.json').toString());
const {
  build: { productName },
} = packageJson;

process.env.TEST = 'true';

export const config = {
  services: ['electron'],
  capabilities: [
    {
      'browserName': 'electron',
      'browserVersion': '26.2.2',
      'wdio:electronServiceOptions': {
        appBinaryPath: getBinaryPath(path.join(__dirname, '..', 'app'), productName),
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
  specs: ['./test/*.spec.ts'],
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      esm: true,
      transpileOnly: true,
      files: true,
      project: path.join(__dirname, 'tsconfig.json'),
    },
  },
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
};
