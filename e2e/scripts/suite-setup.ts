/**
 * Suite-level setup script for WebdriverIO tests
 * This script prepares the test apps once for the entire test suite
 * and sets environment variables for all tests to use.
 */

import { execSync } from 'node:child_process';
import { testAppsManager } from '../setup/testAppsManager.js';
import { killElectronProcesses } from './utils.js';

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
  console.log(`Platform: ${process.platform}`);

  // Get timeout from command line arguments
  const timeout = getTimeoutFromArgs();
  console.log(`Using timeout of ${timeout}ms for suite setup`);

  // Register cleanup handlers to ensure we clean up even on unexpected terminations
  process.on('SIGINT', handleTermination);
  process.on('SIGTERM', handleTermination);
  process.on('exit', () => {
    console.log('Process exit event received');
    cleanupTestSuite().catch((error: Error) => {
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

    // Check if the apps are already prepared via environment variables
    if (process.env.WDIO_TEST_APPS_PREPARED === 'true' && process.env.WDIO_TEST_APPS_DIR) {
      console.log('✅ Test apps already prepared via environment variables, reusing existing setup');
      console.log(`📂 Using existing test apps directory: ${process.env.WDIO_TEST_APPS_DIR}`);
      return;
    }

    // Check if apps are already prepared via testAppsManager
    if (testAppsManager.isTestAppsPrepared()) {
      console.log('✅ Test apps already prepared via testAppsManager, reusing existing setup');
      const tmpDir = testAppsManager.getTmpDir();
      if (tmpDir) {
        process.env.WDIO_TEST_APPS_PREPARED = 'true';
        process.env.WDIO_TEST_APPS_DIR = tmpDir;
        console.log(`📂 Using existing test apps directory: ${tmpDir}`);
        return;
      }
    }

    // If we reach here, we need to prepare the apps directly
    console.log('📦 Preparing test apps directly...');
    const tmpDir = await testAppsManager.prepareTestApps();
    if (!tmpDir) {
      throw new Error('Failed to prepare test apps');
    }

    process.env.WDIO_TEST_APPS_PREPARED = 'true';
    process.env.WDIO_TEST_APPS_DIR = tmpDir;

    console.log('✅ Test suite preparation complete');
    const setupTime = (Date.now() - startTime) / 1000;
    console.log(`Setup completed in ${setupTime.toFixed(2)} seconds. Test apps prepared at: ${tmpDir}`);
  } catch (err) {
    console.error('❌ Error during test suite setup:', err);
    const setupTime = (Date.now() - startTime) / 1000;
    console.error(`Setup failed after ${setupTime.toFixed(2)} seconds`);

    // Still try to clean up even if setup failed
    cleanupTestSuite().catch((error: Error) => {
      console.error('Error in suite cleanup:', error);
      process.exit(1);
    });
  }
}

/**
 * Clean up suite resources
 */
export async function cleanupTestSuite(): Promise<void> {
  try {
    console.log('🧹 Performing suite-level cleanup...');

    try {
      // First kill any remaining Electron processes
      await killElectronProcesses();

      // Only clean up the test apps if PRESERVE_TEMP_DIR is not set to 'true'
      if (process.env.PRESERVE_TEMP_DIR !== 'true') {
        await testAppsManager.cleanup();
        console.log('✅ Temp directory cleaned up');
      } else {
        console.log('🔒 Preserving temp directory (PRESERVE_TEMP_DIR=true)');
      }
    } catch (err) {
      console.error('Error during cleanup:', err);
    }
  } catch (err) {
    console.error('Error during suite cleanup:', err);
  }
}

/**
 * Handle termination signals
 * @param signal Signal received (e.g., SIGINT, SIGTERM)
 */
function handleTermination(signal: string): void {
  console.log(`Received ${signal}, cleaning up...`);
  console.log(`Signal received by process ${process.pid} at ${new Date().toISOString()}`);

  // For Linux, dump extensive debug information to help debug SIGTERM issues
  if (process.platform === 'linux') {
    try {
      console.log('************* SIGTERM DIAGNOSTIC INFO START *************');
      console.log(`Process ${process.pid} terminating due to ${signal} at ${new Date().toISOString()}`);

      // Memory usage details
      const memoryUsage = process.memoryUsage();
      console.log('Memory usage at termination:');
      console.log(`- RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
      console.log(`- Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
      console.log(`- Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
      console.log(`- External: ${Math.round(memoryUsage.external / 1024 / 1024)}MB`);

      // Environment variables
      console.log('Environment variables:');
      console.log(`- NODE_OPTIONS: ${process.env.NODE_OPTIONS || 'not set'}`);
      console.log(`- PRESERVE_TEMP_DIR: ${process.env.PRESERVE_TEMP_DIR || 'not set'}`);
      console.log(`- WDIO_TEST_APPS_DIR: ${process.env.WDIO_TEST_APPS_DIR || 'not set'}`);
      console.log(`- ELECTRON_CACHE: ${process.env.ELECTRON_CACHE || 'not set'}`);

      // Process info
      try {
        const topOutput = execSync(
          `ps -p ${process.pid} -o pid,ppid,pcpu,pmem,vsz,rss,tt,stat,start,time,comm`,
        ).toString();
        console.log('Process details:');
        console.log(topOutput);
      } catch (err) {
        console.log('Could not get process details:', (err as Error).message);
      }

      // List child processes
      try {
        console.log('Child processes:');
        const childProcesses = execSync(
          `ps --ppid ${process.pid} -o pid,ppid,pcpu,pmem,vsz,rss,tt,stat,start,time,comm`,
        ).toString();
        console.log(childProcesses || 'No child processes found');
      } catch (err) {
        console.log('Could not get child processes:', (err as Error).message);
      }

      // List running Node processes
      try {
        console.log('Node processes running:');
        const nodeProcesses = execSync('ps aux | grep node | grep -v grep').toString();
        console.log(nodeProcesses || 'No Node processes found');
      } catch (err) {
        console.log('Could not get Node processes:', (err as Error).message);
      }

      // System load
      try {
        console.log('System load:');
        const loadAvg = execSync('cat /proc/loadavg').toString();
        console.log(loadAvg);
      } catch (err) {
        console.log('Could not get system load:', (err as Error).message);
      }

      // System memory
      try {
        console.log('System memory:');
        const memInfo = execSync('free -m').toString();
        console.log(memInfo);
      } catch (err) {
        console.log('Could not get system memory info:', (err as Error).message);
      }

      // Current working directory and file tree
      console.log(`Current working directory: ${process.cwd()}`);
      try {
        console.log('Directory structure:');
        const dirOutput = execSync(`ls -la ${process.cwd()}`).toString();
        console.log(dirOutput);
      } catch (err) {
        console.log('Could not get directory structure:', (err as Error).message);
      }

      console.log('************* SIGTERM DIAGNOSTIC INFO END *************');
    } catch (err) {
      console.error('Error while gathering diagnostic information:', err);
    }
  }

  // Add a timeout to force exit after 10 seconds, in case cleanup hangs
  const forceExitTimeout = setTimeout(() => {
    console.error('Force exiting after timeout during cleanup (10s)');
    process.exit(signal === 'SIGTERM' ? 143 : 130);
  }, 10000);

  // Make sure the timeout doesn't prevent the process from exiting naturally
  forceExitTimeout.unref();

  cleanupTestSuite().finally(() => {
    clearTimeout(forceExitTimeout);
    process.exit(signal === 'SIGTERM' ? 143 : 130);
  });
}

// If this script is run directly, perform setup
// In ES modules, we check if the current file is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestSuite().catch((error) => {
    console.error('Error in suite setup:', error);
    process.exit(1);
  });
}
