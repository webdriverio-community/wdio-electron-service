/// <reference types="mocha" />
import path from 'node:path';
import fs from 'node:fs';

import type { WdioElectronConfig } from '@wdio/electron-types';
import type { NormalizedPackageJson } from 'read-package-up';
import { getBinaryPath, getAppBuildInfo, getElectronVersion } from '@wdio/electron-utils';

import { testAppsManager } from './setup/testAppsManager.js';

// Get parameters from environment
const platform = process.env.PLATFORM || 'builder';
const moduleType = process.env.MODULE_TYPE || 'esm';
const testType = process.env.TEST_TYPE || 'standard';
const binary = process.env.BINARY !== 'false';
const isSplashEnabled = Boolean(process.env.ENABLE_SPLASH_WINDOW);
const isMultiremote = testType === 'multiremote' || process.env.WDIO_MULTIREMOTE === 'true';
const isNoBinary = platform === 'no-binary' || !binary;

// Determine the example directory
const exampleDir = process.env.EXAMPLE_DIR || (isNoBinary ? `no-binary-${moduleType}` : `${platform}-${moduleType}`);

console.log(`🔍 Debug: Starting test with configuration:
  Platform: ${platform}
  Module Type: ${moduleType}
  Test Type: ${testType}
  Binary: ${binary}
  Splash Enabled: ${isSplashEnabled}
  Example Directory: ${exampleDir}
`);

// Initialize test apps manager if env var is not set
let tmpDir: string | null = null;
if (process.env.WDIO_TEST_APPS_PREPARED !== 'true') {
  console.log('🔍 Debug: Initializing test apps manager for individual test');
  tmpDir = await testAppsManager.prepareTestApps();
  console.log('🔍 Debug: Test apps prepared for individual test');
} else {
  console.log('🔍 Debug: Skipping test apps preparation as they were already prepared');
  // Directly use the environment variable if set, or fall back to testAppsManager
  tmpDir = process.env.WDIO_TEST_APPS_DIR || testAppsManager.getTmpDir();

  if (!tmpDir) {
    console.error('🔍 Debug: No tmpDir found from environment variable or testAppsManager');
    // Fallback - use a reasonable default based on the existing environment variable pattern
    if (process.env.WDIO_TEST_APPS_DIR) {
      tmpDir = process.env.WDIO_TEST_APPS_DIR;
      console.log(`🔍 Debug: Using tmpDir from environment variable: ${tmpDir}`);
    } else {
      throw new Error('tmpDir not set and cannot be determined from environment or testAppsManager');
    }
  } else {
    console.log(`🔍 Debug: Using tmpDir: ${tmpDir}`);
  }
}

// Load package.json from the appropriate app directory and set it on globalThis
if (tmpDir) {
  try {
    const packageJsonPath = path.join(tmpDir, 'apps', exampleDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;
      globalThis.packageJson = packageJson;
      console.log(`🔍 Debug: Loaded packageJson from ${packageJsonPath} and set on globalThis`);
      console.log(`🔍 Debug: Package name: ${packageJson.name}, version: ${packageJson.version}`);
    } else {
      console.log(`🔍 Debug: Could not find package.json at ${packageJsonPath}, using default values`);
      globalThis.packageJson = { name: 'Electron', version: '35.0.2' };
    }
  } catch (error) {
    console.error('❌ Error loading packageJson:', error);
    globalThis.packageJson = { name: 'Electron', version: '35.0.2' };
  }
}

// Always set TEST environment variable for tests
process.env.TEST = 'true';

// Configure test type specific variables
let appBinaryPath = '';
let appEntryPoint = '';

// Setup for app binary path or entry point
if (tmpDir) {
  if (isNoBinary) {
    console.log('🔍 Debug: Setting up no-binary test with entry point');
    // Try multiple possible entry points
    const possibleEntryPoints = [
      path.join(tmpDir, 'apps', exampleDir, 'main.js'),
      path.join(tmpDir, 'apps', exampleDir, 'dist', 'main.js'),
      path.join(tmpDir, 'apps', exampleDir, 'dist', 'main.bundle.js'),
    ];

    for (const entryPoint of possibleEntryPoints) {
      if (fs.existsSync(entryPoint)) {
        appEntryPoint = entryPoint;
        console.log('🔍 Debug: Found app entry point at:', appEntryPoint);
        break;
      }
    }

    if (!appEntryPoint) {
      console.error('❌ Error: Could not find a valid entry point. Checked:', possibleEntryPoints);
    }
  } else {
    console.log('🔍 Debug: Setting up binary test with app binary path');
    try {
      const packageJsonPath = path.join(tmpDir, 'apps', exampleDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;
      const pkg = { packageJson, path: packageJsonPath };
      const electronVersion = await getElectronVersion(pkg);
      const appBuildInfo = await getAppBuildInfo(pkg);
      appBinaryPath = await getBinaryPath(packageJsonPath, appBuildInfo, electronVersion);
      console.log('🔍 Debug: Found app binary at:', appBinaryPath);
    } catch (error) {
      console.error('❌ Error getting app binary path:', error);
    }
  }
} else {
  console.error('❌ Error: tmpDir is not set. Test apps preparation may have failed.');
}

// Configure specs based on test type
let specs: string[] = [];
if (testType === 'window') {
  // Use the consolidated window test file for both multiremote and non-multiremote mode
  specs = ['./test/window.spec.ts'];
} else if (testType === 'multiremote') {
  specs = ['./test/multiremote/*.spec.ts'];
} else if (testType === 'standard') {
  specs = ['./test/api.spec.ts', './test/application.spec.ts', './test/dom.spec.ts', './test/interaction.spec.ts'];
}

// Configure capabilities based on test type and binary/no-binary mode
let capabilities: any;
if (isMultiremote) {
  // Multiremote configuration
  capabilities = {
    browserA: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          ...(isNoBinary ? { appEntryPoint } : { appBinaryPath }),
          appArgs: ['--foo', '--bar=baz', '--browser=A'],
        },
      },
    },
    browserB: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          ...(isNoBinary ? { appEntryPoint } : { appBinaryPath }),
          appArgs: ['--foo', '--bar=baz', '--browser=B'],
        },
      },
    },
  };
} else {
  // Standard configuration
  capabilities = [
    {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        ...(isNoBinary ? { appEntryPoint } : { appBinaryPath }),
        appArgs: ['foo', 'bar=baz'],
      },
    },
  ];
}

// Set up the WebdriverIO configuration
export const config: WdioElectronConfig = {
  runner: 'local',
  specs,
  exclude: [],
  maxInstances: 1,
  capabilities,
  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Set up the electron service
  services: ['electron'],

  beforeSession: async function () {
    console.log('🔍 DEBUG: Module type:', moduleType);
    console.log('🔍 DEBUG: Current directory:', process.cwd());
  },

  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  outputDir: `logs/${testType}-${exampleDir}`,
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
    console.log(`🔍 Debug: Starting ${isNoBinary ? 'no-binary' : 'binary'} ${testType} test`);
  },
  // Add after hook to log debug information
  after: async () => {
    console.log(`🔍 Debug: Completing ${isNoBinary ? 'no-binary' : 'binary'} ${testType} test, cleaning up`);
  },
};
