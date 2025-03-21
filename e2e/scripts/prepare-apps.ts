#!/usr/bin/env tsx

/**
 * Prepare Apps Script
 *
 * This script prepares the test applications for E2E testing.
 * It handles timeouts and captures command-line arguments.
 */

import { setupTestSuite } from './suite-setup.js';

// Log script execution start with timestamp
console.log(`[${new Date().toISOString()}] Starting prepare-apps script`);
console.log(`Process ID: ${process.pid}`);
console.log(`Command line args: ${process.argv.slice(2).join(' ')}`);

// Set up error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

async function main() {
  try {
    console.log('Calling setupTestSuite()');
    await setupTestSuite();
    console.log('✅ App preparation completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ App preparation failed:', err);
    process.exit(1);
  }
}

// Immediately-invoked async function to ensure any unhandled promise
// rejections are properly caught and reported
(async () => {
  try {
    await main();
  } catch (err) {
    console.error('Fatal error in main execution:', err);
    process.exit(1);
  }
})();
