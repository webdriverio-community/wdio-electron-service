import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { WdioElectronConfig } from '@wdio/electron-types';
import type { NormalizedPackageJson } from 'read-package-up';

import { createEnvironmentContext } from './config/envSchema.js';
import { fileExists, safeJsonParse } from './lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration context for WDIO
 */
interface ConfigContext {
  envContext: ReturnType<typeof createEnvironmentContext>;
  appPath: string;
  appEntryPoint?: string;
  appBinaryPath?: string;
  packageJson: NormalizedPackageJson;
}

/**
 * Get configuration context
 */
async function getConfigContext(): Promise<ConfigContext> {
  console.log('🔍 Creating WDIO configuration context...');

  // Parse and validate environment
  const envContext = createEnvironmentContext();
  console.log(`Environment: ${envContext.toString()}`);

  // Determine app directory
  const projectRoot = join(process.cwd(), '..');
  const appPath = envContext.env.APP_DIR || join(projectRoot, 'fixtures', 'e2e-apps', envContext.appDirName);
  console.log(`App path: ${appPath}`);

  if (!existsSync(appPath)) {
    throw new Error(`App directory does not exist: ${appPath}`);
  }

  // Load package.json from app
  const packageJsonPath = join(appPath, 'package.json');
  if (!fileExists(packageJsonPath)) {
    throw new Error(`package.json not found: ${packageJsonPath}`);
  }

  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
  const packageJson = safeJsonParse<NormalizedPackageJson>(packageJsonContent, {
    name: 'electron-app',
    version: '1.0.0',
    readme: '',
    _id: 'electron-app@1.0.0',
  } as NormalizedPackageJson);

  // Set package.json on globalThis for tests
  globalThis.packageJson = packageJson;

  let appEntryPoint: string | undefined;
  let appBinaryPath: string | undefined;

  if (envContext.isNoBinary) {
    console.log('🔍 Setting up no-binary test with entry point');

    appEntryPoint = join(appPath, 'dist', 'main.js');
    console.log(`Using app entry point: ${appEntryPoint}`);

    if (!fileExists(appEntryPoint)) {
      throw new Error(`App entry point not found: ${appEntryPoint}. Make sure the app is built.`);
    }
  } else {
    console.log('🔍 Setting up binary test with app binary path');

    try {
      // Import async utilities and resolve binary path directly
      const { getBinaryPath, getAppBuildInfo, getElectronVersion } = await import('@wdio/electron-utils');

      const pkg = { packageJson, path: packageJsonPath };
      const electronVersion = await getElectronVersion(pkg);
      const appBuildInfo = await getAppBuildInfo(pkg);
      const binaryResult = await getBinaryPath(packageJsonPath, appBuildInfo, electronVersion);

      // Extract the actual path string from the result object
      appBinaryPath = typeof binaryResult === 'string' ? binaryResult : binaryResult.binaryPath;

      console.log('🔍 Found app binary at:', appBinaryPath);
    } catch (error) {
      throw new Error(`Failed to resolve binary path: ${error instanceof Error ? error.message : error}`);
    }
  }

  return {
    envContext,
    appPath,
    appEntryPoint,
    appBinaryPath,
    packageJson,
  };
}

const context = await getConfigContext();
const { envContext, appEntryPoint, appBinaryPath } = context;

// Configure specs based on test type
let specs: string[] = [];
switch (envContext.testType) {
  case 'window':
    specs = ['./test/window.spec.ts'];
    break;
  case 'multiremote':
    specs = ['./test/multiremote/*.spec.ts'];
    break;
  case 'standalone':
    specs = ['./test/standalone/api.spec.ts'];
    break;
  default:
    specs = ['./test/api.spec.ts', './test/application.spec.ts', './test/dom.spec.ts', './test/interaction.spec.ts'];
    break;
}

// Configure capabilities
type ElectronCapability = {
  browserName: 'electron';
  'wdio:electronServiceOptions': {
    appEntryPoint?: string;
    appBinaryPath?: string;
    appArgs: string[];
  };
};

type MultiremoteCapabilities = {
  browserA: {
    capabilities: ElectronCapability;
  };
  browserB: {
    capabilities: ElectronCapability;
  };
};

type StandardCapabilities = ElectronCapability[];

let capabilities: MultiremoteCapabilities | StandardCapabilities;
if (envContext.isMultiremote) {
  // Multiremote configuration
  capabilities = {
    browserA: {
      capabilities: {
        browserName: 'electron',
        'wdio:electronServiceOptions': {
          ...(envContext.isNoBinary ? { appEntryPoint } : { appBinaryPath }),
          appArgs: ['--foo', '--bar=baz', '--browser=A'],
          apparmorAutoInstall: 'sudo',
        },
      },
    },
    browserB: {
      capabilities: {
        browserName: 'electron',
        'wdio:electronServiceOptions': {
          ...(envContext.isNoBinary ? { appEntryPoint } : { appBinaryPath }),
          appArgs: ['--foo', '--bar=baz', '--browser=B'],
          apparmorAutoInstall: 'sudo',
        },
      },
    },
  };
} else {
  // Standard configuration
  capabilities = [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        ...(envContext.isNoBinary ? { appEntryPoint } : { appBinaryPath }),
        appArgs: ['foo', 'bar=baz'],
        apparmorAutoInstall: 'sudo',
      },
    },
  ];
}

// Create log directory
const logDir = join(__dirname, 'logs', `${envContext.testType}-${envContext.appDirName}`);

// Using pnpm override to ensure the runner resolves the workspace service by name

// Export the configuration object directly
export const config: WdioElectronConfig = {
  runner: 'local',
  specs,
  exclude: [],
  maxInstances: 1,
  capabilities,
  logLevel: envContext.env.WDIO_VERBOSE === 'true' ? 'debug' : 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  autoXvfb: true,
  services: ['electron'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  outputDir: logDir,
};
