import { join } from 'path';
import fs from 'fs';
import { getDirname } from 'cross-dirname';

const dirname = getDirname();
const packageJson = JSON.parse(fs.readFileSync('../app/package.json'));
const {
  build: { productName },
} = packageJson;

process.env.TEST = true;

export const config = {
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
      esm: true,
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
};
