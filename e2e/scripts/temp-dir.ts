/**
 * Utility functions for managing temporary directories for E2E tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Keep track of the temporary directory path
let tempDirPath: string | null = null;

/**
 * Create a temporary directory for test files
 * @returns Path to the created temporary directory
 */
export async function createTempDir(): Promise<string> {
  // Generate a unique directory name
  const uniqueId = uuidv4();
  const dirName = `wdio-e2e-${uniqueId}`;

  // Create the path
  const tmpDir = path.join(os.tmpdir(), dirName);

  // Create the directory
  fs.mkdirSync(tmpDir, { recursive: true });
  console.log(`Created temporary directory: ${tmpDir}`);

  // Create subdirectories
  const appsDir = path.join(tmpDir, 'apps');
  fs.mkdirSync(appsDir, { recursive: true });

  // Store the path
  tempDirPath = tmpDir;

  // Set environment variable for other scripts
  process.env.WDIO_TEST_APPS_DIR = tmpDir;

  return tmpDir;
}

/**
 * Get the path to the temporary directory
 * @returns Path to the temporary directory or null if not created
 */
export function getTempDir(): string | null {
  return tempDirPath || process.env.WDIO_TEST_APPS_DIR || null;
}

/**
 * Clean up the temporary directory
 */
export function cleanupTempDir(): void {
  const tempDir = getTempDir();
  if (!tempDir) {
    console.log('No temporary directory to clean up');
    return;
  }

  if (fs.existsSync(tempDir)) {
    try {
      console.log(`Removing temporary directory: ${tempDir}`);
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('Temporary directory removed successfully');
    } catch (error) {
      console.error('Failed to remove temporary directory:', error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log(`Temporary directory does not exist: ${tempDir}`);
  }

  // Reset the path
  tempDirPath = null;
  delete process.env.WDIO_TEST_APPS_DIR;
}
