import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import process from 'node:process';

import shelljs from 'shelljs';

import { startWdioSession } from 'wdio-electron-service';
import type { NormalizedPackageJson } from 'read-package-up';

import { getElectronVersion } from '@wdio/electron-utils';

process.env.TEST = 'true';

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, '..', '..', '..', 'apps', exampleDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;
const pkg = { packageJson, path: packageJsonPath };
const appEntryPoint = path.join(__dirname, '..', '..', '..', 'apps', exampleDir, 'dist', 'main.bundle.js');
const electronVersion = await getElectronVersion(pkg);

const logDir = path.join(__dirname, '..', '..', `wdio-logs-${exampleDir}`);
shelljs.mkdir('-p', logDir);
process.env.WDIO_LOG_PATH = path.join(logDir, 'wdio-standalone.log');

const browser = await startWdioSession([
  {
    'browserName': 'electron',
    'wdio:electronServiceOptions': {
      appEntryPoint,
      appArgs: ['foo', 'bar=baz'],
    },
  },
]);

const appName = await browser.electron.execute((electron) => electron.app.getName());
if (appName !== 'Electron') {
  throw new Error(`appName test failed: ${appName} !== Electron`);
}

const appVersion = await browser.electron.execute((electron) => electron.app.getVersion());
if (appVersion !== electronVersion) {
  throw new Error(`appVersion test failed: ${appVersion} !== ${electronVersion}`);
}

// Clean up - quit the app
await browser.deleteSession();

process.exit();
