import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import { getAppBuildInfo, getBinaryPath, getElectronVersion } from '@wdio/electron-utils';

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, '..', 'apps', exampleDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' }));
const pkg = { packageJson, path: packageJsonPath };
const electronVersion = getElectronVersion(pkg);
const appBuildInfo = await getAppBuildInfo(pkg);
const appBinaryPath = await getBinaryPath(packageJsonPath, appBuildInfo, electronVersion);

globalThis.packageJson = packageJson;
// process.env.TEST = 'true';

export const config = {
  services: [['electron', { restoreMocks: true }]],
  capabilities: [
    {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        appBinaryPath,
        appArgs: ['foo', 'bar=baz'],
      },
    },
  ],
  waitforTimeout: 5000,
  connectionRetryCount: 10,
  connectionRetryTimeout: 30000,
  logLevel: 'trace',
  runner: 'local',
  outputDir: `wdio-logs-${exampleDir}`,
  specs: ['./test/js/*.spec.js'],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
};
