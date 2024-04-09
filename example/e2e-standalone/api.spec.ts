import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import { startSession } from 'wdio-electron-service';
import { expect } from '@wdio/globals';
import type { PackageJson } from 'read-package-up';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), { encoding: 'utf-8' }),
) as PackageJson;

const browser = await startSession({
  appBinaryPath: './out/wdio-electron-service-example-darwin-arm64/wdio-electron-service-example.app',
  appArgs: ['foo', 'bar=baz'],
});

const appName = await browser.electron.execute((electron) => electron.app.getName());
expect(appName).toStrictEqual(packageJson.name);
const appVersion = await browser.electron.execute((electron) => electron.app.getVersion());
expect(appVersion).toStrictEqual(packageJson.version);
