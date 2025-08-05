import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import process from 'node:process';

import { startWdioSession } from 'wdio-electron-service';
import { getBinaryPath, getAppBuildInfo, getElectronVersion } from '@wdio/electron-utils';

import type { NormalizedPackageJson } from 'read-package-up';
import type * as Electron from 'electron';

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
let sessionOptions;
if (isBinary) {
  // Binary mode - use appBinaryPath
  const appBuildInfo = await getAppBuildInfo(pkg);
  const binaryResult = await getBinaryPath(packageJsonPath, appBuildInfo, electronVersion);

  // Extract the actual path string from the result object
  const appBinaryPath = typeof binaryResult === 'string' ? binaryResult : binaryResult.binaryPath;

  sessionOptions = {
    'browserName': 'electron',
    'wdio:electronServiceOptions': {
      appBinaryPath,
      appArgs: ['foo', 'bar=baz'],
    },
  };
} else {
  // No-binary mode - use appEntryPoint
  // First try main.bundle.js (used by forge and no-binary apps)
  const bundlePath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'fixtures',
    'e2e-apps',
    exampleDir,
    'dist',
    'main.bundle.js',
  );
  // Fallback to main.js (used by builder apps)
  const mainJsPath = path.join(__dirname, '..', '..', '..', 'fixtures', 'e2e-apps', exampleDir, 'dist', 'main.js');

  let appEntryPoint: string;

  if (fs.existsSync(bundlePath)) {
    appEntryPoint = bundlePath;
    console.log('Using appEntryPoint (bundle):', appEntryPoint);
  } else if (fs.existsSync(mainJsPath)) {
    appEntryPoint = mainJsPath;
    console.log('Using appEntryPoint (main.js):', appEntryPoint);
  } else {
    throw new Error(
      `Could not find a valid entry point for ${exampleDir}. Checked:\n` + `  - ${bundlePath}\n` + `  - ${mainJsPath}`,
    );
  }

  sessionOptions = {
    'browserName': 'electron',
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
