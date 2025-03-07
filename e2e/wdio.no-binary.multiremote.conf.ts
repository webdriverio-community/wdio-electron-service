import path from 'node:path';
import fs from 'node:fs';

import type { NormalizedPackageJson } from 'read-package-up';
import type { WdioElectronConfig } from '@wdio/electron-types';

import { testAppsManager } from './setup/testAppsManager.js';

const exampleDir = process.env.EXAMPLE_DIR;
if (!exampleDir) {
  throw new Error('EXAMPLE_DIR environment variable must be set');
}
// Extract moduleType from exampleDir (e.g., "no-binary-cjs" -> "cjs")
const moduleType = exampleDir.split('-').pop();

// Check if test apps have already been prepared by the runner script
let tmpDir: string;
if (process.env.WDIO_TEST_APPS_PREPARED === 'true' && process.env.WDIO_TEST_APPS_DIR) {
  tmpDir = process.env.WDIO_TEST_APPS_DIR;
  console.log('🔍 Debug: Using pre-prepared test apps from:', tmpDir);
} else {
  // This should not happen if using the suite-level setup
  console.warn('Warning: Test apps not prepared by suite-level setup. This may cause duplicate setup.');
  tmpDir = await testAppsManager.prepareTestApps();
}

const packageJsonPath = path.join(tmpDir, 'apps', exampleDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;
const appEntryPoint = path.join(tmpDir, 'apps', exampleDir, 'dist', 'main.bundle.js');

// Set globalThis.packageJson for tests
globalThis.packageJson = packageJson;
console.log('🔍 Debug: globalThis.packageJson set:', globalThis.packageJson);

// Set up the WebdriverIO configuration
export const config: WdioElectronConfig = {
  runner: 'local',
  specs: ['./test/multiremote/*.spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: {
    app1: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          appEntryPoint,
          appArgs: ['foo', 'bar=baz'],
        },
      },
    },
    app2: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          appEntryPoint,
          appArgs: ['foo', 'bar=baz'],
        },
      },
    },
  },
  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ['electron'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  outputDir: `logs/no-binary-${moduleType}-multiremote`,
  // Add onComplete hook to skip cleanup if test apps were prepared by the suite-level setup
  onComplete: async () => {
    if (process.env.WDIO_TEST_APPS_PREPARED === 'true') {
      console.log('🔍 Debug: Skipping cleanup as test apps were prepared by suite-level setup');
      return;
    }

    console.warn('Warning: Performing cleanup in individual test. This may cause issues with other tests.');
    await testAppsManager.cleanup();
  },
  // Add before hook to log debug information
  before: async () => {
    console.log('🔍 Debug: Starting no-binary multiremote test with appEntryPoint:', appEntryPoint);
  },
  // Add after hook to log debug information
  after: async () => {
    console.log('🔍 Debug: Completing no-binary multiremote test, cleaning up');
  },
};
