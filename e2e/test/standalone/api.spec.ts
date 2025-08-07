import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';
import { getAppBuildInfo, getBinaryPath, getElectronVersion } from '@wdio/electron-utils';
import type * as Electron from 'electron';

import type { NormalizedPackageJson } from 'read-package-up';
import { startWdioSession } from 'wdio-electron-service';

// Get the directory name once at the top
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

process.env.TEST = 'true';

// Check if we're running in binary or no-binary mode
const isBinary = process.env.BINARY !== 'false';
console.log('🔍 Debug: Starting standalone test with binary mode:', isBinary);

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
// Fixed path to use correct fixtures/e2e-apps location
const packageJsonPath = path.join(__dirname, '..', '..', '..', 'fixtures', 'e2e-apps', exampleDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;
const pkg = { packageJson, path: packageJsonPath };
const electronVersion = await getElectronVersion(pkg);

// Set up the session options based on binary/no-binary mode
let sessionOptions: any;
if (isBinary) {
  // Binary mode - use appBinaryPath
  const appBuildInfo = await getAppBuildInfo(pkg);
  const binaryResult = await getBinaryPath(packageJsonPath, appBuildInfo, electronVersion);

  // Extract the actual path string from the result object
  const appBinaryPath = typeof binaryResult === 'string' ? binaryResult : binaryResult.binaryPath;

  sessionOptions = {
    browserName: 'electron',
    'wdio:electronServiceOptions': {
      appBinaryPath,
      appArgs: ['foo', 'bar=baz'],
    },
  };
} else {
  // No-binary mode - use appEntryPoint
  const appEntryPoint = path.join(__dirname, '..', '..', '..', 'fixtures', 'e2e-apps', exampleDir, 'dist', 'main.js');
  console.log('Using app entry point:', appEntryPoint);

  if (!fs.existsSync(appEntryPoint)) {
    throw new Error(`App entry point not found: ${appEntryPoint}. Make sure the app is built.`);
  }

  sessionOptions = {
    browserName: 'electron',
    'wdio:electronServiceOptions': {
      appEntryPoint,
      appArgs: ['foo', 'bar=baz'],
    },
  };
}

console.log('🔍 Debug: Starting session with options:', JSON.stringify(sessionOptions, null, 2));
const browser = await startWdioSession([sessionOptions]);

// Helper function to get the expected app name consistent with other tests
const getExpectedAppName = (): string => {
  // If running in binary mode, use the package name from globalThis or packageJson
  if (isBinary) {
    return globalThis.packageJson?.name || packageJson.name;
  }
  // In no-binary mode, the app name will always be "Electron"
  return 'Electron';
};

// Get app name and check against expected value
const appName = await browser.electron.execute((electron: typeof Electron) => electron.app.getName());
const expectedAppName = getExpectedAppName();

if (appName !== expectedAppName) {
  throw new Error(`appName test failed: ${appName} !== ${expectedAppName}`);
}

// Get app version and check against expected value
const appVersion = await browser.electron.execute((electron: typeof Electron) => electron.app.getVersion());
// In binary mode, expect the package.json version; in no-binary mode, expect the Electron version
const expectedAppVersion = isBinary ? packageJson.version : electronVersion;
if (appVersion !== expectedAppVersion) {
  throw new Error(`appVersion test failed: ${appVersion} !== ${expectedAppVersion}`);
}

// Clean up - quit the app
await browser.deleteSession();

process.exit();
