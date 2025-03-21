/**
 * Suite-level setup script for WebdriverIO tests
 * This script prepares the test apps once for the entire test suite
 * and sets environment variables for all tests to use.
 */

import { createTempDir, getTempDir, cleanupTempDir } from './temp-dir.js';
import { killElectronProcesses } from './electron-process.js';
import { packService } from './pack-service.js';
import { linkExampleApps } from './link-example-apps.js';
import { setupTestAssets } from './setup-test-assets.js';
import { execSync } from 'child_process';

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
    cleanupSuite()
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
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
    console.log('🔪 Killing any remaining Electron processes...');
    await killElectronProcesses();
    console.log('✅ Electron processes killed');

    console.log('📦 Preparing test apps...');
    console.log('Registered cleanup handlers for process termination');

    // Add timeout promise to detect long-running operations
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout during test suite setup - operation took too long (${timeout}ms)`));
      }, timeout);
    });

    // Create the actual setup promise
    const setupPromise = (async () => {
      console.log('Creating temp directory');
      await createTempDir();
      console.log(`Temp directory created at: ${getTempDir()}`);

      console.log('Packing service');
      try {
        await packService();
        console.log('Service packed successfully');
      } catch (err) {
        console.error('Error packing service:', err);
        throw err;
      }

      console.log('Linking example apps');
      try {
        await linkExampleApps();
        console.log('Example apps linked successfully');
      } catch (err) {
        console.error('Error linking example apps:', err);
        throw err;
      }

      console.log('Setting up test assets');
      try {
        await setupTestAssets();
        console.log('Test assets set up successfully');
      } catch (err) {
        console.error('Error setting up test assets:', err);
        throw err;
      }

      console.log('✅ Test suite preparation complete');
      const setupTime = (Date.now() - startTime) / 1000;
      console.log(`Setup completed in ${setupTime.toFixed(2)} seconds`);
    })();

    // Race the setup against the timeout
    await Promise.race([setupPromise, timeoutPromise]);
  } catch (err) {
    console.error('❌ Error during test suite setup:', err);
    const setupTime = (Date.now() - startTime) / 1000;
    console.error(`Setup failed after ${setupTime.toFixed(2)} seconds`);

    // Still try to clean up even if setup failed
    cleanupSuite()
      .then(() => {
        process.exit(1);
      })
      .catch((error) => {
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

  cleanupSuite()
    .then(() => {
      process.exit(signal === 'SIGTERM' ? 143 : 130);
    })
    .catch((error) => {
      console.error('Error in suite cleanup:', error);
      process.exit(1);
    });
}

/**
 * Clean up suite resources
 */
function cleanupSuite(): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      console.log('🧹 Performing suite-level cleanup...');

      try {
        console.log('🔪 Killing any remaining Electron processes...');
        // Convert to a proper promise chain
        killElectronProcesses()
          .catch((err: Error) => {
            console.error('Error killing Electron processes:', err);
          })
          .finally(() => {
            try {
              const tempDir = getTempDir();
              if (tempDir) {
                console.log(`Cleaning up temp directory: ${tempDir}`);
                cleanupTempDir();
              } else {
                console.log('No temp directory to clean up');
              }
            } catch (err) {
              console.error('Error during temp directory cleanup:', err);
            }
            resolve();
          });
      } catch (err) {
        console.error('Error during process kill cleanup:', err);
        resolve();
      }
    } catch (err) {
      console.error('Error during cleanup:', err);
      resolve(); // Still resolve to avoid hanging
    }
  });
}

// Export the cleanup function for external use
export const cleanupTestSuite = cleanupSuite;

// If this script is run directly, perform setup
// In ES modules, we check if the current file is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestSuite().catch((error) => {
    console.error('Error in suite setup:', error);
    process.exit(1);
  });
}
