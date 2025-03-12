import { execSync } from 'node:child_process';
import { setupTestSuite, cleanupTestSuite } from './suite-setup.js';

// Get parameters from environment
const platform = process.env.PLATFORM || 'builder';
const moduleType = process.env.MODULE_TYPE || 'esm';
const testType = process.env.TEST_TYPE || 'standard';
const binary = process.env.BINARY !== 'false';
const exampleDir = binary ? `${platform}-${moduleType}` : `no-binary-${moduleType}`;

console.log(`Running test: ${platform}-${moduleType}-${testType}-${binary ? 'binary' : 'no-binary'}`);

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

// Helper to convert env object to string
function envString(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
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

    // Run the appropriate test command based on test type
    if (testType === 'multiremote') {
      const cmd = `cross-env ${envString(env)} wdio run ./wdio.conf.ts`;
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    } else if (testType === 'standalone') {
      // Use the same tsx approach as the main test matrix for standalone tests
      const cmd = `cross-env ${envString(env)} tsx ./test/standalone/api.spec.ts`;
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    } else if (testType === 'window') {
      const cmd = `cross-env ${envString(env)} wdio run ./wdio.conf.ts`;
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    } else {
      const cmd = `cross-env ${envString(env)} wdio run ./wdio.conf.ts`;
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
