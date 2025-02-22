import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import type { NormalizedPackageJson } from 'read-package-up';

import { getAppBuildInfo, getBinaryPath, getElectronVersion } from '@wdio/electron-utils';
import type { WdioElectronConfig } from '@wdio/electron-types';
import { testAppsManager } from './setup/testAppsManager.js';
import { Capabilities, Options } from '@wdio/types';

type WdioConfig = Options.Testrunner & {
  capabilities: Capabilities.ResolvedTestrunnerCapabilities[];
};

const exampleDir = process.env.EXAMPLE_DIR;
if (!exampleDir) {
  throw new Error('EXAMPLE_DIR environment variable must be set');
}
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const tmpDir = await testAppsManager.prepareTestApps();
const packageJsonPath = path.join(tmpDir, 'apps', exampleDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;
const pkg = { packageJson, path: packageJsonPath };
const electronVersion = getElectronVersion(pkg);
const appBuildInfo = await getAppBuildInfo(pkg);
const appBinaryPath = await getBinaryPath(packageJsonPath, appBuildInfo, electronVersion);

globalThis.packageJson = packageJson;
process.env.TEST = 'true';

const isSplashEnabled = Boolean(process.env.ENABLE_SPLASH_WINDOW);
const specs = isSplashEnabled ? ['./test/window/window.spec.ts'] : ['./test/*.spec.ts'];

export const config: WdioElectronConfig = {
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
  logLevel: 'debug',
  runner: 'local',
  outputDir: `wdio-logs-${exampleDir}`,
  specs,
  tsConfigPath: path.join(__dirname, 'tsconfig.json'),
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
  onComplete: async () => {
    await testAppsManager.cleanup();
  },
};
