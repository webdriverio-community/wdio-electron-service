#!/usr/bin/env tsx

import { join } from 'path';
import pLimit from 'p-limit';
import { createEnvironmentContext, EnvironmentContext } from '../config/envSchema.js';
import { killElectronProcesses, execWithEnv, formatDuration } from './utils.js';
import { StatusBar, TestStatusTracker, TestResult } from './statusBar.js';
import BuildManager from './build-apps.js';

/**
 * Test variant definition
 */
interface TestVariant {
  platform: 'builder' | 'forge' | 'no-binary';
  moduleType: 'cjs' | 'esm';
  testType: 'standard' | 'window' | 'multiremote' | 'standalone';
  binary: boolean;
}

/**
 * Get human-readable test name
 */
function getTestName(variant: TestVariant): string {
  const parts = [variant.platform, variant.moduleType, variant.testType, variant.binary ? 'binary' : 'no-binary'];
  return parts.join('-');
}

/**
 * Generate all possible test variants
 */
function generateTestVariants(): TestVariant[] {
  const platforms: Array<'builder' | 'forge' | 'no-binary'> = ['builder', 'forge', 'no-binary'];
  const moduleTypes: Array<'cjs' | 'esm'> = ['cjs', 'esm'];
  const testTypes: Array<'standard' | 'window' | 'multiremote' | 'standalone'> = [
    'standard',
    'window',
    'multiremote',
    'standalone',
  ];

  const variants: TestVariant[] = [];

  for (const platform of platforms) {
    for (const moduleType of moduleTypes) {
      for (const testType of testTypes) {
        // no-binary platform is always non-binary
        const binary = platform !== 'no-binary';

        variants.push({
          platform,
          moduleType,
          testType,
          binary,
        });
      }
    }
  }

  return variants;
}

/**
 * Check if environment variables are set for filtering
 */
function hasEnvironmentFilters(): boolean {
  return !!(
    process.env.PLATFORM ||
    process.env.MODULE_TYPE ||
    process.env.TEST_TYPE ||
    process.env.BINARY ||
    process.env.MAC_UNIVERSAL === 'true'
  );
}

/**
 * Filter variants based on environment variables
 * - If NO environment filters are set: run ALL variants (local development)
 * - If ANY environment filters are set: run only matching variants (CI mode)
 */
function filterVariants(variants: TestVariant[], envContext: EnvironmentContext): TestVariant[] {
  // If no environment filters are set, run all variants (full matrix for local dev)
  if (!hasEnvironmentFilters()) {
    console.log('🎯 No environment filters detected - running full test matrix');
    return variants;
  }

  console.log('🎯 Environment filters detected - filtering test variants');

  return variants.filter((variant) => {
    // Platform filter - only apply if explicitly set
    if (process.env.PLATFORM && variant.platform !== envContext.platform) {
      return false;
    }

    // Module type filter - only apply if explicitly set
    if (process.env.MODULE_TYPE && variant.moduleType !== envContext.moduleType) {
      return false;
    }

    // Test type filter - only apply if explicitly set
    if (process.env.TEST_TYPE && variant.testType !== envContext.testType) {
      return false;
    }

    // Binary filter - only apply if explicitly set
    if (process.env.BINARY && variant.binary !== envContext.isBinary) {
      return false;
    }

    // Mac Universal mode - include both CJS and ESM for builder/forge binary tests
    if (envContext.isMacUniversal) {
      return ['builder', 'forge'].includes(variant.platform) && variant.binary;
    }

    return true;
  });
}

/**
 * Run a single test variant
 */
