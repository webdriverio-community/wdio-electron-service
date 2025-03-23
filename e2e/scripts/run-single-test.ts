import { execSync } from 'node:child_process';
import { setupTestSuite, cleanupTestSuite } from './suite-setup.js';
import path from 'node:path';
import fs from 'node:fs';

// Get parameters from environment
const platform = process.env.PLATFORM || 'builder';
const moduleType = process.env.MODULE_TYPE || 'esm';
const testType = process.env.TEST_TYPE || 'standard';
const binary = process.env.BINARY !== 'false';
const exampleDir = binary ? `${platform}-${moduleType}` : `no-binary-${moduleType}`;

// Check if this is a Mac Universal build
const isMacUniversal = process.env.MAC_UNIVERSAL === 'true';

console.log(
  `Running test: ${platform}-${moduleType}-${testType}-${binary ? 'binary' : 'no-binary'}${isMacUniversal ? ' (Mac Universal build)' : ''}`,
);

// Set up environment variables
const env: Record<string, string> = {
  PLATFORM: platform,
  MODULE_TYPE: moduleType,
  TEST_TYPE: testType,
  BINARY: binary ? 'true' : 'false',
  EXAMPLE_DIR: exampleDir,
};

// Enable splash screen for window tests
if (testType === 'window') {
  env.ENABLE_SPLASH_WINDOW = 'true';
}

// Pass through the MAC_UNIVERSAL env var if set
if (isMacUniversal) {
  env.MAC_UNIVERSAL = 'true';
}

// Helper to convert env object to string
function envString(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => {
      // Special handling for NODE_OPTIONS to remove debug port
      if (key === 'NODE_OPTIONS' && value.includes('--inspect')) {
        // Strip out any inspect flags
        const cleanValue = value.replace(/--inspect(=[0-9]+)?/, '--no-warnings');
        return `${key}=${cleanValue}`;
      }
      return `${key}=${value}`;
    })
    .join(' ');
}

// Helper to determine the correct standalone test command
function getStandaloneCommand(env: Record<string, string>): string {
  const isCjs = env.MODULE_TYPE === 'cjs';
  // Add MODULE_FORCE_CJS=true for CJS tests to ensure correct module resolution
  const forceCjs = isCjs ? 'MODULE_FORCE_CJS=true ' : '';

  // Add NODE_PATH to the command if WDIO_TEST_APPS_DIR is set
  let nodePath = '';
  const testAppsDir = process.env.WDIO_TEST_APPS_DIR;
  if (testAppsDir) {
    const nodeModulesPath = path.join(testAppsDir, 'apps', 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      // We need to escape paths for the command line
      const escapedPath = nodeModulesPath.replace(/(\s+)/g, '\\$1');
      nodePath = `NODE_PATH="${escapedPath}" `;
      console.log(`🔍 DEBUG: Added NODE_PATH="${nodeModulesPath}" to standalone command`);
    }
  }

  // Use tsx for all cases - it works for both CJS and ESM
  return `cross-env ${forceCjs}${nodePath}${envString(env)} NODE_OPTIONS="--no-warnings" tsx ./test/standalone/api.spec.ts`;
}

// Ensure cleanup happens even if tests fail
async function runWithCleanup() {
  try {
    // Check if test apps are already prepared
    const testAppsPrepared = process.env.WDIO_TEST_APPS_PREPARED === 'true';

    if (testAppsPrepared) {
      console.log('ℹ️ Test apps already prepared, skipping setup...');
    } else {
      // Perform suite-level setup
      await setupTestSuite();
      console.log('Suite setup completed');
    }

    // Special handling for Mac Universal forge CJS tests due to ESM loader issues
    // Standalone test works differently and doesn't have these issues
    const isForgeCase = platform === 'forge' && moduleType === 'cjs' && isMacUniversal && testType !== 'standalone';

    if (isForgeCase) {
      console.log('🔍 Detected Mac Universal forge CJS test - using special command to prevent ESM loader issues');
      // Use pnpm exec to run wdio to avoid shell script interpretation issues
      // Force CJS module resolution for CJS tests
      const cmd = `cross-env MODULE_FORCE_CJS=true ${envString(env)} pnpm exec wdio run ./wdio.conf.ts`;
      console.log(`Executing special cmd: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    } else if (testType === 'multiremote') {
      // For multiremote tests, use pnpm exec for all module types
      // Force CJS module resolution for CJS tests
      const additionalEnv = moduleType === 'cjs' ? 'MODULE_FORCE_CJS=true ' : '';
      const cmd = `cross-env ${additionalEnv}${envString(env)} pnpm exec wdio run ./wdio.conf.ts`;
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    } else if (testType === 'standalone') {
      // Use the same tsx approach as the main test matrix for standalone tests
      const cmd = getStandaloneCommand(env);
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    } else if (testType === 'window') {
      // For window tests, use pnpm exec for all module types
      // For CJS tests, force the use of the CJS version by setting MODULE_FORCE_CJS
      const additionalEnv = moduleType === 'cjs' ? 'MODULE_FORCE_CJS=true ' : '';
      const cmd = `cross-env ${additionalEnv}${envString(env)} pnpm exec wdio run ./wdio.conf.ts`;
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    } else {
      // For standard tests, use pnpm exec for all module types
      // For CJS tests, force the use of the CJS version by setting MODULE_FORCE_CJS
      const additionalEnv = moduleType === 'cjs' ? 'MODULE_FORCE_CJS=true ' : '';
      const cmd = `cross-env ${additionalEnv}${envString(env)} pnpm exec wdio run ./wdio.conf.ts`;
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    }

    console.log(`✅ Test passed: ${platform}-${moduleType}-${testType}-${binary ? 'binary' : 'no-binary'}`);
    return true;
  } catch (error) {
    console.error(`❌ Test failed: ${platform}-${moduleType}-${testType}-${binary ? 'binary' : 'no-binary'}`);
    console.error(error);
    return false;
  } finally {
    // Perform suite-level cleanup
    await cleanupTestSuite();
    console.log('Suite cleanup completed');
  }
}

// Run the test with cleanup
runWithCleanup()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
