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
      // Redirect stderr to /dev/null to suppress "Operation not permitted" errors
      cmd = `ls -la ${tempDir} | grep wdio-e2e 2>/dev/null`;
    }

    const output = execSync(cmd, { encoding: 'utf8' });

    // Extract directory names from ls output
    if (process.platform !== 'win32') {
      const lines = output.trim().split('\n').filter(Boolean);
      return lines.map((line) => {
        const parts = line.trim().split(/\s+/);
        const dirName = parts[parts.length - 1];
        return `${tempDir}/${dirName}`;
      });
    }

    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    // If the command fails with a non-zero exit code (e.g., no matches found), return an empty array
    if (error instanceof Error && error.message.includes('Command failed')) {
      return [];
    }
    console.error('Error finding temp directories:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Clean up all temporary directories
 */
function cleanupTempDirs(): void {
  const tempDirs = findTempDirs();

  if (tempDirs.length === 0) {
    console.log('No temporary test directories found.');
    return;
  }

  console.log(`Found ${tempDirs.length} temporary test directories to clean up:`);

  let successCount = 0;
  let failCount = 0;

  for (const dir of tempDirs) {
    try {
      console.log(`Removing ${dir}...`);
      rmSync(dir, { recursive: true, force: true });
      successCount++;
    } catch (error) {
      console.error(`Failed to remove ${dir}:`, error instanceof Error ? error.message : String(error));
      failCount++;
    }
  }

  console.log(`\nCleanup complete: ${successCount} directories removed, ${failCount} failed.`);
}

// Run the cleanup
cleanupTempDirs();
