import { exec } from 'child_process';
import { promisify } from 'util';
import pLimit from 'p-limit';
import { setupTestSuite, cleanupTestSuite } from './suite-setup.js';
import { cleanupAllTempDirs } from '../setup/testAppsManager.js';

const execAsync = promisify(exec);

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

// Define test dimensions
const platforms = ['builder', 'forge', 'no-binary'];
const moduleTypes = ['cjs', 'esm'];
const testTypes = ['standard', 'window', 'multiremote', 'standalone'];

// Define variant type
interface TestVariant {
  platform: string;
  moduleType: string;
  testType: string;
  binary: boolean;
}

// Define test result type
interface TestResult {
  variant: TestVariant;
  success: boolean;
  duration: number;
  error?: any;
  errorSummary?: string;
  skipped?: boolean;
}

// Helper to convert env object to string
function envString(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
}

// Format duration in seconds
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Get a descriptive name for a test variant
function getTestName(variant: TestVariant): string {
  const { platform, moduleType, testType, binary } = variant;
  // Avoid duplicating 'no-binary' in the name when platform is already 'no-binary'
  const binarySuffix = !binary && platform !== 'no-binary' ? '-no-binary' : '';
  return `${platform}-${moduleType}-${testType}${binarySuffix}`;
}

// Generate all possible test variants
function generateTestVariants(): TestVariant[] {
  const variants: TestVariant[] = [];

  // Add binary tests for builder and forge
  for (const platform of platforms.filter((p) => p !== 'no-binary')) {
    for (const moduleType of moduleTypes) {
      for (const testType of testTypes) {
        variants.push({
          platform,
          moduleType,
          testType,
          binary: true,
        });
      }
    }
  }

  // Add no-binary tests
  for (const moduleType of moduleTypes) {
    for (const testType of testTypes) {
      variants.push({
        platform: 'no-binary',
        moduleType,
        testType,
        binary: false,
      });
    }
  }

  return variants;
}

// Filter variants based on environment variables
function filterVariants(variants: TestVariant[]): TestVariant[] {
  const platform = process.env.PLATFORM;
  const moduleType = process.env.MODULE_TYPE;
  const testType = process.env.TEST_TYPE;
  const binary = process.env.BINARY;

  return variants.filter((variant) => {
    if (platform && variant.platform !== platform) return false;
    if (moduleType && variant.moduleType !== moduleType) return false;
    if (testType && variant.testType !== testType) return false;
    if (binary !== undefined) {
      // Only filter by binary if it's explicitly set
      if (binary === 'true' && !variant.binary) return false;
      if (binary === 'false' && variant.binary) return false;
    }

    return true;
  });
}

