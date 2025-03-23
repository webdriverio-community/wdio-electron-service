#!/usr/bin/env tsx

/**
 * Prepare test apps for E2E tests
 * This is a dedicated script that can be run separately to prepare the test apps
 *
 * Usage:
 *   pnpm run prepare-apps                      # Prepare all apps
 *   pnpm run prepare-apps --scenario=builder   # Prepare only builder apps
 *   pnpm run prepare-apps --module-type=esm    # Prepare only ESM apps
 *   pnpm run prepare-apps --timeout=300000     # Use custom timeout
 */

import { setupTestSuite } from './suite-setup.js';

// Parse command line arguments for timeout and app filtering
function parseArgs(): { timeout: number; scenario?: string; moduleType?: string } {
  const args = process.argv.slice(2);
  const result: { timeout: number; scenario?: string; moduleType?: string } = {
    timeout: 120000, // Default timeout (120 seconds)
  };

  // Parse each argument
  for (const arg of args) {
    if (arg.startsWith('--timeout=')) {
      const timeout = parseInt(arg.split('=')[1], 10);
      if (!isNaN(timeout) && timeout > 0) {
        result.timeout = timeout;
      }
    } else if (arg.startsWith('--scenario=')) {
      result.scenario = arg.split('=')[1];
    } else if (arg.startsWith('--module-type=')) {
      result.moduleType = arg.split('=')[1];
    }
  }

  return result;
}

// Add debug info logging
function logDebugInfo() {
  console.log('************* PREPARE-APPS DEBUG INFO START *************');

  // Process and runtime info
  console.log('Process information:');
  console.log(`- Process ID: ${process.pid}`);
  console.log(`- Node.js version: ${process.version}`);
  console.log(`- Platform: ${process.platform}`);
  console.log(`- Architecture: ${process.arch}`);
  console.log(`- Current working directory: ${process.cwd()}`);
  console.log(`- Execution time: ${new Date().toISOString()}`);

  // Memory usage
  const memoryUsage = process.memoryUsage();
  console.log('Memory usage:');
  console.log(`- RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
  console.log(`- Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
  console.log(`- Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`- External: ${Math.round(memoryUsage.external / 1024 / 1024)}MB`);

  // Environment variables
  console.log('Environment variables:');
  console.log(`- NODE_OPTIONS: ${process.env.NODE_OPTIONS || 'not set'}`);
  console.log(`- PRESERVE_TEMP_DIR: ${process.env.PRESERVE_TEMP_DIR || 'not set'}`);
  console.log(`- WDIO_TEST_APPS_PREPARED: ${process.env.WDIO_TEST_APPS_PREPARED || 'not set'}`);
  console.log(`- WDIO_TEST_APPS_DIR: ${process.env.WDIO_TEST_APPS_DIR || 'not set'}`);
  console.log(`- ELECTRON_CACHE: ${process.env.ELECTRON_CACHE || 'not set'}`);
  console.log(`- USE_ARTIFACT_SERVICE: ${process.env.USE_ARTIFACT_SERVICE || 'not set'}`);
  console.log(`- SKIP_SERVICE_PACKING: ${process.env.SKIP_SERVICE_PACKING || 'not set'}`);
  console.log(`- WDIO_SERVICE_TARBALL: ${process.env.WDIO_SERVICE_TARBALL || 'not set'}`);

  // Command line
  console.log('Command line:');
  console.log(process.argv.join(' '));

  console.log('************* PREPARE-APPS DEBUG INFO END *************');
}

async function prepareApps(): Promise<void> {
  try {
    const startTime = Date.now();

    // Log debug info at the start
    console.log('Starting prepare-apps process');
    logDebugInfo();

    // Parse command line arguments
    const args = parseArgs();
    console.log(`Using timeout: ${args.timeout}ms for app preparation`);

    // Set environment variables based on CLI arguments (for testAppsManager)
    if (args.scenario) {
      process.env.SCENARIO = args.scenario;
      console.log(`Setting SCENARIO environment variable to: ${args.scenario}`);
    }

    if (args.moduleType) {
      process.env.MODULE_TYPE = args.moduleType;
      console.log(`Setting MODULE_TYPE environment variable to: ${args.moduleType}`);
    }

    // Add a force exit timeout as a last resort
    const forceExitTimeout = setTimeout(() => {
      console.error(`Force exiting after timeout (${args.timeout}ms)`);
      console.log('Final diagnostics before force exit:');
      logDebugInfo();
      process.exit(143); // Same code as SIGTERM
    }, args.timeout);

    // Make sure the timeout doesn't prevent the process from exiting normally
    forceExitTimeout.unref();

    // Set up the test suite
    await setupTestSuite();

    // Clear timeout since we completed successfully
    clearTimeout(forceExitTimeout);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ App preparation completed successfully in ${duration.toFixed(2)} seconds`);

    // Log final state
    console.log('Final state after completion:');
    logDebugInfo();

    process.exit(0);
  } catch (error) {
    console.error('Error preparing test apps:', error);
    process.exit(1);
  }
}

// Register SIGTERM handler with diagnostic info
process.on('SIGTERM', () => {
  console.log('Received SIGTERM in prepare-apps script');
  console.log('Diagnostic info at SIGTERM:');
  logDebugInfo();
  process.exit(143);
});

// Run the function
prepareApps().catch((error) => {
  console.error('Unhandled error in prepare-apps:', error);
  process.exit(1);
});
