/// <reference types="mocha" />
import path from 'node:path';
import fs from 'node:fs';

import type { NormalizedPackageJson } from 'read-package-up';

import type { WdioElectronConfig } from '@wdio/electron-types';
import { createConfig } from './config/createConfig.js';
import { testAppsManager } from './setup/testAppsManager.js';

const exampleDir = process.env.EXAMPLE_DIR;
if (!exampleDir) {
  throw new Error('EXAMPLE_DIR environment variable must be set');
}

// Check if test apps have already been prepared by the runner script
let tmpDir: string;
if (process.env.WDIO_TEST_APPS_PREPARED === 'true' && process.env.WDIO_TEST_APPS_DIR) {
  tmpDir = process.env.WDIO_TEST_APPS_DIR;
  console.log('Using pre-prepared test apps from:', tmpDir);
} else {
  // This should not happen if using the suite-level setup
  console.warn('Warning: Test apps not prepared by suite-level setup. This may cause duplicate setup.');
  tmpDir = await testAppsManager.prepareTestApps();
}

const packageJsonPath = path.join(tmpDir, 'apps', exampleDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;

globalThis.packageJson = packageJson;
process.env.TEST = 'true';

// Get parameters from environment
const platform = process.env.PLATFORM || 'builder';
const moduleType = process.env.MODULE_TYPE || 'esm';
const testType = process.env.TEST_TYPE || 'standard';
const binary = process.env.BINARY !== 'false';
const isSplashEnabled = Boolean(process.env.ENABLE_SPLASH_WINDOW);

// Create the configuration
export const config: WdioElectronConfig = createConfig({
  platform: platform as 'builder' | 'forge' | 'no-binary',
  moduleType: moduleType as 'cjs' | 'esm',
  testType: isSplashEnabled ? 'window' : (testType as 'standard' | 'window' | 'multiremote' | 'standalone'),
  binary,
});

// Set the output directory to the logs subdirectory
config.outputDir = `logs/${testType}-${exampleDir}`;

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

// For standard tests, make sure we're using the correct spec files
if (testType === 'standard') {
  // Override the specs to use specific test files
  config.specs = [
    './test/api.spec.ts',
    './test/application.spec.ts',
    './test/dom.spec.ts',
    './test/interaction.spec.ts',
  ];
}