async function runTest(
  variant: TestVariant,
  buildManager: BuildManager,
  envContext: EnvironmentContext,
): Promise<TestResult> {
  const testName = getTestName(variant);
  const startTime = Date.now();

  console.log(`\n🚀 Starting test: ${testName}`);

  try {
    // Determine app directory
    const appDirName = variant.binary ? `${variant.platform}-${variant.moduleType}` : `no-binary-${variant.moduleType}`;

    const appPath = join(process.cwd(), '..', 'fixtures', 'e2e-apps', appDirName);

    // Ensure app is built
    const buildSuccess = await buildManager.ensureAppBuilt(appPath);
    if (!buildSuccess) {
      throw new Error(`Failed to build app: ${appPath}`);
    }

    // Create environment for test execution
    const testEnv = envContext.createChildEnvironment({
      PLATFORM: variant.platform,
      MODULE_TYPE: variant.moduleType,
      TEST_TYPE: variant.testType,
      BINARY: variant.binary ? 'true' : 'false',
      APP_DIR: appPath,
      EXAMPLE_DIR: appDirName,
    });

    // Enable splash screen for window tests
    if (variant.testType === 'window') {
      testEnv.ENABLE_SPLASH_WINDOW = 'true';
    }

    console.log(`  Environment: ${JSON.stringify(testEnv, null, 2)}`);

    // Run the test
    const result = await execWithEnv('pnpm wdio run wdio.conf.ts', testEnv, {
      cwd: process.cwd(),
      timeout: 300000, // 5 minutes
    });

    const duration = Date.now() - startTime;

    if (result.code === 0) {
      console.log(`✅ Test passed: ${testName} (${formatDuration(duration)})`);
      return {
        name: testName,
        success: true,
        duration,
      };
    } else {
      console.log(`❌ Test failed: ${testName} (${formatDuration(duration)})`);
      return {
        name: testName,
        success: false,
        duration,
        error: result.stderr || result.stdout || 'Unknown error',
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.log(`❌ Test error: ${testName} (${formatDuration(duration)})`);
    console.error(`  Error: ${errorMessage}`);

    return {
      name: testName,
      success: false,
      duration,
      error: errorMessage,
    };
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  const startTime = Date.now();

  try {
    // Parse environment and validate
    const envContext = createEnvironmentContext();
    console.log(`🎯 Test Environment: ${envContext.toString()}`);

    // Kill any leftover Electron processes
    await killElectronProcesses();

    // Set up build manager
    const buildManager = new BuildManager();

    // Set up concurrency
    const concurrency = envContext.concurrency;
    console.log(`🚀 Running tests with concurrency: ${concurrency}`);
    const limit = pLimit(concurrency);

    // Generate and filter test variants
    const allVariants = generateTestVariants();
    const filteredVariants = filterVariants(allVariants, envContext);

    console.log(`📊 Generated ${allVariants.length} possible test variants`);
    console.log(`📊 Filtered to ${filteredVariants.length} test variants for current environment`);

    if (filteredVariants.length === 0) {
      console.log('\n⚠️ WARNING: No test variants match the current environment!');
      console.log('Environment configuration:');
      console.log(`  PLATFORM: ${envContext.platform}`);
      console.log(`  MODULE_TYPE: ${envContext.moduleType}`);
      console.log(`  TEST_TYPE: ${envContext.testType}`);
      console.log(`  BINARY: ${envContext.isBinary}`);
      console.log(`  MAC_UNIVERSAL: ${envContext.isMacUniversal}`);

      console.error('\n❌ ERROR: Cannot continue without any test variants to run.');
      process.exit(1);
    }

    // Print test plan
    console.log('\n📋 Test Plan:');
    for (const variant of filteredVariants) {
      const testName = getTestName(variant);
      console.log(`  • ${testName}`);
    }
    console.log('═'.repeat(80));

    // Set up status tracking
    const statusBar = StatusBar.getInstance();
    const testNames = filteredVariants.map(getTestName);
    const statusTracker = new TestStatusTracker(testNames);

    // Initialize status bar
    statusBar.initialize();

    // Set up status updates
    const statusUpdateInterval = setInterval(() => {
      const status = statusTracker.getStatus();
      statusBar.updateStatus(status);
    }, 500);

    // Run all tests with controlled concurrency
    const results: TestResult[] = await Promise.all(
      filteredVariants.map((variant) =>
        limit(async () => {
          const testName = getTestName(variant);
          statusTracker.startTest(testName);

          const result = await runTest(variant, buildManager, envContext);

          statusTracker.completeTest(testName, result);
          return result;
        }),
      ),
    );

    // Clean up status updates
    if (statusUpdateInterval) {
      clearInterval(statusUpdateInterval);
    }

    // Print final summary
    statusBar.printFinalSummary(results, startTime);

    // Check if all tests passed
    const failed = results.filter((r) => !r.success && !r.skipped).length;
    const passed = results.filter((r) => r.success && !r.skipped).length;

    if (failed > 0) {
      console.error(`\n❌ ${failed} test(s) failed out of ${results.length}`);
      process.exit(1);
    } else {
      console.log(`\n✅ All ${passed} tests passed successfully!`);
    }
  } catch (error) {
    console.error(`\n❌ Error running tests: ${error}`);
    process.exit(1);
  } finally {
    // Cleanup
    await killElectronProcesses();
  }
}

/**
 * Parse command line arguments
 */
function parseCommandLineArgs(): void {
  const args = process.argv.slice(2);

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--debug') {
      process.env.WDIO_MATRIX_DEBUG = 'true';
      continue;
    }

    if (arg === '--verbose') {
      process.env.WDIO_VERBOSE = 'true';
      continue;
    }

    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      const [, key, value] = match;
      switch (key) {
        case 'platform':
        case 'platforms':
          process.env.PLATFORM = value;
          console.log(`Set PLATFORM=${value} from command line`);
          break;
        case 'module-type':
        case 'modules':
          process.env.MODULE_TYPE = value;
          console.log(`Set MODULE_TYPE=${value} from command line`);
          break;
        case 'test-type':
        case 'tests':
          process.env.TEST_TYPE = value;
          console.log(`Set TEST_TYPE=${value} from command line`);
          break;
        case 'binary':
          process.env.BINARY = value;
          console.log(`Set BINARY=${value} from command line`);
          break;
        case 'mac-universal':
          process.env.MAC_UNIVERSAL = value;
          console.log(`Set MAC_UNIVERSAL=${value} from command line`);
          break;
        case 'concurrency':
          process.env.CONCURRENCY = value;
          console.log(`Set CONCURRENCY=${value} from command line`);
          break;
        default:
          console.log(`Unknown argument: ${arg}`);
      }
    }
  }
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
🚀 WebdriverIO Electron Service E2E Test Matrix

USAGE:
  tsx scripts/run-matrix.ts [options]

FILTERING OPTIONS:
  --platform=<platform>     Run tests for specific platform(s): builder, forge, no-binary
  --module-type=<type>      Run tests for specific module type(s): cjs, esm  
  --test-type=<type>        Run tests for specific test type(s): standard, window, multiremote, standalone
  --binary=<true|false>     Run binary or no-binary tests
  --mac-universal=<true>    Run Mac Universal build tests (builder/forge only)

EXECUTION OPTIONS:
  --concurrency=<n>         Number of tests to run concurrently (default: 1)
  --debug                   Enable debug output
  --verbose                 Enable verbose WDIO output
  --help, -h               Show this help message

EXAMPLES:
  # Run full test matrix (all combinations)
  tsx scripts/run-matrix.ts

  # Run only builder tests  
  tsx scripts/run-matrix.ts --platform=builder

  # Run only ESM tests
  tsx scripts/run-matrix.ts --module-type=esm

  # Run only window tests for forge platform
  tsx scripts/run-matrix.ts --platform=forge --test-type=window

  # Run tests with higher concurrency
  tsx scripts/run-matrix.ts --concurrency=3

  # CI mode - run specific combination (set via environment)
  PLATFORM=builder MODULE_TYPE=cjs tsx scripts/run-matrix.ts

ENVIRONMENT VARIABLES:
  All command-line options can also be set via environment variables:
  PLATFORM, MODULE_TYPE, TEST_TYPE, BINARY, MAC_UNIVERSAL, CONCURRENCY
`);
}

// Main execution
async function main(): Promise<void> {
  console.log('🚀 WebdriverIO Electron Service E2E Test Matrix');
  console.log('Arguments:', process.argv.slice(2));

  // Parse command line arguments
  parseCommandLineArgs();

  // Run tests
  await runTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}
