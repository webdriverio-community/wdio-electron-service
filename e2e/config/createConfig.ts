import type { WdioElectronConfig, ElectronServiceOptions } from '@wdio/electron-types';
import path from 'node:path';
import fs from 'node:fs';

export interface TestConfigOptions {
  platform?: 'builder' | 'forge' | 'no-binary';
  moduleType?: 'cjs' | 'esm';
  testType?: 'standard' | 'standalone' | 'window' | 'multiremote';
  binary?: boolean;
}

export function createConfig({
  platform = 'builder',
  moduleType = 'esm',
  testType = 'standard',
  binary = true,
}: TestConfigOptions): WdioElectronConfig {
  // Get example directory from platform and module type
  const exampleDir = binary ? `${platform}-${moduleType}` : `no-binary-${moduleType}`;

  // Determine the correct binary path based on platform and OS
  let appBinaryPath: string;
  const appName = `example-${exampleDir}`;
  const tmpDir = process.env.WDIO_TEST_APPS_DIR || path.join(process.cwd(), '..');

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

  // Base configuration
  const baseConfig = {
    runner: 'local',
    autoCompileOpts: {
      autoCompile: true,
      tsNodeOpts: {
        project: './tsconfig.json',
        transpileOnly: true,
      },
    },
    specs: [],
    exclude: [],
    maxInstances: 1,
    capabilities: [
      {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          appBinaryPath,
          appArgs: ['--foo', '--bar=baz'],
          enableSplashScreen: testType === 'window',
        } as ElectronServiceOptions,
      },
    ],
    logLevel: 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    services: [['electron', {}]],
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
      ui: 'bdd',
      timeout: 60000,
    },
    outputDir: `logs/${testType}-${exampleDir}`,
  } as WdioElectronConfig;

  // Apply test type settings
  if (testType === 'window') {
    baseConfig.specs = ['./test/window/*.spec.js', './test/window/*.spec.ts'];
  } else if (testType === 'multiremote') {
    // For multiremote, we need a different capabilities structure
    baseConfig.specs = ['./test/multiremote/*.spec.js', './test/multiremote/*.spec.ts'];

    // Create multiremote capabilities with direct options
    baseConfig.capabilities = {
      browserA: {
        capabilities: {
          'browserName': 'electron',
          'wdio:electronServiceOptions': {
            appBinaryPath,
            appArgs: ['browser=A'],
            enableSplashScreen: false,
          } as ElectronServiceOptions,
        },
      },
      browserB: {
        capabilities: {
          'browserName': 'electron',
          'wdio:electronServiceOptions': {
            appBinaryPath,
            appArgs: ['browser=B'],
            enableSplashScreen: false,
          } as ElectronServiceOptions,
        },
      },
    } as Record<string, { capabilities: Record<string, unknown> }>; // Type assertion for multiremote
  } else {
    // Standard tests
    baseConfig.specs = ['./test/*.spec.js', './test/*.spec.ts'];
  }

  return baseConfig;
}
