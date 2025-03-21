/**
 * Suite-level setup script for WebdriverIO tests
 * This script prepares the test apps once for the entire test suite
 * and sets environment variables for all tests to use.
 */

import { execSync } from 'child_process';
import { testAppsManager } from '../setup/testAppsManager.js';

/**
 * Parse command line arguments for timeout
 * @returns Timeout in milliseconds
 */
function getTimeoutFromArgs(): number {
  const args = process.argv.slice(2);
  const timeoutArg = args.find((arg) => arg.startsWith('--timeout='));
  if (timeoutArg) {
    const timeout = parseInt(timeoutArg.split('=')[1], 10);
    if (!isNaN(timeout) && timeout > 0) {
      return timeout;
    }
  }
  // Default timeout (60 seconds)
  return 60000;
}

/**
 * Kill all running Electron processes
 */
async function killElectronProcesses(): Promise<void> {
  console.log('🔪 Killing any remaining Electron processes...');
  try {
    if (process.platform === 'win32') {
      // On Windows, use taskkill with /F to force kill
      execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' });
    } else {
      // On Unix-like systems, try multiple approaches to ensure all processes are killed
      try {
        // First try pkill with -f to match command line
        execSync('pkill -f electron', { stdio: 'ignore' });
      } catch (_) {
        // Ignore errors, as they likely mean no processes were found
      }

      try {
        // Also try to kill by process name
        execSync('pkill -9 -f Electron', { stdio: 'ignore' });
      } catch (_) {
        // Ignore errors
      }

      try {
        // Also try to kill any node processes related to electron
        execSync('pkill -f "node.*electron"', { stdio: 'ignore' });
      } catch (_) {
        // Ignore errors
      }

      // On macOS, also try to kill by app bundle
      if (process.platform === 'darwin') {
        try {
          execSync('pkill -f "example-.*\\.app"', { stdio: 'ignore' });
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
  return Promise.resolve();
}

/**
 * Set up the test suite
 */
export async function setupTestSuite(): Promise<void> {
  const startTime = Date.now();
  console.log('🚀 Performing suite-level setup...');
  console.log(`Setup started at: ${new Date().toISOString()}`);

  // Get timeout from command line arguments
  const timeout = getTimeoutFromArgs();
  console.log(`Using timeout of ${timeout}ms for suite setup`);

  // Register cleanup handlers to ensure we clean up even on unexpected terminations
  process.on('SIGINT', handleTermination);
  process.on('SIGTERM', handleTermination);
  process.on('exit', () => {
    console.log('Process exit event received');
    cleanupSuite().catch((error) => {
      console.error('Error in suite cleanup:', error);
      process.exit(1);
    });
  });

  console.log('📊 Setup environment info:');
  console.log(`- Node.js version: ${process.version}`);
  console.log(`- Process ID: ${process.pid}`);
  console.log(`- Platform: ${process.platform}`);
  console.log(`- Current working directory: ${process.cwd()}`);
  console.log(`- ELECTRON_CACHE: ${process.env.ELECTRON_CACHE || 'not set'}`);
  console.log(`- Memory usage: ${JSON.stringify(process.memoryUsage())}`);

  try {
    // Kill any leftover Electron processes first
    await killElectronProcesses();

    // Add timeout promise to detect long-running operations
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout during test suite setup - operation took too long (${timeout}ms)`));
      }, timeout);
    });

    // Create the actual setup promise
    const setupPromise = (async () => {
      // Check if test apps are already prepared
      if (testAppsManager.isTestAppsPrepared()) {
        console.log('✅ Test apps already prepared, reusing existing setup');
        const tmpDir = testAppsManager.getTmpDir();
        if (tmpDir) {
          process.env.WDIO_TEST_APPS_PREPARED = 'true';
          process.env.WDIO_TEST_APPS_DIR = tmpDir;
          console.log(`📂 Using existing test apps directory: ${tmpDir}`);
        }
        return;
      }

      // Prepare test apps
      console.log('📦 Preparing test apps...');

      // Log the PRESERVE_TEMP_DIR environment variable
      if (process.env.PRESERVE_TEMP_DIR === 'true') {
        console.log('🔒 Temp directory will be preserved (PRESERVE_TEMP_DIR=true)');
      }

      const tmpDir = await testAppsManager.prepareTestApps();

      // Set environment variables for all tests to use
      process.env.WDIO_TEST_APPS_PREPARED = 'true';
      process.env.WDIO_TEST_APPS_DIR = tmpDir;

      console.log('✅ Test suite preparation complete');
      const setupTime = (Date.now() - startTime) / 1000;
      console.log(`Setup completed in ${setupTime.toFixed(2)} seconds. Test apps prepared at: ${tmpDir}`);
    })();

    // Race the setup against the timeout
    await Promise.race([setupPromise, timeoutPromise]);
  } catch (err) {
    console.error('❌ Error during test suite setup:', err);
    const setupTime = (Date.now() - startTime) / 1000;
    console.error(`Setup failed after ${setupTime.toFixed(2)} seconds`);

    // Still try to clean up even if setup failed
    cleanupSuite().catch((error) => {
      console.error('Error in suite cleanup:', error);
      process.exit(1);
    });
  }
}

/**
 * Handle termination signals
 * @param signal Signal received (e.g., SIGINT, SIGTERM)
 */
function handleTermination(signal: string): void {
  console.log(`Received ${signal}, cleaning up...`);
  console.log(`Signal received by process ${process.pid} at ${new Date().toISOString()}`);

  // For Linux, dump process information to help debug SIGTERM issues
  if (process.platform === 'linux') {
    try {
      console.log('Process terminating due to SIGTERM:', signal);
      console.log(`Memory usage at termination: ${JSON.stringify(process.memoryUsage())}`);
      console.log(`Environment: NODE_OPTIONS=${process.env.NODE_OPTIONS || 'not set'}`);

      // Attempt to get CPU and memory usage
      try {
        const topOutput = execSync(`ps -p ${process.pid} -o %cpu,%mem,rss,vsz`).toString();
        console.log(`Process resource usage:\n${topOutput}`);
      } catch (err) {
        console.log('Could not get process resource usage:', (err as Error).message);
      }
    } catch (err) {
      console.error('Error while gathering diagnostic information:', err);
    }
  }

  cleanupSuite().finally(() => {
    process.exit(signal === 'SIGTERM' ? 143 : 130);
  });
}

/**
 * Clean up suite resources
 */
export function cleanupSuite(): Promise<void> {
  try {
    console.log('🧹 Performing suite-level cleanup...');

    try {
      // First kill any remaining Electron processes
      return killElectronProcesses()
        .catch((err) => {
          console.error('Error killing Electron processes:', err);
        })
        .then(() => {
          // Only clean up the test apps if PRESERVE_TEMP_DIR is not set to 'true'
          if (process.env.PRESERVE_TEMP_DIR !== 'true') {
            testAppsManager.cleanup();
            console.log('✅ Temp directory cleaned up');
          } else {
            console.log('🔒 Preserving temp directory (PRESERVE_TEMP_DIR=true)');
          }
        });
    } catch (err) {
      console.error('Error during cleanup:', err);
      return Promise.resolve();
    }
  } catch (err) {
    console.error('Error during suite cleanup:', err);
    return Promise.resolve();
  }
}

// If this script is run directly, perform setup
// In ES modules, we check if the current file is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestSuite().catch((error) => {
    console.error('Error in suite setup:', error);
    process.exit(1);
  });
}
