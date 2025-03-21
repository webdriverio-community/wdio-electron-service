/**
 * Utility function to link example apps for testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getTempDir } from './temp-dir.js';

const execPromise = promisify(exec);

/**
 * Link example apps for testing
 * @returns Path to the linked apps directory
 */
export async function linkExampleApps(): Promise<string> {
  console.log('Linking example apps for testing');

  const tempDir = getTempDir();
  if (!tempDir) {
    throw new Error('Temporary directory not created');
  }

  const appsDir = path.join(tempDir, 'apps');
  if (!fs.existsSync(appsDir)) {
    fs.mkdirSync(appsDir, { recursive: true });
  }

  try {
    // Get the project root directory (two levels up from the scripts directory)
    const rootDir = path.resolve(process.cwd(), '../..');

    // Copy example apps from e2e/fixture-apps to temp directory
    const sourceDir = path.join(rootDir, 'e2e', 'fixture-apps');

    if (!fs.existsSync(sourceDir)) {
      console.log(`Source directory does not exist: ${sourceDir}`);
      console.log('Creating empty apps directory');
      return appsDir;
    }

    const appTypes = fs.readdirSync(sourceDir).filter((dir) => fs.statSync(path.join(sourceDir, dir)).isDirectory());

    console.log(`Found app types: ${appTypes.join(', ')}`);

    for (const appType of appTypes) {
      const appTypeSrcDir = path.join(sourceDir, appType);
      const appTypeDestDir = path.join(appsDir, appType);

      console.log(`Copying ${appType} apps from ${appTypeSrcDir} to ${appTypeDestDir}`);

      // Copy directory recursively
      fs.cpSync(appTypeSrcDir, appTypeDestDir, { recursive: true });

      // Install dependencies
      console.log(`Installing dependencies for ${appType} apps`);
      try {
        await execPromise('pnpm install', { cwd: appTypeDestDir });
        console.log(`Dependencies installed for ${appType} apps`);
      } catch (error) {
        console.error(
          `Error installing dependencies for ${appType} apps:`,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    }

    console.log('Example apps linked successfully');
    return appsDir;
  } catch (error) {
    console.error('Error linking example apps:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
