import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import { startSession } from 'wdio-electron-service';
import type { PackageJson } from 'read-package-up';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' }),
) as PackageJson;

const getBinaryExtension = () => {
  if (process.platform === 'darwin') {
    return '.app';
  } else if (process.platform === 'win32') {
    return '.exe';
  }

  return '';
};

const browser = await startSession({
  appBinaryPath: `./out/wdio-electron-service-example-${process.platform}-${process.arch}/wdio-electron-service-example${getBinaryExtension()}`,
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
