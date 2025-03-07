/**
 * Run all tests with suite-level setup
 * This script runs all tests with a single setup and cleanup
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { setupTestSuite, cleanupTestSuite } from './suite-setup.js';

const execAsync = promisify(exec);

/**
 * Kill all running Electron processes
 */
async function killElectronProcesses() {
  console.log('🔪 Killing any remaining Electron processes...');
  try {
    if (process.platform === 'win32') {
      // On Windows, use taskkill with /F to force kill
      await execAsync('taskkill /F /IM electron.exe /T');
    } else {
      // On Unix-like systems, try multiple approaches to ensure all processes are killed
      try {
        // First try pkill with -f to match command line
        await execAsync('pkill -f electron');
      } catch (_) {
        // Ignore errors, as they likely mean no processes were found
      }

      try {
        // Also try to kill by process name
        await execAsync('pkill -9 -f Electron');
      } catch (_) {
        // Ignore errors
      }

      try {
        // Also try to kill any node processes related to electron
        await execAsync('pkill -f "node.*electron"');
      } catch (_) {
        // Ignore errors
      }

      // On macOS, also try to kill by app bundle
      if (process.platform === 'darwin') {
        try {
          await execAsync('pkill -f "example-.*\\.app"');
        } catch (_) {
          // Ignore errors
        }
      }
    }
    console.log('✅ Electron processes killed');
  } catch (_error) {
    // Ignore errors as they likely mean no processes were found
    console.log('ℹ️ No Electron processes found to kill');
  }
}

async function runAllTests() {
  console.log('\n🧪 Running All WebdriverIO Electron Service Tests 🧪');
  console.log('═'.repeat(80));

  try {
    // Ensure logs directory exists
    try {
      await execAsync('mkdir -p logs');
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }

    // Create a clean environment without test filtering variables
    const cleanEnv = { ...process.env };
    delete cleanEnv.PLATFORM;
    delete cleanEnv.MODULE_TYPE;
    delete cleanEnv.TEST_TYPE;
    delete cleanEnv.BINARY;
    delete cleanEnv.ENABLE_SPLASH_WINDOW;

    // Kill any existing Electron processes before starting
    await killElectronProcesses();

    // Perform suite-level setup once for all tests
    await setupTestSuite();

    // Run the test matrix
    console.log('\n📋 Running test matrix...');
    try {
      // Use the clean environment to run the test matrix
      const { stdout } = await execAsync('pnpm exec tsx ./scripts/run-test-matrix.ts', {
        env: cleanEnv,
      });
      console.log(stdout);

      // Check if there were any failures
      if (stdout.includes('0 failed')) {
        console.log('\n✅ All tests completed successfully!');
        process.exit(0);
      } else {
        console.error('\n❌ Some tests failed!');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('\n❌ Test matrix execution failed:', error.message);
      if (error.stdout) console.log('stdout:', error.stdout);
      if (error.stderr) console.log('stderr:', error.stderr);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error running tests:', error);
    process.exit(1);
  } finally {
    // Kill any remaining Electron processes
    await killElectronProcesses();

    // Always perform cleanup
    await cleanupTestSuite();

    // Kill any remaining processes one last time
    await killElectronProcesses();
  }
}

// Run the tests
runAllTests().catch((error) => {
  console.error('❌ Unhandled error:', error);
  // Kill any remaining processes before exiting
  killElectronProcesses()
    .catch((err) => console.error('Error killing processes:', err))
    .finally(() => process.exit(1));
});
