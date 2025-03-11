#!/usr/bin/env node

/**
 * This script cleans up all temporary directories created by the E2E tests.
 * It can be run manually or as part of a CI/CD pipeline.
 */

import { execSync } from 'child_process';
import { rmSync } from 'fs';
import { tmpdir } from 'os';

/**
 * Find all wdio-e2e-* directories in the temp directory
 * @returns Array of directory paths
 */
function findTempDirs(): string[] {
  try {
    const tempDir = tmpdir();
    console.log(`Searching for test directories in ${tempDir}...`);

    // Use different commands based on platform
    let cmd: string;
    if (process.platform === 'win32') {
      cmd = `dir /b /s "${tempDir}" | findstr "wdio-e2e-"`;
    } else {
      cmd = `find ${tempDir} -name "wdio-e2e-*" -type d 2>/dev/null`;
    }

    const output = execSync(cmd, { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error finding temp directories:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Clean up all found directories
 * @param dirs Array of directory paths to clean up
 */
function cleanupDirs(dirs: string[]): void {
  console.log(`Found ${dirs.length} directories to clean up.`);

  let successCount = 0;
  let failCount = 0;

  for (const dir of dirs) {
    try {
      // Get directory size before deletion (Unix only)
      if (process.platform !== 'win32') {
        try {
          const sizeOutput = execSync(`du -sh "${dir}" | cut -f1`, { encoding: 'utf8' });
          console.log(`Removing ${dir} (${sizeOutput.trim()})`);
        } catch {
          console.log(`Removing ${dir}`);
        }
      } else {
        console.log(`Removing ${dir}`);
      }

      // Remove directory
      rmSync(dir, { recursive: true, force: true });
      successCount++;
    } catch (error) {
      console.error(`Failed to remove ${dir}:`, error instanceof Error ? error.message : String(error));
      failCount++;
    }
  }

  console.log(`\nCleanup complete:`);
  console.log(`- Successfully removed: ${successCount} directories`);
  if (failCount > 0) {
    console.log(`- Failed to remove: ${failCount} directories`);
  }
}

/**
 * Main function to run the cleanup process
 */
function main(): void {
  console.log('Starting cleanup of E2E test temporary directories...');
  const dirs = findTempDirs();

  if (dirs.length === 0) {
    console.log('No temporary test directories found.');
    return;
  }

  cleanupDirs(dirs);
}

// Run the script
main();
