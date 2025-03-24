import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import pLimit from 'p-limit';
import { setupTestSuite, cleanupTestSuite } from './suite-setup.js';
import { cleanupAllTempDirs } from '../setup/testAppsManager.js';
import * as fs from 'fs';
import { join } from 'path';

/**
 * TEMPORARY MODIFICATION: Multiremote tests have been disabled.
 * To re-enable, uncomment the original testTypes array that includes 'multiremote'.
 * See line ~133 where testTypes is defined.
 */

// Keep the promisified exec for simple commands
const execAsync = promisify(exec);

// Debug flag to track execution flow
const DEBUG = process.env.WDIO_MATRIX_DEBUG === 'true';

// Helper to print debug messages
function debug(message: string): void {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`);
  }
}

/**
 * ANSI escape codes for terminal control
 */
const ANSI = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  },

  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
  },

  // Cursor control
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',
  clearScreen: '\x1b[2J',
  clearLine: '\x1b[2K',
  moveTo: (row: number, col: number) => `\x1b[${row};${col}H`,
  moveUp: (n: number) => `\x1b[${n}A`,
  moveDown: (n: number) => `\x1b[${n}B`,

  // Hide/show cursor
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

/**
 * Terminal status bar manager
 */
class StatusBar {
  private static instance: StatusBar;
  private isEnabled = process.stdout.isTTY;
  private isInitialized = false;
  private lastUpdateTime = 0;
  private updateInterval = 500; // Update every 500ms

  private constructor() {}

  static getInstance(): StatusBar {
    if (!StatusBar.instance) {
      StatusBar.instance = new StatusBar();
    }
    return StatusBar.instance;
  }

  /**
   * Initialize the status bar
   */
  initialize(): void {
    if (!this.isEnabled || this.isInitialized) return;

    // Hide the cursor
    process.stdout.write(ANSI.hideCursor);

    // Clear the screen
    process.stdout.write(ANSI.clearScreen);

    this.isInitialized = true;

    // Ensure cursor is shown on exit
    process.on('exit', () => {
      if (this.isEnabled) {
        process.stdout.write(ANSI.showCursor);
      }
    });

    // Handle signals to restore terminal state
    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
      process.on(signal, () => {
        if (this.isEnabled) {
          process.stdout.write(ANSI.showCursor);
        }
        process.exit(0);
      });
    });
  }

  /**
   * Update the status bar with current test status
   */
  updateStatus(status: {
    total: number;
    completed: number;
    passed: number;
    failed: number;
    skipped: number;
    inProgress: string[];
    startTime: number;
  }): void {
    if (!this.isEnabled || !this.isInitialized) return;

    // Throttle updates to avoid flickering
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateInterval) {
      return;
    }
    this.lastUpdateTime = now;

    // Clear the screen
    process.stdout.write(ANSI.clearScreen);
    process.stdout.write(ANSI.moveTo(1, 1));

    // Draw the status display
    this.drawStatusDisplay(status);
  }

  /**
   * Draw the full status display
   */
  private drawStatusDisplay(status: {
    total: number;
    completed: number;
    passed: number;
    failed: number;
    skipped: number;
    inProgress: string[];
    startTime: number;
  }): void {
    const { total, completed, passed, failed, skipped, inProgress, startTime } = status;

    // Clear the screen and move to the top
    process.stdout.write(ANSI.clearScreen);
    process.stdout.write(ANSI.moveTo(1, 1));

    // Title
    console.log(`${ANSI.fg.cyan}${ANSI.bright}📊 WebdriverIO Electron Service Test Status${ANSI.reset}`);
    console.log('═'.repeat(80));

    // Progress bar
    const progressBar = this.createProgressBar(completed, total, 50);
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    console.log(`${ANSI.fg.yellow}Progress: [${progressBar}] ${percentage}%${ANSI.reset}`);

    // Elapsed time
    const elapsed = formatDuration(Date.now() - startTime);
    console.log(`${ANSI.fg.magenta}Elapsed time: ${elapsed}${ANSI.reset}`);

    // Statistics
    console.log(
      `${ANSI.fg.green}✅ ${passed} passed${ANSI.reset} | ${ANSI.fg.red}❌ ${failed} failed${ANSI.reset} | ${ANSI.fg.blue}⏭️  ${skipped} skipped${ANSI.reset} | ${ANSI.fg.yellow}🔄 ${inProgress.length} in progress${ANSI.reset}`,
    );
    console.log('─'.repeat(80));

    // Currently running tests
    if (inProgress.length > 0) {
      console.log(`${ANSI.fg.cyan}${ANSI.bright}🔄 Currently running:${ANSI.reset}`);
      inProgress.forEach((test) => console.log(`  • ${test}`));
    } else {
      console.log(`${ANSI.fg.cyan}${ANSI.bright}🔄 Currently running: ${ANSI.reset}No tests currently running`);
    }

    console.log('─'.repeat(80));

    // Last updated timestamp
    const now = new Date();
    console.log(`${ANSI.dim}Last updated: ${now.toLocaleTimeString()}${ANSI.reset}`);

    // Instructions
    console.log(`\n${ANSI.dim}Run 'pnpm run logs' in another terminal to see detailed logs${ANSI.reset}`);
    console.log(`${ANSI.dim}Press Ctrl+C to stop the tests${ANSI.reset}`);
  }

  /**
   * Create a progress bar string
   */
  private createProgressBar(current: number, total: number, width: number): string {
    if (total === 0) return '░'.repeat(width);

    const filledWidth = Math.round((width * current) / total);
    const emptyWidth = width - filledWidth;

    return '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);
  }

  /**
   * Clean up the status bar and restore terminal state
   */
  cleanup(): void {
    if (!this.isEnabled || !this.isInitialized) return;

    // Clear the status display
    process.stdout.write('\x1Bc'); // Clear the screen
    process.stdout.write('\x1b[?25h'); // Show cursor
    this.isInitialized = false;
  }
}

// Get the status bar instance
const statusBar = StatusBar.getInstance();

/**
 * Global test status tracking
 */
const testStatus = {
  total: 0,
  completed: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  inProgress: new Set<string>(),
  results: new Map<string, TestResult>(),
  startTime: 0,

  /**
   * Print current test status
   */
  printStatus(): void {
    // Update the status bar
    statusBar.updateStatus({
      total: this.total,
      completed: this.completed,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      inProgress: Array.from(this.inProgress),
      startTime: this.startTime,
    });
  },

  /**
   * Update test status when a test starts
   */
  startTest(testName: string): void {
    this.inProgress.add(testName);
    this.printStatus();
  },

  /**
   * Update test status when a test completes
   */
  completeTest(testName: string, result: TestResult): void {
    this.inProgress.delete(testName);
    this.completed++;
    this.results.set(testName, result);

    if (result.skipped) {
      this.skipped++;
    } else if (result.success) {
      this.passed++;
    } else {
      this.failed++;
    }

    this.printStatus();
  },

  /**
   * Initialize test status
   */
  initialize(totalTests: number): void {
    this.total = totalTests;
    this.completed = 0;
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.inProgress = new Set<string>();
    this.results = new Map<string, TestResult>();
    this.startTime = Date.now();

    // Initialize the status bar
    statusBar.initialize();

    this.printStatus();
  },
};

/**
 * Execute a command with debug output
 * @param cmd Command to execute
 * @param env Environment variables
 * @returns Promise with stdout, stderr, and exit code
 */
async function execWithDebug(
  cmd: string,
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    // Check if running from test:all script
    const isRunningFromTestAll = process.env.SUITE_SETUP_DONE === 'true';

    // Only log debug info if not running from test:all
    if (!isRunningFromTestAll) {
      console.log(`🔍 DEBUG: Executing command: ${cmd}`);
    }

    // Split the command into parts for spawn
    const parts = cmd.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    // Merge environment variables
    const mergedEnv = { ...process.env, ...env };

    // Only log debug info if not running from test:all
    if (!isRunningFromTestAll) {
      console.log(`🔍 DEBUG: Spawning process: ${command} ${args.join(' ')}`);
    }

    const childProcess = spawn(command, args, {
      env: mergedEnv,
      shell: true, // Use shell to handle complex commands
      stdio: 'pipe', // Capture stdout and stderr
    });

    let stdout = '';
    let stderr = '';

    // Capture stdout
    childProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;

      // Display output in real-time for better debugging
      if (process.env.WDIO_VERBOSE === 'true') {
        process.stdout.write(chunk);
      }
    });

    // Capture stderr
    childProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;

      // Always display errors in real-time
      process.stderr.write(chunk);
    });

    // Handle process completion
    childProcess.on('close', (code) => {
      // Only log debug info if not running from test:all
      if (!isRunningFromTestAll) {
        console.log(`🔍 DEBUG: Process exited with code: ${code}`);
      }

      resolve({ stdout, stderr, code: code || 0 });
    });

    // Handle process errors
    childProcess.on('error', (error) => {
      // Always log errors
      console.error(`❌ ERROR: Failed to execute command: ${error.message}`);
      reject(error);
    });
  });
}

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
// Re-enable multiremote tests
const testTypes = ['standard', 'window', 'standalone', 'multiremote'];

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
  // Helper function to check if a value matches, accounting for wildcards
  const matches = (envValue: string | undefined, variantValue: string): boolean => {
    if (!envValue) return true; // No filter specified
    if (envValue === '*') return true; // Wildcard matches everything
    return envValue === variantValue; // Exact match check
  };

  // Check if we're running in Mac Universal mode
  const isMacUniversal = process.env.MAC_UNIVERSAL === 'true';
  if (isMacUniversal) {
    console.log('🍎 Running in Mac Universal mode - filtering to only include compatible test variants');
    // In Mac Universal mode, only include builder and forge platforms
    return variants.filter(
      (variant) =>
        ['builder', 'forge'].includes(variant.platform) &&
        // Ensure we only include binary tests for Mac Universal
        variant.binary === true,
    );
  }

  return variants.filter((variant) => {
    // Filter by platform
    if (!matches(process.env.PLATFORM, variant.platform)) return false;

    // Filter by module type
    if (!matches(process.env.MODULE_TYPE, variant.moduleType)) return false;

    // Filter by test type
    if (!matches(process.env.TEST_TYPE, variant.testType)) return false;

    // Filter by binary
    if (process.env.BINARY && process.env.BINARY !== '*') {
      if (process.env.BINARY === 'true' && !variant.binary) return false;
      if (process.env.BINARY === 'false' && variant.binary) return false;
    }

    // Exclude multiremote tests if requested
    if (process.env.EXCLUDE_MULTIREMOTE === 'true') {
      if (variant.testType === 'multiremote') return false;
    }

    return true;
  });
}

// Run a single test variant
async function runTest(variant: TestVariant, _index: number, _total: number): Promise<TestResult> {
  const { platform, moduleType, testType, binary } = variant;
  const testName = getTestName(variant);

  console.log(`\n==================================================`);
  console.log(`🚀 STARTING TEST: ${testName}`);
  console.log(`==================================================`);
  console.log(`Platform: ${platform}, ModuleType: ${moduleType}, TestType: ${testType}, Binary: ${binary}`);
  console.log(`Working directory: ${process.cwd()}`);

  // Update test status
  testStatus.startTest(testName);

  const startTime = Date.now();
  let success = false;
  let error: any = null;
  let errorSummary = '';
  let skipped = false;

  try {
    // Set up environment variables for test execution
    const env: Record<string, string> = {
      PLATFORM: platform,
      MODULE_TYPE: moduleType,
      TEST_TYPE: testType,
      BINARY: binary ? 'true' : 'false',
      EXAMPLE_DIR: binary ? `${platform}-${moduleType}` : `no-binary-${moduleType}`,
    };

    // Set WDIO_CHALK_COMPAT=true for standalone tests
    if (testType === 'standalone') {
      env.WDIO_CHALK_COMPAT = 'true';
      console.log(`✅ Set WDIO_CHALK_COMPAT=true for standalone test`);
    }

    // Always pass test app preparation variables from parent process
    if (process.env.WDIO_TEST_APPS_DIR) {
      env.WDIO_TEST_APPS_PREPARED = 'true';
      env.WDIO_TEST_APPS_DIR = process.env.WDIO_TEST_APPS_DIR;
    }

    // Enable splash screen for window tests
    if (testType === 'window') {
      env.ENABLE_SPLASH_WINDOW = 'true';
    }

    // Log debug info
    console.log(`Debug info for test ${testName}:`);
    console.log(`- Test working directory: ${process.cwd()}`);
    console.log(`- Using run-single-test.ts at: ${join(process.cwd(), 'scripts', 'run-single-test.ts')}`);

    // Check if run-single-test.ts exists
    const runSingleTestPath = join(process.cwd(), 'scripts', 'run-single-test.ts');
    if (fs.existsSync(runSingleTestPath)) {
      console.log(`✅ run-single-test.ts exists at ${runSingleTestPath}`);
    } else {
      console.error(`❌ ERROR: run-single-test.ts does not exist at ${runSingleTestPath}`);
      throw new Error(`run-single-test.ts not found at ${runSingleTestPath}`);
    }

    // Log command to be executed
    const commandToRun = 'pnpm run test:single';
    console.log(`Running command: ${commandToRun}`);
    console.log(`Environment variables: ${JSON.stringify(env, null, 2)}`);

    // Run the test
    const { code, stderr, stdout } = await execWithDebug('pnpm run test:single', env);

    // Log execution output
    console.log(`Command execution completed with exit code: ${code}`);
    console.log(`Output length: stdout=${stdout.length}, stderr=${stderr.length}`);

    // Check for success
    success = code === 0;
    if (!success) {
      error = new Error(`Test failed with exit code: ${code}`);
      errorSummary = stderr.split('\n').slice(-10).join('\n');

      console.error(`❌ Test failed with exit code: ${code}`);
      console.error(`Last 10 lines of stderr:\n${errorSummary}`);
    } else {
      console.log(`✅ Test passed successfully with exit code: ${code}`);
    }
  } catch (err) {
    success = false;
    error = err;
    errorSummary = err instanceof Error ? err.message : String(err);

    console.error(`❌ Error executing test: ${errorSummary}`);
  }

  const duration = Date.now() - startTime;
  console.log(`Test duration: ${formatDuration(duration)}`);

  // Update test status
  testStatus.completeTest(testName, {
    variant,
    success,
    duration,
    error,
    errorSummary,
    skipped,
  });

  console.log(`==================================================`);
  console.log(`🏁 COMPLETED TEST: ${testName} - ${success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`==================================================\n`);

  return {
    variant,
    success,
    duration,
    error,
    errorSummary,
    skipped,
  };
}

/**
 * Run all tests based on environment variables
 */
async function runTests(): Promise<void> {
  debug('Starting runTests function');
  let statusUpdateInterval: NodeJS.Timeout | null = null;

  try {
    // Parse command line arguments to get timeout
    const args = process.argv.slice(2);
    const noTimeoutFlag = args.includes('--no-timeout');
    const timeoutArg = args.find((arg) => arg.startsWith('--timeout='));
    const timeout = noTimeoutFlag ? 0 : timeoutArg ? parseInt(timeoutArg.split('=')[1], 10) : 60000;

    debug(`Using timeout: ${timeout}ms, noTimeoutFlag: ${noTimeoutFlag}`);

    // Ensure we have access to the kill process function
    await killElectronProcesses();

    // Get all concurrency info
    const concurrencyArg = args.find((arg) => arg.startsWith('--concurrency='));
    const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 1;
    console.log(`\n🚀 Running tests with concurrency: ${concurrency}`);
    const limit = pLimit(concurrency);

    // Generate test variants
    const allVariants = generateTestVariants();
    debug(`Generated ${allVariants.length} test variants`);

    // Filter based on environment variables
    const filteredVariants = filterVariants(allVariants);
    debug(`Filtered to ${filteredVariants.length} test variants`);

    console.log(`\n🧪 Running ${filteredVariants.length} test variants`);
    console.log('═'.repeat(80));

    // Print test plan
    console.log('\n📋 Test Plan:');
    for (const variant of filteredVariants) {
      const testName = getTestName(variant);
      console.log(`  • ${testName}`);
    }
    if (filteredVariants.length === 0) {
      console.log('\n⚠️ WARNING: No test variants match the current filters!');
      console.log('Check your environment variables:');
      console.log(`  PLATFORM: ${process.env.PLATFORM || 'not set'}`);
      console.log(`  MODULE_TYPE: ${process.env.MODULE_TYPE || 'not set'}`);
      console.log(`  TEST_TYPE: ${process.env.TEST_TYPE || 'not set'}`);
      console.log(`  BINARY: ${process.env.BINARY || 'not set'}`);
      if (process.env.MAC_UNIVERSAL === 'true') {
        console.log(`  MAC_UNIVERSAL: true - only builder and forge binary tests are included`);
      }
    }
    console.log('═'.repeat(80));

    // Initialize test status
    testStatus.initialize(filteredVariants.length);

    // Check if we need to do suite-level setup
    const testAppsPrepared = process.env.WDIO_TEST_APPS_PREPARED === 'true';
    debug(`Test apps prepared flag: ${testAppsPrepared}`);

    if (!testAppsPrepared) {
      debug('Performing suite-level setup');
      // Perform suite-level setup
      await setupTestSuite();
      debug('Suite setup complete');
    } else {
      debug('Skipping suite setup - apps already prepared');
      console.log('ℹ️ Test apps already prepared, skipping setup...');
    }

    // We'll continue for previously prepared temp directories
    process.env.SUITE_CLEANUP_MANAGED = 'true';

    // Set up a regular status update interval
    statusUpdateInterval = setInterval(() => {
      // This is a no-op if not in interactive mode
      testStatus.printStatus();
    }, 500);

    // Run all tests with controlled concurrency
    const results: TestResult[] = await Promise.all(
      filteredVariants.map((variant, index) => limit(() => runTest(variant, index, filteredVariants.length))),
    );

    // Clean up the status bar before printing the final results
    if (statusUpdateInterval) {
      clearInterval(statusUpdateInterval);
    }
    statusBar.cleanup();

    // Print summary table
    console.log('\n📊 Final Test Results Summary');
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
    const failed = results.filter((r) => !r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const total = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`📈 Statistics: ${passed} passed, ${failed} failed, ${skipped} skipped, ${total} total`);
    console.log(`⏱️  Total duration: ${formatDuration(totalDuration)}`);

    // Print detailed failure information if there are failures
    if (failed > 0) {
      console.log('\n❌ Failed Tests Details:');
      console.log('═'.repeat(120));

      const failedTests = results.filter((r) => !r.success && !r.skipped);
      for (let i = 0; i < failedTests.length; i++) {
        const result = failedTests[i];
        const testName = getTestName(result.variant);

        console.log(`\n${i + 1}. ${testName}`);
        console.log('─'.repeat(80));
        console.log(`Error Summary: ${result.errorSummary || 'No error summary available'}`);
        console.log(`Duration: ${formatDuration(result.duration)}`);
        console.log(`Variant: ${JSON.stringify(result.variant)}`);
      }

      console.log('\n❌ Failed Tests Summary:');
      for (let i = 0; i < failedTests.length; i++) {
        const result = failedTests[i];
        const testName = getTestName(result.variant);
        console.log(`${i + 1}. ${testName}`);
      }
    }

    // Check if all tests passed
    if (failed > 0) {
      console.error(`\n❌ ${failed} tests failed`);
      process.exit(1);
    } else {
      console.log(`\n✅ All ${total} tests passed successfully!`);
    }
  } catch (error) {
    // Clean up the status bar on error
    if (statusUpdateInterval) {
      clearInterval(statusUpdateInterval);
    }
    statusBar.cleanup();
    console.error(`\n❌ Error running tests: ${error}`);
    process.exit(1);
  } finally {
    // Make sure to kill any remaining Electron processes
    await killElectronProcesses();

    // We set PRESERVE_TEMP_DIR to true, so temp directories will be preserved
    // for the next run
    process.env.SUITE_CLEANUP_MANAGED = 'true';
    console.log('ℹ️ Preserving test directories for reuse in subsequent runs');
  }
}

// Run the tests
runTests().catch((error) => {
  console.error('❌ Error running tests:', error);
  // Ensure cleanup happens even on unexpected errors
  Promise.all([
    cleanupTestSuite().catch((cleanupError: Error) => {
      console.error('❌ Error during suite cleanup:', cleanupError);
    }),
    cleanupAllTempDirs().catch((cleanupError: Error) => {
      console.error('❌ Error during temp directory cleanup:', cleanupError);
    }),
  ]).finally(() => {
    process.exit(1);
  });
});
