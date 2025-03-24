import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import process from 'node:process';

// Get the directory name once at the top
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Debug module resolution paths
console.log('🔍 DEBUG: Module resolution paths:');
console.log(`  - NODE_PATH: ${process.env.NODE_PATH || 'not set'}`);
console.log(`  - Working directory: ${process.cwd()}`);
console.log(`  - __dirname: ${__dirname}`);
console.log(
  `  - Service package path: ${process.env.WDIO_TEST_APPS_DIR ? path.join(process.env.WDIO_TEST_APPS_DIR, 'apps', 'node_modules', 'wdio-electron-service') : 'not set'}`,
);
console.log(
  `  - Service node_modules: ${process.env.WDIO_TEST_APPS_DIR ? path.join(process.env.WDIO_TEST_APPS_DIR, 'apps', 'node_modules') : 'not set'}`,
);

// Check if read-package-up exists in various locations
const possiblePaths = [
  process.env.WDIO_TEST_APPS_DIR
    ? path.join(process.env.WDIO_TEST_APPS_DIR, 'apps', 'node_modules', 'read-package-up')
    : null,
  path.join(process.cwd(), 'node_modules', 'read-package-up'),
  process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'read-package-up') : null,
].filter((p): p is string => p !== null);

console.log('🔍 DEBUG: Checking read-package-up in locations:');
for (const p of possiblePaths) {
  console.log(`  - ${p}: ${fs.existsSync(p) ? 'exists' : 'not found'}`);
}

// Try to import read-package-up to see if it can be loaded
try {
  await import('read-package-up');
  console.log('✅ Successfully imported read-package-up');
} catch (error) {
  console.error('❌ Error importing read-package-up:', error instanceof Error ? error.message : String(error));
}

import type { NormalizedPackageJson } from 'read-package-up';

// Debug module resolution
console.log('🔍 DEBUG: Standalone test module resolution:');
console.log(`  - Module Type: ${process.env.MODULE_TYPE || 'not set'}`);
console.log(`  - NODE_OPTIONS: ${process.env.NODE_OPTIONS || 'not set'}`);
console.log(`  - MODULE_FORCE_CJS: ${process.env.MODULE_FORCE_CJS || 'not set'}`);
console.log(`  - import.meta.url: ${import.meta.url}`);
console.log(`  - __dirname: ${__dirname}`);

// Determine if we should force CJS imports
const shouldForceCjs = process.env.MODULE_TYPE === 'cjs' || process.env.MODULE_FORCE_CJS === 'true';
console.log(`  - shouldForceCjs: ${shouldForceCjs}`);

let electronUtils;

// Get the temp directory from environment variables
const tempDir = process.env.WDIO_TEST_APPS_DIR;
console.log(`🔍 DEBUG: Using temp directory: ${tempDir || 'not set'}`);

// Debug what we know about the environment
console.log('🔍 DEBUG: Environment information:');
console.log(`  - MODULE_TYPE: ${process.env.MODULE_TYPE || 'not set'}`);
console.log(`  - Working directory: ${process.cwd()}`);
console.log(`  - NODE_OPTIONS: ${process.env.NODE_OPTIONS || 'not set'}`);