// Run a single test variant
async function runTest(variant: TestVariant, index: number, total: number): Promise<TestResult> {
  const { platform, moduleType, testType, binary } = variant;
  const testName = getTestName(variant);

  console.log(`\n[${index + 1}/${total}] 🔄 Running test: ${testName}`);
  console.log('─'.repeat(80));

  const startTime = Date.now();
  let cmd = '';
  let errorSummary = '';
  let success = false;

  try {
    // Use environment variables set by suite-level setup
    const env: Record<string, string> = {
      PLATFORM: platform,
      MODULE_TYPE: moduleType,
      TEST_TYPE: testType,
      BINARY: binary ? 'true' : 'false',
      EXAMPLE_DIR:
        platform === 'no-binary'
          ? `no-binary-${moduleType}`
          : binary
            ? `${platform}-${moduleType}`
            : `no-binary-${moduleType}`,
      TS_NODE_TYPES: 'mocha',
      TEST: 'true',
    };

    // Add debug environment variable for all tests
    env.DEBUG = 'wdio*';

    if (testType === 'standalone') {
      cmd =
        !binary && platform === 'no-binary'
          ? `cross-env ${envString(env)} wdio run ./wdio.no-binary.standalone.ts`
          : `cross-env ${envString(env)} tsx ./test/standalone/api${binary ? '' : '.no-binary'}.spec.ts`;
    } else if (testType === 'window') {
      cmd =
        !binary && platform === 'no-binary'
          ? `cross-env ${envString(env)} ENABLE_SPLASH_WINDOW=true wdio run ./wdio.no-binary.conf.ts --spec ./test/window/window.spec.ts`
          : `cross-env ${envString(env)} ENABLE_SPLASH_WINDOW=true wdio run ./wdio.conf.ts --spec ./test/window/window.spec.ts`;
    } else if (testType === 'multiremote') {
      cmd =
        !binary && platform === 'no-binary'
          ? `cross-env ${envString(env)} ENABLE_SPLASH_WINDOW=true wdio run ./wdio.no-binary.multiremote.conf.ts`
          : `cross-env ${envString(env)} wdio run ./wdio.multiremote.conf.ts --spec ./test/multiremote/api.spec.ts`;
    } else {
      // For standard tests, run each spec file individually
      const specFiles =
        platform === 'no-binary'
          ? ['./test/api.spec.ts']
          : ['./test/api.spec.ts', './test/application.spec.ts', './test/dom.spec.ts', './test/interaction.spec.ts'];

      let allPassed = true;

      for (const specFile of specFiles) {
        const configFile = !binary && platform === 'no-binary' ? './wdio.no-binary.conf.ts' : './wdio.conf.ts';
        const standardEnv = { ...env };
        if (!binary && platform === 'no-binary') {
          standardEnv.ENABLE_SPLASH_WINDOW = 'true';
        }

        cmd = `cross-env ${envString(standardEnv)} wdio run ${configFile} --spec ${specFile}`;
        console.log(`Executing: ${cmd}`);

        try {
          const { stdout } = await execAsync(cmd);
          console.log(stdout);

          const specPassed = stdout.includes('PASSED in chrome') || /\d+ passing/.test(stdout);
          if (!specPassed) {
            console.error(`❌ Spec file ${specFile} failed`);
            errorSummary = `Spec file ${specFile} failed`;
            allPassed = false;
            break;
          }
        } catch (error: any) {
          console.error(`Error executing command: ${error.message}`);
          errorSummary = `Error executing command: ${error.message}`;
          allPassed = false;
          break;
        } finally {
          // Kill any remaining Electron processes after each spec
          await killElectronProcesses();
        }
      }

      success = allPassed;
      return {
        variant,
        success,
        duration: Date.now() - startTime,
        errorSummary,
      };
    }

    console.log(`Executing: ${cmd}`);
    const { stdout } = await execAsync(cmd);
    console.log(stdout);

    success = !stdout.includes('FAILED') && !stdout.includes('0 passed');
    if (!success) {
      errorSummary = stdout.includes('FAILED') ? `Test failed: ${testName}` : 'Test completed but no tests passed';
    }

    return {
      variant,
      success,
      duration: Date.now() - startTime,
      errorSummary,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`Error executing command: ${error.message}`);
    errorSummary = `Error executing command: ${error.message}`;

    return {
      variant,
      success: false,
      duration,
      error,
      errorSummary,
    };
  } finally {
    // Kill any remaining Electron processes after each test
    await killElectronProcesses();
  }
}

