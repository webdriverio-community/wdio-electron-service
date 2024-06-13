import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import process from 'node:process';

import { startElectron } from 'wdio-electron-service';
import type { PackageJson } from 'read-package-up';

process.env.TEST = 'true';

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'examples', exampleDir, 'package.json'), { encoding: 'utf-8' }),
) as PackageJson;

const getBinaryExtension = (packageName: string) => {
  if (process.platform === 'darwin') {
    return `.app/Contents/MacOS/${packageName}`;
  } else if (process.platform === 'win32') {
    return '.exe';
  }

  return '';
};

const getBinaryPath = (packageName: string) => {
  const builderBinaryDirMap = (arch: string) => ({
    darwin: arch === 'x64' ? 'mac' : `mac-${arch}`,
    linux: 'linux-unpacked',
    win32: 'win-unpacked',
  });
  const isForge = exampleDir.startsWith('forge');
  const outputDir = isForge ? 'out' : 'dist';
  const platform = process.platform as 'darwin' | 'linux' | 'win32';
  const binaryDir = isForge
    ? `${packageName}-${process.platform}-${process.arch}`
    : builderBinaryDirMap(process.arch)[platform];
  const binaryName = `${packageName}${getBinaryExtension(packageName)}`;

  return path.join(__dirname, '..', '..', 'examples', exampleDir, outputDir, binaryDir, binaryName);
};

const browser = await startElectron({
  appBinaryPath: getBinaryPath(`example-${exampleDir}`),
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
