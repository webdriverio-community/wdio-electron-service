/// <reference types="mocha" />
import path from 'node:path';
import fs from 'node:fs';

import type { NormalizedPackageJson } from 'read-package-up';
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

// Check if test apps have already been prepared by the suite-level setup
let tmpDir: string;
if (process.env.WDIO_TEST_APPS_PREPARED === 'true' && process.env.WDIO_TEST_APPS_DIR) {
  tmpDir = process.env.WDIO_TEST_APPS_DIR;
  console.log('🔍 Debug: Using pre-prepared test apps from:', tmpDir);
} else {
  // This should not happen if using the suite-level setup
  console.warn('Warning: Test apps not prepared by suite-level setup. This may cause duplicate setup.');
  tmpDir = await testAppsManager.prepareTestApps();
}

// Set up packageJson for tests
const packageJsonPath = path.join(tmpDir, 'apps', exampleDir, 'package.json');

// Add error handling for missing package.json
try {
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`Error: Package.json not found at ${packageJsonPath}`);
    console.error('Directory structure:');

    // List the apps directory to help debug
    try {
      const appsDir = path.join(tmpDir, 'apps');
      if (fs.existsSync(appsDir)) {
        const appDirs = fs.readdirSync(appsDir);
        console.error(`Apps directory contents: ${appDirs.join(', ')}`);
      } else {
        console.error(`Apps directory not found at ${appsDir}`);
      }
    } catch (listError) {
      console.error('Error listing apps directory:', listError);
    }

    throw new Error(`Package.json not found at ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;

  // Set globalThis.packageJson for tests
  globalThis.packageJson = packageJson;
  console.log('🔍 Debug: globalThis.packageJson set:', globalThis.packageJson);
} catch (error) {
  console.error('Error reading package.json:', error);
  // Provide a fallback packageJson to allow tests to continue
  globalThis.packageJson = {
    name: exampleDir,
    version: '0.0.1',
    dependencies: {},
    devDependencies: {},
  } as NormalizedPackageJson;
  console.log('🔍 Debug: Using fallback packageJson');
}

process.env.TEST = 'true';

// Determine the app path based on binary/no-binary mode
let appBinaryPath: string | undefined;
let appEntryPoint: string | undefined;
const appName = `example-${exampleDir}`;

if (isNoBinary) {
  // No-binary mode - use appEntryPoint
  // First try main.bundle.js (used by forge and no-binary apps)
  const bundlePath = path.join(tmpDir, 'apps', exampleDir, 'dist', 'main.bundle.js');
  // Fallback to main.js (used by builder apps)
  const mainJsPath = path.join(tmpDir, 'apps', exampleDir, 'dist', 'main.js');

  if (fs.existsSync(bundlePath)) {
    appEntryPoint = bundlePath;
    console.log('🔍 Debug: Using appEntryPoint (bundle):', appEntryPoint);
  } else if (fs.existsSync(mainJsPath)) {
    appEntryPoint = mainJsPath;
    console.log('🔍 Debug: Using appEntryPoint (main.js):', appEntryPoint);
  } else {
    console.error('❌ Error: Could not find a valid entry point. Checked:');
    console.error(`  - ${bundlePath}`);
    console.error(`  - ${mainJsPath}`);
  }
} else {
  // Binary mode - determine the correct binary path
  if (process.platform === 'darwin') {
    if (platform === 'builder') {
      // For builder apps on macOS with binary builds
      const macAppPath = path.join(
        tmpDir,
        'apps',
        exampleDir,
        'dist',
        'mac-arm64',
        `${appName}.app`,
        'Contents',
        'MacOS',
        appName,
      );

      // Check if the path exists, otherwise fall back to the app directory
      if (fs.existsSync(macAppPath)) {
        console.log('🔍 Debug: Using macOS app executable path:', macAppPath);
        appBinaryPath = macAppPath;
      } else {
        console.log('🔍 Debug: macOS app executable not found for builder, falling back to app directory');
        appBinaryPath = path.join(tmpDir, 'apps', exampleDir);
        console.log('🔍 Debug: Using appBinaryPath:', appBinaryPath);
      }
    } else if (platform === 'forge') {
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

      // Check if the path exists, otherwise fall back to the app directory
      if (fs.existsSync(forgeMacAppPath)) {
        console.log('🔍 Debug: Using macOS app executable path for forge:', forgeMacAppPath);
        appBinaryPath = forgeMacAppPath;
      } else {
        console.log('🔍 Debug: macOS app executable not found for forge, falling back to app directory');
        appBinaryPath = path.join(tmpDir, 'apps', exampleDir);
        console.log('🔍 Debug: Using appBinaryPath:', appBinaryPath);
      }
    } else {
      // For other platforms, use the app directory
      appBinaryPath = path.join(tmpDir, 'apps', exampleDir);
      console.log('🔍 Debug: Using appBinaryPath:', appBinaryPath);
    }
  } else {
    // For other platforms, use the app directory
    appBinaryPath = path.join(tmpDir, 'apps', exampleDir);
    console.log('🔍 Debug: Using appBinaryPath:', appBinaryPath);
  }
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
  services: ['electron'],
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
