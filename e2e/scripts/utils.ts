import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

/**
 * Execute a command with environment variables and capture output
 */
export async function execWithEnv(
  command: string,
  env: Record<string, string> = {},
  options: { cwd?: string; timeout?: number } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const { cwd = process.cwd(), timeout = 120000 } = options;

    // For Linux and WDIO commands, wrap with xvfb-maybe for virtual display support
    let finalCommand = command;
    if (process.platform === 'linux' && command.includes('wdio run')) {
      finalCommand = `xvfb-maybe ${command}`;
      console.log(`🔍 Linux detected: wrapping WDIO command with xvfb-maybe: ${finalCommand}`);
    }

    // Split command into parts for spawn
    const parts = finalCommand.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    // Merge environment variables
    const mergedEnv = { ...process.env, ...env };

    const childProcess = spawn(cmd, args, {
      env: mergedEnv,
      cwd,
      shell: true,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | null = null;

    // Set up timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        childProcess.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
      }, timeout);
    }

    // Capture stdout and stream to console
    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    // Capture stderr and stream to console
    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    // Handle process completion
    childProcess.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve({ stdout, stderr, code: code || 0 });
    });

    // Handle process errors
    childProcess.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });
  });
}

/**
 * Check if a file exists and is readable
 */
export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
export function dirExists(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Create a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
  } = {},
): Promise<T> {
  const { retries = 3, delay: initialDelay = 1000, backoff = 2 } = options;

  let lastError: Error;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i === retries) {
        break; // Don't delay on the last attempt
      }

      const delayMs = initialDelay * Math.pow(backoff, i);
      await delay(delayMs);
    }
  }

  throw lastError!;
}

/**
 * Safe JSON parsing with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
