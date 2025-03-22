/**
 * Run all tests with suite-level setup
 * This script runs all tests with a single setup and cleanup
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
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

    // Use spawn instead of exec to get real-time output
    // Use 'inherit' for stdout to show the status display directly
    const child = spawn('pnpm', ['exec', 'tsx', './scripts/run-test-matrix.ts'], {
      env: cleanEnv,
      stdio: ['ignore', 'inherit', 'pipe'], // Inherit stdout to show status display, pipe stderr
      shell: true,
    });

    let hasFailures = false;

    // Capture stderr but don't display it
    child.stderr.on('data', (_data) => {
      // Just capture but don't display
      // Check for test failures in stderr
      const chunk = _data.toString();
      if (chunk.includes('tests failed')) {
        hasFailures = true;
      }
    });

    // Handle process completion
    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      console.log(`\n[${formatTimestamp()}] 🏁 Test execution completed in ${formatDuration(duration)}`);

      if (code === 0 && !hasFailures) {
        console.log(`\n[${formatTimestamp()}] ✅ All tests completed successfully!`);
        resolve();
      } else {
        console.error(`\n[${formatTimestamp()}] ❌ Some tests failed with exit code: ${code}`);
        reject(new Error(`Tests failed with exit code: ${code}`));
      }
    });

    // Handle process errors
    child.on('error', (error) => {
      console.error(`\n[${formatTimestamp()}] ❌ Error executing test matrix:`, error);
      reject(error);
    });
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
    const cleanEnv = { ...process.env };
    delete cleanEnv.PLATFORM;
    delete cleanEnv.MODULE_TYPE;
    delete cleanEnv.TEST_TYPE;
    delete cleanEnv.BINARY;
    delete cleanEnv.ENABLE_SPLASH_WINDOW;

    // Kill any existing Electron processes before starting
    await killElectronProcesses();

    // Always perform suite-level setup to ensure we have a fresh environment
    console.log(`[${formatTimestamp()}] 🔧 Setting up test suite...`);

    // Set environment variable to preserve temp directory during test runs
    process.env.PRESERVE_TEMP_DIR = 'true';
    cleanEnv.PRESERVE_TEMP_DIR = 'true';

    // Perform suite-level setup once for all tests
    await setupTestSuite();

    // Get the temp directory from the environment variable
    const tmpDir = process.env.WDIO_TEST_APPS_DIR;
    console.log(`[${formatTimestamp()}] ✅ Test suite setup complete. Test apps prepared at: ${tmpDir}`);

    // Set environment variables to indicate suite management
    cleanEnv.SUITE_SETUP_DONE = 'true';
    cleanEnv.SUITE_CLEANUP_MANAGED = 'true';

    // Explicitly set the WDIO_TEST_APPS variables
    cleanEnv.WDIO_TEST_APPS_PREPARED = 'true';
    cleanEnv.WDIO_TEST_APPS_DIR = tmpDir;

    console.log(`[${formatTimestamp()}] 📝 Environment variables set:`);
    console.log(`   WDIO_TEST_APPS_PREPARED: ${cleanEnv.WDIO_TEST_APPS_PREPARED}`);
    console.log(`   WDIO_TEST_APPS_DIR: ${cleanEnv.WDIO_TEST_APPS_DIR}`);

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