// Run tests with controlled concurrency
async function runTests() {
  console.log('\n🧪 WebdriverIO Electron Service Test Matrix Runner 🧪');
  console.log('═'.repeat(80));

  // Generate all possible test variants
  const variants = generateTestVariants();

  // Filter variants based on environment variables
  const filteredVariants = filterVariants(variants);

  // Set concurrency based on environment variables or defaults
  const concurrency = process.env.CONCURRENCY ? parseInt(process.env.CONCURRENCY, 10) : 1;
  console.log(`\n🚀 Running tests with concurrency: ${concurrency}`);

  // Create a limit function to control concurrency
  const limit = pLimit(concurrency);

  // Sort variants to optimize test execution
  filteredVariants.sort((a, b) => {
    // Run window tests first as they're usually faster
    if (a.testType === 'window' && b.testType !== 'window') return -1;
    if (a.testType !== 'window' && b.testType === 'window') return 1;

    // Run standalone tests last as they're usually slower
    if (a.testType === 'standalone' && b.testType !== 'standalone') return 1;
    if (a.testType !== 'standalone' && b.testType === 'standalone') return -1;

    // Non-binary tests are usually faster
    if (!a.binary && b.binary) return -1;
    if (a.binary && !b.binary) return 1;

    return 0;
  });

  console.log(`\n🧪 Running ${filteredVariants.length} test variants`);
  console.log('═'.repeat(80));

  // Print test plan
  console.log('\n📋 Test Plan:');
  for (const variant of filteredVariants) {
    console.log(`  • ${getTestName(variant)}`);
  }
  console.log('═'.repeat(80));

  try {
    // Clean up any leftover temporary directories from previous runs
    console.log('🧹 Cleaning up any leftover temporary directories...');
    await cleanupAllTempDirs();

    // Kill any existing Electron processes before starting
    await killElectronProcesses();

    // Perform suite-level setup before running any tests
    await setupTestSuite();

    // Run all tests with controlled concurrency
    const results: TestResult[] = await Promise.all(
      filteredVariants.map((variant, index) => limit(() => runTest(variant, index, filteredVariants.length))),
    );

    // Print summary table
    console.log('\n📊 Test Results Summary');
    console.log('═'.repeat(120));

    // Print table header
    console.log('| Status | Test                                | Duration | Error Summary');
    console.log('|' + '─'.repeat(118) + '|');

    // Sort results: first failures, then passes, then skipped
    const sortedResults = [...results].sort((a, b) => {
      if (a.skipped && !b.skipped) return 1;
      if (!a.skipped && b.skipped) return -1;
      if (!a.success && b.success) return -1;
      if (a.success && !b.success) return 1;
      return 0;
    });

    // Print each result
    for (const result of sortedResults) {
      const status = result.skipped ? '⏭️ SKIP' : result.success ? '✅ PASS' : '❌ FAIL';
      const testName = getTestName(result.variant);
      const duration = formatDuration(result.duration);
      const errorSummary = result.errorSummary || '';

      // Truncate error summary if it's too long
      const truncatedError = errorSummary.length > 60 ? errorSummary.substring(0, 60) + '...' : errorSummary;

      console.log(`| ${status} | ${testName.padEnd(36)} | ${duration.padEnd(7)} | ${truncatedError}`);
    }

    console.log('═'.repeat(120));

    // Print statistics
    const passed = results.filter((r) => r.success && !r.skipped).length;
    const failed = results.filter((r) => !r.success).length;
    const skipped = results.filter((r) => r.skipped).length;
    const total = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`📈 Statistics: ${passed} passed, ${failed} failed, ${skipped} skipped, ${total} total`);
    console.log(`⏱️  Total duration: ${formatDuration(totalDuration)}`);

    // Check if all tests passed
    if (failed > 0) {
      console.error(`\n❌ ${failed} tests failed`);
      process.exit(1);
    } else {
      console.log(`\n✅ All ${total} tests passed successfully!`);
    }
  } catch (error) {
    console.error(`\n❌ Error running tests: ${error}`);
    process.exit(1);
  } finally {
    // Make sure to kill any remaining Electron processes
    await killElectronProcesses();

    // Perform suite-level cleanup after all tests have completed
    await cleanupTestSuite();

    // Clean up any remaining temporary directories
    console.log('🧹 Final cleanup of any remaining temporary directories...');
    await cleanupAllTempDirs();

    // Kill any remaining processes one last time
    await killElectronProcesses();
  }
}

// Run the tests
runTests().catch((error) => {
  console.error('❌ Error running tests:', error);
  // Ensure cleanup happens even on unexpected errors
  Promise.all([
    cleanupTestSuite().catch((cleanupError) => {
      console.error('❌ Error during suite cleanup:', cleanupError);
    }),
    cleanupAllTempDirs().catch((cleanupError) => {
      console.error('❌ Error during temp directory cleanup:', cleanupError);
    }),
  ]).finally(() => {
    process.exit(1);
  });
});
