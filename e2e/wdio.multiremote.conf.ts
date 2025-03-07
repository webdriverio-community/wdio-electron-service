/// <reference types="mocha" />
import path from 'node:path';
import fs from 'node:fs';

import type { NormalizedPackageJson } from 'read-package-up';

import type { WdioElectronConfig, ElectronServiceOptions } from '@wdio/electron-types';
import { createConfig } from './config/createConfig.js';
import { testAppsManager } from './setup/testAppsManager.js';

// Get parameters from environment
const platform = process.env.PLATFORM || 'builder';
const moduleType = process.env.MODULE_TYPE || 'esm';
const binary = process.env.BINARY !== 'false';
const isSplashEnabled = Boolean(process.env.ENABLE_SPLASH_WINDOW);
const exampleDir = process.env.EXAMPLE_DIR || (binary ? `${platform}-${moduleType}` : `no-binary-${moduleType}`);

// Check if test apps have already been prepared by the suite-level setup
let tmpDir: string;
if (process.env.WDIO_TEST_APPS_PREPARED === 'true' && process.env.WDIO_TEST_APPS_DIR) {
  tmpDir = process.env.WDIO_TEST_APPS_DIR;
  console.log('Using pre-prepared test apps from:', tmpDir);
} else {
  // This should not happen if using the suite-level setup
  console.warn('Warning: Test apps not prepared by suite-level setup. This may cause duplicate setup.');
  tmpDir = await testAppsManager.prepareTestApps();
}

// Set up packageJson for tests
const packageJsonPath = path.join(tmpDir, 'apps', exampleDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;

globalThis.packageJson = packageJson;
process.env.TEST = 'true';

// Create the configuration
export const config: WdioElectronConfig = createConfig({
  platform: platform as 'builder' | 'forge' | 'no-binary',
  moduleType: moduleType as 'cjs' | 'esm',
  testType: isSplashEnabled ? 'window' : 'multiremote',
  binary,
});

// Make sure we have the spec reporter configured
if (!config.reporters || !config.reporters.includes('spec')) {
  config.reporters = config.reporters || [];
  if (!config.reporters.includes('spec')) {
    config.reporters.push('spec');
  }
}

// Add cleanup hook
config.onComplete = async () => {
  // Skip cleanup if test apps were prepared by the suite-level setup
  if (process.env.WDIO_TEST_APPS_PREPARED === 'true') {
    console.log('Skipping cleanup as test apps were prepared by suite-level setup');
    return;
  }

  // This should not happen if using the suite-level setup
  console.warn('Warning: Performing cleanup in individual test. This may cause issues with other tests.');
  await testAppsManager.cleanup();
};

const specs = isSplashEnabled ? ['./test/window/window.multiremote.spec.ts'] : ['./test/multiremote/api.spec.ts'];

// Determine the correct binary path based on platform and OS
let appBinaryPath: string;
const appName = `example-${exampleDir}`;

if (binary && process.platform === 'darwin') {
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
      console.log('Using macOS app executable path:', macAppPath);
      appBinaryPath = macAppPath;
    } else {
      console.log('macOS app executable not found for builder, falling back to app directory');
      appBinaryPath = path.join(tmpDir, 'apps', exampleDir);
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
      console.log('Using macOS app executable path for forge:', forgeMacAppPath);
      appBinaryPath = forgeMacAppPath;
    } else {
      console.log('macOS app executable not found for forge, falling back to app directory');
      appBinaryPath = path.join(tmpDir, 'apps', exampleDir);
    }
  } else {
    // For no-binary builds, use the app directory
    appBinaryPath = path.join(tmpDir, 'apps', exampleDir);
  }
} else {
  // For other platforms or non-binary builds, use the app directory
  appBinaryPath = path.join(tmpDir, 'apps', exampleDir);
}

// Create service options directly
const electronOptions = {
  appBinaryPath,
  appArgs: ['--foo', '--bar=baz'],
  enableSplashScreen: isSplashEnabled,
} as ElectronServiceOptions;

// Set the output directory
config.outputDir = `logs/multiremote-${exampleDir}`;
config.specs = specs;
config.capabilities = {
  browserA: {
    capabilities: {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        ...electronOptions,
        appArgs: ['--foo', '--bar=baz', 'browser=A'],
      },
    },
  },
  browserB: {
    capabilities: {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        ...electronOptions,
        appArgs: ['--foo', '--bar=baz', 'browser=B'],
      },
    },
  },
};