// Helper function to safely import modules with error handling
async function safeImport(importPath: string) {
  try {
    return await import(importPath);
  } catch (error) {
    console.error(`❌ Error importing ${importPath}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Import the service module
console.log('Importing service module...');
let serviceModule: any;
try {
  // Always use package name import to ensure proper module resolution
  serviceModule = await import('wdio-electron-service');
  console.log('Successfully imported service module via package name');
} catch (importError) {
  console.error('Error importing service module:', importError);
  throw importError;
}

try {
  console.log('🔍 DEBUG: Attempting to import @wdio/electron-utils...');

  // Use direct path to the prepared utils package if available
  if (tempDir) {
    // First check in the service's node_modules
    const utilsInServicePath = path.join(
      tempDir,
      'apps',
      'node_modules',
      'wdio-electron-service',
      'node_modules',
      '@wdio',
      'electron-utils',
    );
    // Then check in the apps node_modules
    const utilsInAppsPath = path.join(tempDir, 'apps', 'node_modules', '@wdio', 'electron-utils');

    console.log(`🔍 DEBUG: Checking utils in service: ${utilsInServicePath}`);
    console.log(`🔍 DEBUG: Checking utils in apps: ${utilsInAppsPath}`);

    // Check if either path exists
    const utilsPath = fs.existsSync(utilsInServicePath)
      ? utilsInServicePath
      : fs.existsSync(utilsInAppsPath)
        ? utilsInAppsPath
        : null;

    if (utilsPath) {
      console.log(`🔍 DEBUG: Utils package exists at: ${utilsPath}`);

      // Choose the appropriate module type
      const moduleType = process.env.MODULE_TYPE === 'cjs' ? 'cjs' : 'esm';
      const indexPath = path.join(utilsPath, 'dist', moduleType, 'index.js');

      if (fs.existsSync(indexPath)) {
        console.log(`🔍 DEBUG: Importing utils from ${moduleType.toUpperCase()} index: ${indexPath}`);

        // Convert the path to a file:// URL for ESM compatibility
        const fileUrl = url.pathToFileURL(indexPath).href;
        console.log(`🔍 DEBUG: Using file URL for import: ${fileUrl}`);

        electronUtils = await safeImport(fileUrl);
        console.log(`✅ Successfully imported utils from ${moduleType.toUpperCase()} path`);
      } else {
        // Fall back to package name
        console.log(`🔍 DEBUG: Utils ${moduleType} index not found, falling back to package name`);
        electronUtils = await safeImport('@wdio/electron-utils');
        console.log('✅ Successfully imported utils via package name');
      }
    } else {
      // Fall back to package name
      console.log('🔍 DEBUG: Utils package not found in temp location, falling back to package name');
      electronUtils = await safeImport('@wdio/electron-utils');
      console.log('✅ Successfully imported utils via package name');
    }
  } else {
    // No temp directory, use package name
    console.log('🔍 DEBUG: No temp directory provided, importing utils via package name');
    electronUtils = await safeImport('@wdio/electron-utils');
    console.log('✅ Successfully imported utils via package name');
  }
} catch (error) {
  console.error('❌ Error importing @wdio/electron-utils:', error instanceof Error ? error.message : String(error));
  throw error;
}

const { getBinaryPath, getAppBuildInfo, getElectronVersion } = electronUtils;

process.env.TEST = 'true';

// Check if we're running in binary or no-binary mode
const isBinary = process.env.BINARY !== 'false';
console.log('🔍 Debug: Starting standalone test with binary mode:', isBinary);

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
const packageJsonPath = path.join(__dirname, '..', '..', '..', 'apps', exampleDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })) as NormalizedPackageJson;
const pkg = { packageJson, path: packageJsonPath };
const electronVersion = await getElectronVersion(pkg);

// Set up the session options based on binary/no-binary mode
let sessionOptions;
if (isBinary) {
  // Binary mode - use appBinaryPath
  const appBuildInfo = await getAppBuildInfo(pkg);
  const appBinaryPath = await getBinaryPath(packageJsonPath, appBuildInfo, electronVersion);

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
  const bundlePath = path.join(__dirname, '..', '..', '..', 'apps', exampleDir, 'dist', 'main.bundle.js');
  // Fallback to main.js (used by builder apps)
  const mainJsPath = path.join(__dirname, '..', '..', '..', 'apps', exampleDir, 'dist', 'main.js');

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
const browser = await serviceModule.startWdioSession([sessionOptions]);

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
const appName = await browser.electron.execute((electron: any) => electron.app.getName());
const expectedAppName = getExpectedAppName();

if (appName !== expectedAppName) {
  throw new Error(`appName test failed: ${appName} !== ${expectedAppName}`);
}

// Get app version and check against expected value
const appVersion = await browser.electron.execute((electron: any) => electron.app.getVersion());
// In binary mode, expect the package.json version; in no-binary mode, expect the Electron version
const expectedAppVersion = isBinary ? packageJson.version : electronVersion;
if (appVersion !== expectedAppVersion) {
  throw new Error(`appVersion test failed: ${appVersion} !== ${expectedAppVersion}`);
}

// Clean up - quit the app
await browser.deleteSession();

process.exit();
