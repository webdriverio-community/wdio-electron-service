/**
 * Utility function to pack the wdio-electron-service for testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getTempDir } from './temp-dir.js';

const execPromise = promisify(exec);

/**
 * Pack the service into a tarball for testing
 * @returns Path to the packed service tarball
 */
export async function packService(): Promise<string> {
  // Get the project root directory (two levels up from the scripts directory)
  const rootDir = path.resolve(process.cwd(), '../..');
  console.log(`Project root directory: ${rootDir}`);

  // The actual service package is in the packages directory
  const serviceDir = path.join(rootDir, 'packages', 'wdio-electron-service');
  console.log(`Packing service from directory: ${serviceDir}`);

  try {
    // Run pnpm pack to create a tarball
    const { stdout } = await execPromise('pnpm pack --pack-destination ./', { cwd: serviceDir });

    // Extract the tarball name from the output
    // pnpm pack output contains package contents and ends with the actual tarball path
    const tarballPathMatch = stdout.match(/[a-zA-Z0-9-_./@]+\.tgz$/m);
    if (!tarballPathMatch) {
      throw new Error('Could not find tarball path in pnpm pack output');
    }

    const tarballName = path.basename(tarballPathMatch[0]);
    const tarballPath = path.join(serviceDir, tarballName);

    console.log(`Service packed successfully: ${tarballPath}`);
    console.log(`Tarball name: ${tarballName}`);

    // Verify the tarball exists
    if (!fs.existsSync(tarballPath)) {
      throw new Error(`Tarball file does not exist at ${tarballPath}`);
    }

    // Move tarball to temp directory
    const tempDir = getTempDir();
    if (!tempDir) {
      throw new Error('Temporary directory not created');
    }

    const destPath = path.join(tempDir, tarballName);
    fs.copyFileSync(tarballPath, destPath);
    console.log(`Copied tarball to temp directory: ${destPath}`);

    // Set environment variable for other scripts
    process.env.WDIO_SERVICE_TARBALL = destPath;

    return destPath;
  } catch (error) {
    console.error('Error packing service:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
