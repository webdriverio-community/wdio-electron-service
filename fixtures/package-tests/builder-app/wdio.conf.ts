import path from 'node:path';
import { tmpdir } from 'node:os';
import type { Options } from '@wdio/types';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./test/**/*.spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      'browserName': 'electron',
      'goog:chromeOptions': {
        args: ['--no-sandbox'],
      },
    },
  ],
  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ['electron'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  tsConfigPath: path.join(__dirname, 'tsconfig.json'),
};
