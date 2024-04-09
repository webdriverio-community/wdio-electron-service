import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';

import { startSession } from 'wdio-electron-service';
import type { PackageJson } from 'read-package-up';

process.env.TEST = 'true';

const PACKAGE_NAME = 'wdio-electron-service-example-electron-builder';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' }),
) as PackageJson;

const getBinaryExtension = () => {
  if (process.platform === 'darwin') {
    return `.app/Contents/MacOS/${PACKAGE_NAME}`;
  } else if (process.platform === 'win32') {
    return '.exe';
  }

  return '';
};

const getBinaryPath = () =>
  `./out/${PACKAGE_NAME}-${process.platform}-${process.arch}/${PACKAGE_NAME}${getBinaryExtension()}`;

const browser = await startSession({
  appBinaryPath: getBinaryPath(),
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

process.exit();
