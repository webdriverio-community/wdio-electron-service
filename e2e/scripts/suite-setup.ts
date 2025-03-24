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
 * Build test apps for the specified scenarios
 * @param scenarios Array of scenarios to build (builder, forge, no-binary)
 * @param moduleTypes Array of module types to build (cjs, esm)
 */
async function buildTestApps(scenarios: string[], moduleTypes: string[]): Promise<void> {
  console.log(
    `🔨 Building test apps for scenarios: ${scenarios.join(', ')} with module types: ${moduleTypes.join(', ')}`,
  );

  const rootDir = process.cwd();
  const appsDir = `${rootDir}/../apps`;

  for (const scenario of scenarios) {
    for (const moduleType of moduleTypes) {
      const appDir = `${appsDir}/${scenario}-${moduleType}`;
      console.log(`Building app: ${scenario}-${moduleType} in ${appDir}`);

      try {
        console.log(`Installing dependencies for ${scenario}-${moduleType}...`);
        // execSync('pnpm install --no-frozen-lockfile', {
        //   cwd: appDir,
        //   stdio: 'inherit',
        //   timeout: 120000,
        // });

        console.log(`Building ${scenario}-${moduleType}...`);
        execSync('pnpm run build', {
          cwd: appDir,
          stdio: 'inherit',
          timeout: 300000,
        });

        console.log(`✅ Successfully built ${scenario}-${moduleType}`);
      } catch (error) {
        console.error(`❌ Error building ${scenario}-${moduleType}:`, error);
        // Continue with other apps even if one fails
      }
    }
  }
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
    cleanupTestSuite().catch((error) => {
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

      // Determine which scenarios and module types to build
      const appsToPrepare = testAppsManager.getAppsToPrepare();
      const { scenarios, moduleTypes } = appsToPrepare;

      // Build the test apps before preparing them
      await buildTestApps(scenarios, moduleTypes);

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
    cleanupTestSuite().catch((error) => {
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

      // If tmp dir exists, show its contents
      if (process.env.WDIO_TEST_APPS_DIR) {
        try {
          console.log(`Test apps directory contents (${process.env.WDIO_TEST_APPS_DIR}):`);
          const tmpDirOutput = execSync(`ls -la ${process.env.WDIO_TEST_APPS_DIR}`).toString();
          console.log(tmpDirOutput);
        } catch (err) {
          console.log('Could not get test apps directory contents:', (err as Error).message);
        }
      }

      // Check if any Electron processes are running
      try {
        console.log('Electron processes:');
        const electronProcesses = execSync('ps aux | grep electron | grep -v grep').toString();
        console.log(electronProcesses || 'No Electron processes found');
      } catch (err) {
        console.log('Could not get Electron processes:', (err as Error).message);
      }

      // Runtime context
      console.log('Runtime information:');
      console.log(`- Node.js version: ${process.version}`);
      console.log(`- Platform: ${process.platform}`);
      console.log(`- Architecture: ${process.arch}`);
      console.log(`- PID: ${process.pid}`);
      console.log(`- PPID: ${process.ppid}`);
      console.log(`- Runtime since process start: ${process.uptime().toFixed(2)} seconds`);

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

/**
 * Clean up suite resources
 */
export function cleanupTestSuite(): Promise<void> {
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
