import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import process from 'node:process';

import { startElectron } from 'wdio-electron-service';
import { isCI } from 'ci-info';
import type { PackageJson } from 'read-package-up';

process.env.TEST = 'true';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' }),
) as PackageJson;

const getBinaryExtension = () => {
  if (process.platform === 'darwin') {
    return '.app/Contents/MacOS/wdio-electron-service-example';
  } else if (process.platform === 'win32') {
    return '.exe';
  }

  return '';
};

const getBinaryPath = (packageName: string) =>
  `./out/${packageName}-${process.platform}-${process.arch}/${packageName}${getBinaryExtension()}`;

const browser = await startElectron({
  appBinaryPath: getBinaryPath('wdio-electron-service-example'),
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

// Clean up - quit the app as it remains loaded
// Linux uses xvfb on CI, app.quit will break the E2Es in this case
if (!isCI) {
  await browser.electron.execute((electron) => electron.app.quit());
}

process.exit();
