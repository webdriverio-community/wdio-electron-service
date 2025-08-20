import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';
import { getAppBuildInfo, getBinaryPath, getElectronVersion } from '@wdio/electron-utils';
import { xvfb } from '@wdio/xvfb';
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

// Initialize xvfb if running on Linux
if (process.platform === 'linux') {
  console.log('🔍 Linux detected: initializing xvfb for standalone tests...');
  await xvfb.init();
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

// Wait a moment to ensure browser is fully initialized with all service capabilities
await new Promise((resolve) => setTimeout(resolve, 1000));

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

// Now that we've confirmed browser.electron.execute works, let's test mocking
console.log('🔍 Browser is initialized, testing mock functionality...');

// Test 1: Basic mock test (should work) - using browser.electron.execute like the working test
console.log('🔍 Testing basic mock with browser.electron.execute...');
try {
  console.log(
    '🔍 Debug: Checking browser.electron availability before mocking:',
    typeof browser?.electron,
    typeof browser?.electron?.mock,
  );

  const basicMock = await browser.electron.mock('dialog', 'showOpenDialog');
  console.log('✅ Basic mock created successfully');

  // Call the mocked function directly via execute (like the working test)
  await browser.electron.execute(async (electron) => {
    await electron.dialog.showOpenDialog({
      title: 'basic test dialog',
      properties: ['openFile'],
    });
    return (electron.dialog.showOpenDialog as any).mock.calls;
  });

  // Check if the mock was called
  const basicCalls = basicMock.mock.calls.length;
  console.log(`📊 Basic mock calls: ${basicCalls}`);

  if (basicCalls !== 1) {
    throw new Error(`Basic mock test failed: expected 1 call, got ${basicCalls}`);
  }
  console.log('✅ Basic mock test passed');
} catch (error) {
  console.error('❌ Basic mock test failed:', error);
  throw error;
}

// Test 2: Complex UI-triggered mock test (currently failing) - using DOM interaction
console.log('🔍 Testing complex UI-triggered mock...');
try {
  const complexMock = await browser.electron.mock('dialog', 'showOpenDialog');
  console.log('✅ Complex mock created successfully');

  // Use DOM interaction like the failing test
  const showDialogButton = await browser.$('.show-dialog');
  if (!showDialogButton) {
    throw new Error('Show dialog button not found');
  }

  await showDialogButton.click();
  console.log('🖱️ Clicked show dialog button');

  // Check if the mock was called (this is where it likely fails)
  const complexCalls = complexMock.mock.calls.length;
  console.log(`📊 Complex mock calls before update: ${complexCalls}`);

  // Try manual update in case auto-update isn't working
  await complexMock.update();
  const complexCallsAfterUpdate = complexMock.mock.calls.length;
  console.log(`📊 Complex mock calls after update: ${complexCallsAfterUpdate}`);

  if (complexCallsAfterUpdate !== 1) {
    throw new Error(`Complex mock test failed: expected 1 call, got ${complexCallsAfterUpdate}`);
  }
  console.log('✅ Complex mock test passed');
} catch (error) {
  console.error('❌ Complex mock test failed:', error);
  // Don't throw - we expect this to fail, that's what we're investigating
  console.log("ℹ️ Complex mock test failed as expected - this is the issue we're debugging");
}

// Clean up - quit the app
await browser.deleteSession();

process.exit();
