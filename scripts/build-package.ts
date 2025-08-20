#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUNDLER_PATH = resolve(__dirname, '../packages/@wdio_electron-bundler');
const BUNDLER_CLI = resolve(BUNDLER_PATH, 'dist/cli.js');
const BUNDLER_PACKAGE_JSON = resolve(BUNDLER_PATH, 'package.json');

/**
 * Check if bundler is built and available
 */
function checkBundlerBuilt(): boolean {
  if (!existsSync(BUNDLER_CLI)) {
    return false;
  }

  // Check if dist is newer than source (basic staleness check)
  const distStat = statSync(BUNDLER_CLI);
  const packageStat = statSync(BUNDLER_PACKAGE_JSON);

  return distStat.mtime >= packageStat.mtime;
}

/**
 * Build the bundler package
 */
async function buildBundler(): Promise<void> {
  console.log('🔨 Building bundler...');

  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['build'], {
      cwd: BUNDLER_PATH,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Bundler built successfully');
        resolve();
      } else {
        reject(new Error(`Bundler build failed with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Execute the bundler CLI with provided arguments
 */
async function executeBundler(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [BUNDLER_CLI, ...args], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Bundler execution failed with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    // Get command line arguments (skip node and script name)
    const userArgs = process.argv.slice(2);

    // Always start with 'build' command and append user arguments
    const args = ['build', ...userArgs];

    // Check if bundler needs to be built
    if (!checkBundlerBuilt()) {
      console.log('📦 Bundler not found or outdated, building...');
      await buildBundler();
    }

    // Execute bundler with provided arguments
    await executeBundler(args);
  } catch (error) {
    console.error('❌ Bundler script failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
