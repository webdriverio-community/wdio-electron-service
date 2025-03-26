#!/usr/bin/env node

/**
 * Test Logs Monitor
 *
 * This script continuously monitors and displays test logs in real-time.
 * Run this in a separate terminal window to see detailed test output.
 *
 * Usage: tsx test-logs.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

// ANSI escape codes for terminal control
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

  clearScreen: '\x1b[2J',
  clearLine: '\x1b[2K',
  moveTo: (row: number, col: number): string => `\x1b[${row};${col}H`,
  moveUp: (n: number): string => `\x1b[${n}A`,
  moveDown: (n: number): string => `\x1b[${n}B`,
};

// Logs directory
const logsDir = path.join(process.cwd(), 'logs');

/**
 * Ensure the logs directory exists
 */
function ensureLogsDir(): void {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * Tail logs using the tail command
 */
function tailLogs(): void {
  console.log(`${ANSI.fg.cyan}${ANSI.bright}WebdriverIO Electron Service Test Logs Monitor${ANSI.reset}`);
  console.log(`${ANSI.dim}Monitoring logs in: ${logsDir}${ANSI.reset}`);
  console.log(`${ANSI.dim}Press Ctrl+C to exit${ANSI.reset}\n`);

  // Use the tail command to follow logs
  const tailProcess: ChildProcess = spawn('tail', ['-f', '-n', '+1', `${logsDir}/**/*.log`], {
    shell: true, // Use shell to expand the glob pattern
  });

  // Stream stdout in real-time with colorization
  tailProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString();

    // Add some color to the output
    const coloredOutput = output
      .replace(/✅|PASS/g, `${ANSI.fg.green}$&${ANSI.reset}`)
      .replace(/❌|FAIL|ERROR|Error/g, `${ANSI.fg.red}$&${ANSI.reset}`)
      .replace(/⏭️|SKIP/g, `${ANSI.fg.blue}$&${ANSI.reset}`)
      .replace(/🔄|Running/g, `${ANSI.fg.yellow}$&${ANSI.reset}`)
      .replace(/DEBUG|TRACE/g, `${ANSI.fg.magenta}$&${ANSI.reset}`)
      .replace(/INFO/g, `${ANSI.fg.cyan}$&${ANSI.reset}`);

    process.stdout.write(coloredOutput);
  });

  // Stream stderr in real-time
  tailProcess.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(data.toString());
  });

  // Handle process completion
  tailProcess.on('close', (code: number | null) => {
    if (code !== 0) {
      console.error(`${ANSI.fg.red}Tail process exited with code ${code}${ANSI.reset}`);
    }
  });

  // Handle process errors
  tailProcess.on('error', (error: Error) => {
    console.error(`${ANSI.fg.red}Error in tail process: ${error.message}${ANSI.reset}`);
  });

  // Handle signals to clean up
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
    process.on(signal, () => {
      console.log(`\n${ANSI.dim}Received ${signal}, exiting...${ANSI.reset}`);
      tailProcess.kill();
      process.exit(0);
    });
  });
}

/**
 * Main function
 */
function main(): void {
  ensureLogsDir();
  tailLogs();
}

// Run the main function
main();
