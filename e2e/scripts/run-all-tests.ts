/**
 * Run all tests with suite-level setup
 * This script runs all tests with a single setup and cleanup
 */

import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { setupTestSuite, cleanupTestSuite } from './suite-setup.js';

const execAsync = promisify(exec);

/**
 * ANSI escape codes for terminal control
 */
const ANSI = {
  reset: '\x1b[0m',
  showCursor: '\x1b[?25h',
  dim: '\x1b[2m',
};

/**
 * Ensure the terminal is restored to a usable state
 */
function restoreTerminal() {
  // Show cursor
  process.stdout.write(ANSI.showCursor);
  process.stdout.write(ANSI.reset);
}

// Register cleanup handlers for process termination
process.on('exit', () => {
  restoreTerminal();
});

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
  process.on(signal, () => {
    console.log(`\nReceived ${signal}, cleaning up...`);
    restoreTerminal();
    process.exit(0);
  });
});

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

/**
 * Format a timestamp in HH:MM:SS format
 */
function formatTimestamp(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Run the test matrix with real-time output
 */
async function runTestMatrix(cleanEnv: Record<string, string | undefined>): Promise<void> {
  const startTime = Date.now();

  return new Promise<void>((resolve, reject) => {
    console.log(`\n[${formatTimestamp()}] 📋 Running test matrix...`);
    console.log('─'.repeat(80));
    console.log(`${ANSI.dim}Run 'pnpm run logs' in another terminal to see detailed logs${ANSI.reset}`);

    try {
      console.log(`[${formatTimestamp()}] Executing test matrix...`);

      // Create command with environment variables set inline
      // This avoids any PATH or NODE_ENV issues
      let command = '';

      // Add environment variables to the command
      for (const [key, value] of Object.entries(cleanEnv)) {
        if (value !== undefined) {
          // Escape any special characters in the value
          const escapedValue = value.replace(/"/g, '\\"');
          command += `${key}="${escapedValue}" `;
        }
      }

      // Add the command to run the test matrix
      // Use direct tsx command to avoid ESM issues
      command += `pnpm exec tsx ./scripts/run-test-matrix.ts`;

      console.log(`[${formatTimestamp()}] Command: ${command}`);

      // Use execSync to run the command directly with inherited stdio
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      const duration = Date.now() - startTime;
      console.log(`\n[${formatTimestamp()}] 🏁 Test execution completed in ${formatDuration(duration)}`);
      console.log(`\n[${formatTimestamp()}] ✅ All tests completed successfully!`);
      resolve();
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`\n[${formatTimestamp()}] 🏁 Test execution completed in ${formatDuration(duration)}`);
      console.error(`\n[${formatTimestamp()}] ❌ Some tests failed:`, error);
      reject(new Error(`Tests failed with code ${(error as any).status || 'unknown'}`));
    }
  });
}

async function runAllTests() {
  const startTime = Date.now();
  console.log(`\n[${formatTimestamp()}] 🧪 Running All WebdriverIO Electron Service Tests 🧪`);
  console.log('═'.repeat(80));

  try {
    // Ensure logs directory exists
    try {
      // Use fs.mkdirSync instead of mkdir -p for cross-platform compatibility
      const fs = await import('fs');
      const path = await import('path');
      const logsDir = path.join(process.cwd(), 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      console.log(`Created logs directory at: ${logsDir}`);
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }

    // Create a clean environment without test filtering variables
    const cleanEnv: Record<string, string> = {
      // Base environment variables
      PATH: process.env.PATH || '',
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--no-warnings --experimental-specifier-resolution=node',
      DEBUG: process.env.DEBUG || 'wdio-electron-service',
      WDIO_CHALK_COMPAT: 'true', // For compatibility with ESM modules in CJS context
      PRESERVE_TEMP_DIR: 'true',
      SUITE_CLEANUP_MANAGED: 'true',

      // Explicitly unset any limiting environment variables
      WDIO_FILTER: '',
      EXCLUDE_MULTIREMOTE: '',
      TEST_SKIP: '',
      TEST_MODE: '',
    };

    // Check if we're running in Mac Universal mode
    if (process.env.MAC_UNIVERSAL === 'true') {
      // In Mac Universal mode, don't set filter environment variables
      // as they would conflict with MAC_UNIVERSAL behavior
      cleanEnv.MAC_UNIVERSAL = 'true';
      console.log(
        `[${formatTimestamp()}] 🍎 Running in Mac Universal mode - only builder and forge binary tests will be included`,
      );
      console.log(
        `[${formatTimestamp()}] ⚠️ Note: MAC_UNIVERSAL=true will override any PLATFORM, MODULE_TYPE, etc. settings`,
      );
    } else {
      // If not in Mac Universal mode, use wildcards for all combinations
      cleanEnv.PLATFORM = '*';
      cleanEnv.MODULE_TYPE = '*';
      cleanEnv.TEST_TYPE = '*';
      cleanEnv.BINARY = '*';
    }

    // Kill any existing Electron processes before starting
    await killElectronProcesses();

    // Check if apps are already prepared
    if (process.env.WDIO_TEST_APPS_PREPARED === 'true' && process.env.WDIO_TEST_APPS_DIR) {
      console.log(`[${formatTimestamp()}] ✅ Test apps already prepared, reusing existing setup`);
      console.log(`Using test apps directory: ${process.env.WDIO_TEST_APPS_DIR}`);
    } else {
      // Always perform suite-level setup to ensure we have a fresh environment
      console.log(`[${formatTimestamp()}] 🔧 Setting up test suite...`);

      // Perform suite-level setup once for all tests
      await setupTestSuite();
    }

    // Get the temp directory from the environment variable
    const tmpDir = process.env.WDIO_TEST_APPS_DIR;
    if (!tmpDir) {
      throw new Error('Test apps directory not set after setup');
    }

    // Set environment variables for all tests
    cleanEnv.WDIO_TEST_APPS_PREPARED = 'true';
    cleanEnv.WDIO_TEST_APPS_DIR = tmpDir;

    console.log(`[${formatTimestamp()}] ✅ Test suite setup complete. Test apps prepared at: ${tmpDir}`);
    console.log(`[${formatTimestamp()}] 📝 Environment variables set:`);

    // Log key variables that affect what tests will run
    console.log(`   PLATFORM: ${cleanEnv.PLATFORM}`);
    console.log(`   MODULE_TYPE: ${cleanEnv.MODULE_TYPE}`);
    console.log(`   TEST_TYPE: ${cleanEnv.TEST_TYPE}`);
    console.log(`   BINARY: ${cleanEnv.BINARY}`);
    console.log(`   WDIO_TEST_APPS_PREPARED: ${cleanEnv.WDIO_TEST_APPS_PREPARED}`);
    console.log(`   WDIO_TEST_APPS_DIR: ${cleanEnv.WDIO_TEST_APPS_DIR}`);

    console.log(`[${formatTimestamp()}] ℹ️ Test matrix explanation:`);
    if (
      cleanEnv.PLATFORM === '*' &&
      cleanEnv.MODULE_TYPE === '*' &&
      cleanEnv.TEST_TYPE === '*' &&
      cleanEnv.BINARY === '*'
    ) {
      console.log(`   Using wildcard settings - will run ALL test combinations!`);
    } else {
      console.log(`   Using specific settings - will run a FILTERED set of tests:`);
      if (cleanEnv.PLATFORM !== '*') console.log(`   - Only ${cleanEnv.PLATFORM} platform tests`);
      if (cleanEnv.MODULE_TYPE !== '*') console.log(`   - Only ${cleanEnv.MODULE_TYPE} module type tests`);
      if (cleanEnv.TEST_TYPE !== '*') console.log(`   - Only ${cleanEnv.TEST_TYPE} test type tests`);
      if (cleanEnv.BINARY !== '*')
        console.log(`   - Only ${cleanEnv.BINARY === 'true' ? 'binary' : 'no-binary'} tests`);
    }

    // Run the test matrix and wait for it to complete
    await runTestMatrix(cleanEnv);

    const duration = Date.now() - startTime;
    console.log(`\n[${formatTimestamp()}] 🏁 Test execution completed in ${formatDuration(duration)}`);

    return 0; // Success exit code
  } catch (error) {
    console.error(`[${formatTimestamp()}] ❌ Error running tests:`, error);
    return 1; // Error exit code
  } finally {
    // Ensure terminal is restored
    restoreTerminal();

    // Kill any remaining Electron processes
    console.log(`\n[${formatTimestamp()}] 🧹 Cleaning up...`);
    await killElectronProcesses();

    // Reset the preserve temp dir flag before cleanup
    process.env.PRESERVE_TEMP_DIR = 'false';

    // Always perform cleanup
    await cleanupTestSuite();
    console.log(`[${formatTimestamp()}] ✅ Test suite cleanup complete`);

    // Kill any remaining processes one last time
    await killElectronProcesses();

    const duration = Date.now() - startTime;
    console.log(`\n[${formatTimestamp()}] 🏁 Total execution time: ${formatDuration(duration)}`);
  }
}

// Run the tests
runAllTests()
  .then((exitCode) => {
    restoreTerminal();
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(`[${formatTimestamp()}] ❌ Unhandled error:`, error);
    // Kill any remaining processes before exiting
    restoreTerminal();
    killElectronProcesses()
      .catch((err) => console.error('Error killing processes:', err))
      .finally(() => process.exit(1));
  });
