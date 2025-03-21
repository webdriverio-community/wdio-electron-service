/**
 * Utility function to set up test assets for E2E tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { getTempDir } from './temp-dir.js';

/**
 * Set up test assets for E2E tests
 * @returns Path to the test assets directory
 */
export async function setupTestAssets(): Promise<string> {
  console.log('Setting up test assets');

  const tempDir = getTempDir();
  if (!tempDir) {
    throw new Error('Temporary directory not created');
  }

  // Create test assets directory
  const assetsDir = path.join(tempDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  try {
    // Get the project root directory (two levels up from the scripts directory)
    const rootDir = path.resolve(process.cwd(), '../..');

    // Copy test assets from e2e/assets to temp directory
    const sourceDir = path.join(rootDir, 'e2e', 'assets');
    if (fs.existsSync(sourceDir)) {
      // Copy files from e2e/assets to temp/assets
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        const srcPath = path.join(sourceDir, file);
        const destPath = path.join(assetsDir, file);

        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`Copied asset: ${file}`);
        } else {
          // If it's a directory, copy recursively
          fs.cpSync(srcPath, destPath, { recursive: true });
          console.log(`Copied asset directory: ${file}`);
        }
      }
    } else {
      console.log('No test assets found in e2e/assets, creating empty assets directory');
    }

    // Create a marker file to indicate setup is complete
    fs.writeFileSync(path.join(assetsDir, '.setup-complete'), `Setup completed at ${new Date().toISOString()}`);

    console.log('Test assets set up successfully');

    // Set environment variable for other scripts
    process.env.WDIO_TEST_ASSETS_DIR = assetsDir;

    return assetsDir;
  } catch (error) {
    console.error('Error setting up test assets:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
