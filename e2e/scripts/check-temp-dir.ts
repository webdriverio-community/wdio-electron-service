#!/usr/bin/env node

/**
 * Check the directory structure of the temporary directory
 * This script is used for debugging purposes
 */

import * as fs from 'fs';
import * as path from 'path';

async function checkTempDir() {
  // Get the temporary directory from the environment variable
  const tmpDir = process.env.WDIO_TEST_APPS_DIR;

  if (!tmpDir) {
    console.error('Error: WDIO_TEST_APPS_DIR environment variable is not set');
    process.exit(1);
  }

  console.log(`Checking temporary directory: ${tmpDir}`);

  // Check if the directory exists
  if (!fs.existsSync(tmpDir)) {
    console.error(`Error: Directory ${tmpDir} does not exist`);
    process.exit(1);
  }

  // Check the apps directory
  const appsDir = path.join(tmpDir, 'apps');
  if (!fs.existsSync(appsDir)) {
    console.error(`Error: Apps directory ${appsDir} does not exist`);
    process.exit(1);
  }

  // List the apps directory
  console.log(`\nListing apps directory: ${appsDir}`);
  const appDirs = fs.readdirSync(appsDir);
  console.log(`Found ${appDirs.length} app directories: ${appDirs.join(', ')}`);

  // Check each app directory
  for (const appDir of appDirs) {
    if (appDir === 'package.json' || appDir === 'node_modules') continue;

    const appPath = path.join(appsDir, appDir);
    console.log(`\nChecking app directory: ${appPath}`);

    // List the app directory
    const appFiles = fs.readdirSync(appPath);
    console.log(`Found ${appFiles.length} files/directories: ${appFiles.join(', ')}`);

    // Check the dist directory
    const distDir = path.join(appPath, 'dist');
    if (!fs.existsSync(distDir)) {
      console.error(`Error: Dist directory ${distDir} does not exist`);
      continue;
    }

    // List the dist directory
    const distFiles = fs.readdirSync(distDir);
    console.log(`Found ${distFiles.length} files in dist directory: ${distFiles.join(', ')}`);

    // Check for main.bundle.js
    const mainBundlePath = path.join(distDir, 'main.bundle.js');
    if (!fs.existsSync(mainBundlePath)) {
      console.error(`Error: main.bundle.js not found in ${distDir}`);
    } else {
      console.log(`Found main.bundle.js: ${mainBundlePath}`);

      // Check the file size
      const stats = fs.statSync(mainBundlePath);
      console.log(`File size: ${stats.size} bytes`);

      // Check the file permissions
      console.log(`File permissions: ${stats.mode.toString(8)}`);
    }
  }
}

// Run the check
checkTempDir().catch((error) => {
  console.error('Error checking temporary directory:', error);
  process.exit(1);
});
