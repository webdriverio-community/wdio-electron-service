#!/usr/bin/env tsx

/**
 * Prebuild Test Apps Script
 *
 * This script pre-builds all test apps to ensure they're ready for E2E tests.
 * It should be run before the prepare-apps script in the E2E test process.
 */

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

// Get the directory name using ESM compatible approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const APPS_DIR = path.join(ROOT_DIR, 'apps');

// Log with timestamp
function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function buildApp(appDir: string): Promise<void> {
  const appPath = path.join(APPS_DIR, appDir);

  log(`Building app: ${appDir}...`);

  try {
    // First install dependencies if needed
    if (!fs.existsSync(path.join(appPath, 'node_modules'))) {
      log(`Installing dependencies for ${appDir}...`);
      await execAsync('pnpm install --no-lockfile', { cwd: appPath });
      log(`Successfully installed dependencies for ${appDir}`);
    }

    // Run the build command
    log(`Running build for ${appDir}...`);
    await execAsync('pnpm build', { cwd: appPath });
    log(`Successfully built ${appDir}`);

    // Verify the dist directory exists
    const distDir = path.join(appPath, 'dist');
    if (fs.existsSync(distDir)) {
      const distFiles = fs.readdirSync(distDir);
      log(`Verified dist directory for ${appDir} with ${distFiles.length} files/directories`);
    } else {
      log(`Warning: dist directory not found for ${appDir} after build`);
    }
  } catch (error) {
    log(`Error building ${appDir}: ${error}`);
    // Continue with next app
  }
}

async function buildAllApps(): Promise<void> {
  log('Starting prebuild of all test apps');

  try {
    // Build the service packages first to ensure they're available
    log('Building service packages...');
    await execAsync('pnpm build', { cwd: ROOT_DIR });
    log('Service packages built successfully');

    // Get all directories in the apps directory
    const appDirs = fs
      .readdirSync(APPS_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    log(`Found ${appDirs.length} app directories: ${appDirs.join(', ')}`);

    // Build each app
    for (const appDir of appDirs) {
      await buildApp(appDir);
    }

    log('All apps prebuilt successfully');
  } catch (error) {
    log(`Error building apps: ${error}`);
    process.exit(1);
  }
}

buildAllApps().catch((error) => {
  log(`Unhandled error: ${error}`);
  process.exit(1);
});
