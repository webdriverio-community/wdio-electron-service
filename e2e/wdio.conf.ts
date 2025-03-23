/// <reference types="mocha" />
import path from 'node:path';
import fs from 'node:fs';

import type { WdioElectronConfig } from '@wdio/electron-types';

import { testAppsManager } from './setup/testAppsManager.js';

// Get parameters from environment
const platform = process.env.PLATFORM || 'builder';
const moduleType = process.env.MODULE_TYPE || 'esm';
const testType = process.env.TEST_TYPE || 'standard';
const binary = process.env.BINARY !== 'false';
const isSplashEnabled = Boolean(process.env.ENABLE_SPLASH_WINDOW);
const isMultiremote = testType === 'multiremote';
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
let tmpDir: string | null;
if (process.env.WDIO_TEST_APPS_PREPARED !== 'true') {
  console.log('🔍 Debug: Initializing test apps manager for individual test');
  tmpDir = await testAppsManager.prepareTestApps();
  console.log('🔍 Debug: Test apps prepared for individual test');
} else {
  console.log('🔍 Debug: Skipping test apps preparation as they were already prepared');
  tmpDir = testAppsManager.getTmpDir();
}

// Configure test type specific variables
let appBinaryPath = '';
let appEntryPoint = '';

// Setup for app binary path or entry point
if (tmpDir) {
  const appName = `electron-example-${platform}`;

  if (isNoBinary) {
    console.log('🔍 Debug: Setting up no-binary test with entry point');
    // Try multiple possible entry point locations
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
    console.log('🔍 Debug: Setting up binary test with app path');
    // For all platforms, use the app directory as a fallback
    appBinaryPath = path.join(tmpDir, 'apps', exampleDir);
    console.log('🔍 Debug: Using appBinaryPath:', appBinaryPath);

    if (process.platform === 'darwin' && platform === 'builder') {
      // For electron-builder apps on macOS with binary builds
      const macAppPath = path.join(
        tmpDir,
        'apps',
        exampleDir,
        'dist',
        'mac',
        `${appName}.app`,
        'Contents',
        'MacOS',
        appName,
      );

      // Check if the path exists, use it if available
      if (fs.existsSync(macAppPath)) {
        console.log('🔍 Debug: Using macOS app executable path:', macAppPath);
        appBinaryPath = macAppPath;
      }
    } else if (process.platform === 'darwin' && platform === 'forge') {
      // For forge apps on macOS with binary builds
      const forgeMacAppPath = path.join(
        tmpDir,
        'apps',
        exampleDir,
        'out',
        `${appName}-darwin-arm64`,
        `${appName}.app`,
        'Contents',
        'MacOS',
        appName,
      );

      // Check if the path exists, use it if available
      if (fs.existsSync(forgeMacAppPath)) {
        console.log('🔍 Debug: Using macOS app executable path for forge:', forgeMacAppPath);
        appBinaryPath = forgeMacAppPath;
      }
    }
  }
} else {
  console.error('❌ Error: tmpDir is not set. Test apps preparation may have failed.');
}

// Configure specs based on test type
let specs: string[] = [];
if (testType === 'window') {
  // Exclude multiremote spec files when running in non-multiremote mode
  specs = isMultiremote
    ? ['./test/window/*.spec.ts']
    : ['./test/window/*.spec.ts', '!./test/window/*.multiremote.spec.ts'];
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
