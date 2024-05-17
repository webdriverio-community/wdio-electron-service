import path from 'node:path';
import fs from 'node:fs';
import type { PackageJson } from 'read-package-up';
import type { Options } from '@wdio/types';

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), { encoding: 'utf-8' }),
) as PackageJson;

globalThis.packageJson = packageJson;
process.env.TEST = 'true';

export const config: Options.Testrunner = {
  services: ['electron'],
  waitforTimeout: 5000,
  connectionRetryCount: 10,
  connectionRetryTimeout: 30000,
  logLevel: 'debug',
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: path.join(__dirname, 'tsconfig.json'),
    },
  },
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
  outputDir: 'wdio-multiremote-logs',
  specs: ['./e2e-multiremote/*.ts'],
  capabilities: {
    browserA: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          appArgs: ['browser=A'],
        },
      } as WebdriverIO.Capabilities,
    },
    browserB: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          appArgs: ['browser=B'],
        },
      } as WebdriverIO.Capabilities,
    },
  },
};
