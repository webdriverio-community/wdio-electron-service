import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import type { NormalizedPackageJson } from 'read-package-up';
import type { Options } from '@wdio/types';

import { getElectronVersion } from '@wdio/electron-utils';

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, '..', 'apps', exampleDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;
const appEntryPoint = path.join(__dirname, '..', 'apps', exampleDir, 'dist', 'main.bundle.js');

globalThis.packageJson = {
  name: 'Electron',
  version: getElectronVersion({ packageJson, path: packageJsonPath }) as string,
};
process.env.TEST = 'true';

export const config: Options.Testrunner = {
  services: ['electron'],
  capabilities: [
    {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        appEntryPoint,
        appArgs: ['foo', 'bar=baz'],
        restoreMocks: true,
      },
    } as WebdriverIO.Capabilities,
  ],
  waitforTimeout: 5000,
  connectionRetryCount: 10,
  connectionRetryTimeout: 30000,
  logLevel: 'debug',
  runner: 'local',
  outputDir: `wdio-logs-${exampleDir}`,
  specs: ['./*.spec.ts'],
  tsConfigPath: path.join(__dirname, 'tsconfig.json'),
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
};
