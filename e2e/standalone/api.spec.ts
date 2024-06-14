import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import process from 'node:process';

import { startElectron } from 'wdio-electron-service';
import type { PackageJson } from 'read-package-up';

import { getBinaryPath } from '../utils.js';

process.env.TEST = 'true';

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'examples', exampleDir, 'package.json'), { encoding: 'utf-8' }),
) as PackageJson;

const browser = await startElectron({
  appBinaryPath: getBinaryPath(exampleDir, path.join(__dirname, '..', '..')),
  appArgs: ['foo', 'bar=baz'],
});

const appName = await browser.electron.execute((electron) => electron.app.getName());
if (appName !== packageJson.name) {
  throw new Error(`appName test failed: ${appName} !== ${packageJson.name}`);
}

const appVersion = await browser.electron.execute((electron) => electron.app.getVersion());
if (appVersion !== packageJson.version) {
  throw new Error(`appVersion test failed: ${appVersion} !== ${packageJson.version}`);
}

// Clean up - quit the app
await browser.deleteSession();

process.exit();
