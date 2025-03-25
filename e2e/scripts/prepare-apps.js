// IMMEDIATE DEBUG LOGGING - will run even if later code fails
console.log('🚨 PREPARE-APPS.JS STARTED');
console.log('Script path:', import.meta.url);
console.log('Arguments:', process.argv);
console.log('Current working directory:', process.cwd());
console.log('Environment variables:');
console.log('- PATH:', process.env.PATH);
console.log('- PLATFORM:', process.env.PLATFORM);
console.log('- MODULE_TYPE:', process.env.MODULE_TYPE);
console.log('- TEST_TYPE:', process.env.TEST_TYPE);
console.log('- BINARY:', process.env.BINARY);
console.log('- MAC_UNIVERSAL:', process.env.MAC_UNIVERSAL);
console.log('- WDIO_TEST_APPS_PREPARED:', process.env.WDIO_TEST_APPS_PREPARED);
console.log('- WDIO_TEST_APPS_DIR:', process.env.WDIO_TEST_APPS_DIR);
console.log('-------------------------------------------');

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
