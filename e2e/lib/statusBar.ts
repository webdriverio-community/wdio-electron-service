import { formatDuration } from './utils.js';

/**
 * ANSI escape codes for terminal control
 */
const ANSI = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

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

  // Cursor control
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',
  clearScreen: '\x1b[2J',
  clearLine: '\x1b[2K',
  moveTo: (row: number, col: number) => `\x1b[${row};${col}H`,

  // Hide/show cursor
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

/**
 * Test status information
 */
export interface TestStatus {
  total: number;
  completed: number;
  passed: number;
  failed: number;
  skipped: number;
  inProgress: string[];
  startTime: number;
}

/**
 * Test result for individual test
 */
export interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  skipped?: boolean;
}

/**
 * Terminal status bar manager with real-time updates
 */
export class StatusBar {
  private static instance: StatusBar;
  private isEnabled = process.stdout.isTTY;
  private isInitialized = false;
  private lastUpdateTime = 0;
  private updateInterval = 500; // Update every 500ms
  private cleanupRegistered = false;

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

    // Register cleanup handlers
    if (!this.cleanupRegistered) {
      this.registerCleanupHandlers();
      this.cleanupRegistered = true;
    }
  }

  /**
   * Register cleanup handlers to restore terminal state
   */
  private registerCleanupHandlers(): void {
    const cleanup = () => {
      if (this.isEnabled) {
        process.stdout.write(ANSI.showCursor);
      }
    };

    // Handle normal exit
    process.on('exit', cleanup);

    // Handle signals with proper exit codes
    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
      process.on(signal, () => {
        cleanup();
        process.exit(process.exitCode || (signal === 'SIGINT' ? 130 : 1));
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      cleanup();
      console.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      cleanup();
      console.error('Unhandled rejection:', reason);
      process.exit(1);
    });
  }

  /**
   * Update the status bar with current test status
   */
  updateStatus(status: TestStatus): void {
    if (!this.isEnabled || !this.isInitialized) return;

    // Throttle updates to avoid flickering
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateInterval) {
      return;
    }
    this.lastUpdateTime = now;

    // Clear the screen and move to top
    process.stdout.write(ANSI.clearScreen);
    process.stdout.write(ANSI.moveTo(1, 1));

    // Draw the status display
    this.drawStatusDisplay(status);
  }

  /**
   * Draw the full status display
   */
  private drawStatusDisplay(status: TestStatus): void {
    const { total, completed, passed, failed, skipped, inProgress, startTime } = status;

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
      inProgress.forEach((test) => {
        console.log(`  • ${test}`);
      });
    } else {
      console.log(`${ANSI.fg.cyan}${ANSI.bright}🔄 Currently running: ${ANSI.reset}No tests currently running`);
    }

    console.log(''); // Empty line for spacing
  }

  /**
   * Create a progress bar string
   */
  private createProgressBar(current: number, total: number, width: number): string {
    if (total === 0) return '─'.repeat(width);

    const progress = Math.round((current / total) * width);
    const completed = '█'.repeat(progress);
    const remaining = '─'.repeat(width - progress);

    return completed + remaining;
  }

  /**
   * Print final results summary
   */
  printFinalSummary(results: TestResult[], startTime: number): void {
    if (this.isEnabled && this.isInitialized) {
      // Clear the dynamic status display
      this.cleanup();
    }

    const totalDuration = Date.now() - startTime;
    const passed = results.filter((r) => r.success && !r.skipped).length;
    const failed = results.filter((r) => !r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;

    console.log('\n📊 Final Test Results Summary');
    console.log('═'.repeat(120));

    // Print table header
    console.log('| Status | Test                                | Duration | Error Summary');
    console.log(`|${'─'.repeat(118)}|`);

    // Sort results: failures first, then passes, then skipped
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
      const duration = formatDuration(result.duration);
      const error = result.error ? `${result.error.slice(0, 50)}...` : '';

      const testName = result.name.padEnd(35).slice(0, 35);
      const durationStr = duration.padEnd(8);
      const errorStr = error.padEnd(50);

      console.log(`| ${status} | ${testName} | ${durationStr} | ${errorStr} |`);
    }

    console.log('═'.repeat(120));

    // Summary
    const totalTime = formatDuration(totalDuration);
    console.log(`\n🎯 Summary: ${passed} passed, ${failed} failed, ${skipped} skipped in ${totalTime}`);

    if (failed > 0) {
      console.log(`\n❌ ${failed} test(s) failed:`);
      results
        .filter((r) => !r.success && !r.skipped)
        .forEach((result) => {
          console.log(`  • ${result.name}: ${result.error || 'Unknown error'}`);
        });
    }

    if (passed === results.length - skipped) {
      console.log(`\n🎉 All ${passed} tests passed successfully!`);
    }
  }

  /**
   * Clean up the status bar
   */
  cleanup(): void {
    if (!this.isEnabled || !this.isInitialized) return;

    // Show cursor
    process.stdout.write(ANSI.showCursor);

    // Clear screen and move to top
    process.stdout.write(ANSI.clearScreen);
    process.stdout.write(ANSI.moveTo(1, 1));

    this.isInitialized = false;
  }
}

/**
 * Test status tracker
 */
export class TestStatusTracker {
  private tests = new Map<
    string,
    {
      status: 'pending' | 'running' | 'completed' | 'skipped';
      result?: TestResult;
    }
  >();
  private startTime = Date.now();

  constructor(testNames: string[]) {
    // Initialize all tests as pending
    testNames.forEach((name) => {
      this.tests.set(name, { status: 'pending' });
    });
  }

  /**
   * Mark a test as started
   */
  startTest(name: string): void {
    const test = this.tests.get(name);
    if (test) {
      test.status = 'running';
    }
  }

  /**
   * Mark a test as completed
   */
  completeTest(name: string, result: TestResult): void {
    const test = this.tests.get(name);
    if (test) {
      test.status = result.skipped ? 'skipped' : 'completed';
      test.result = result;
    }
  }

  /**
   * Get current status
   */
  getStatus(): TestStatus {
    const total = this.tests.size;
    let completed = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const inProgress: string[] = [];

    this.tests.forEach((test, name) => {
      if (test.status === 'completed' || test.status === 'skipped') {
        completed++;
        if (test.result) {
          if (test.result.skipped) {
            skipped++;
          } else if (test.result.success) {
            passed++;
          } else {
            failed++;
          }
        }
      } else if (test.status === 'running') {
        inProgress.push(name);
      }
    });

    return {
      total,
      completed,
      passed,
      failed,
      skipped,
      inProgress,
      startTime: this.startTime,
    };
  }

  /**
   * Get all results
   */
  getResults(): TestResult[] {
    const results: TestResult[] = [];
    this.tests.forEach((test) => {
      if (test.result) {
        results.push(test.result);
      }
    });
    return results;
  }
}
