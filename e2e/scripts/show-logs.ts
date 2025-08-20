#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

/**
 * Cross-platform script to display E2E test logs
 * Works on Windows, macOS, and Linux
 */

const LOGS_DIR = './logs';

function showLogs(follow = false): void {
  // Check if logs directory exists
  if (!fs.existsSync(LOGS_DIR)) {
    console.log('No logs found');
    process.exit(0);
  }

  // Get all subdirectories in logs/
  const dirs = fs.readdirSync(LOGS_DIR, { withFileTypes: true }).filter((dirent) => dirent.isDirectory());

  if (dirs.length === 0) {
    console.log('No logs found');
    process.exit(0);
  }

  // Process each test run directory
  dirs.forEach((dir) => {
    const dirPath = path.join(LOGS_DIR, dir.name);

    // Get all log files in this directory
    const logs = fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith('.log'))
      .sort(); // Sort for consistent ordering

    if (logs.length === 0) {
      console.log(`=== ${dir.name} (no logs) ===\n`);
      return;
    }

    logs.forEach((logFile) => {
      const logPath = path.join(dirPath, logFile);
      const relativePath = path.join(dir.name, logFile);

      console.log(`=== ${relativePath} ===`);

      try {
        const content = fs.readFileSync(logPath, 'utf8');

        if (content.trim()) {
          console.log(content);
        } else {
          console.log('(empty log file)');
        }
      } catch (error) {
        console.log(`Error reading ${logFile}: ${error instanceof Error ? error.message : String(error)}`);
      }

      console.log(''); // Empty line separator
    });
  });

  // For follow mode (like tail -f), watch for file changes
  if (follow) {
    console.log('--- Watching for log changes (Ctrl+C to exit) ---');

    // Watch each existing log file
    dirs.forEach((dir) => {
      const dirPath = path.join(LOGS_DIR, dir.name);
      const logs = fs.readdirSync(dirPath).filter((file) => file.endsWith('.log'));

      logs.forEach((logFile) => {
        const logPath = path.join(dirPath, logFile);
        const relativePath = path.join(dir.name, logFile);

        let lastSize = fs.statSync(logPath).size;

        fs.watchFile(logPath, { interval: 1000 }, (curr, _prev) => {
          if (curr.size > lastSize) {
            // File has grown, read the new content
            const stream = fs.createReadStream(logPath, {
              start: lastSize,
              encoding: 'utf8',
            });

            console.log(`\n=== ${relativePath} (new content) ===`);
            stream.on('data', (chunk) => process.stdout.write(chunk));

            lastSize = curr.size;
          }
        });
      });
    });

    // Keep the process alive
    process.on('SIGINT', () => {
      console.log('\nStopping log watch...');
      process.exit(0);
    });
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const followMode = args.includes('--follow') || args.includes('-f');

showLogs(followMode);
