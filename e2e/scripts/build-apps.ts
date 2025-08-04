#!/usr/bin/env tsx

import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { createEnvironmentContext } from '../config/envSchema.js';
import { dirExists, fileExists, execWithEnv, formatDuration } from './utils.js';

/**
 * Build manager for in-place app building
 * Much simpler than isolation approach - just builds apps where they are
 */
export class BuildManager {
  private builtApps = new Set<string>();

  /**
   * Ensure an app is built (builds only if needed)
   */
  async ensureAppBuilt(appPath: string): Promise<boolean> {
    console.log(`🔍 Debug: Checking if app needs building: ${appPath}`);
    console.log(`  Platform: ${process.platform}`);
    console.log(`  Already built apps: ${Array.from(this.builtApps).join(', ') || 'none'}`);

    if (this.builtApps.has(appPath)) {
      console.log(`✅ App already built: ${appPath}`);
      return true;
    }

    console.log(`🔍 Debug: Checking app directory existence: ${appPath}`);
    if (!dirExists(appPath)) {
      console.error(`❌ App directory does not exist: ${appPath}`);
      console.log(`🔍 Debug: Current working directory: ${process.cwd()}`);
      console.log(`🔍 Debug: Listing parent directory contents...`);
      try {
        const parentDir = dirname(appPath);
        const fs = await import('fs');
        const contents = fs.readdirSync(parentDir);
        console.log(`  Parent directory (${parentDir}) contents: ${contents.join(', ')}`);
      } catch (error) {
        console.log(`  Failed to list parent directory: ${error}`);
      }
      throw new Error(`App directory does not exist: ${appPath}`);
    }

    const packageJsonPath = join(appPath, 'package.json');
    console.log(`🔍 Debug: Checking package.json: ${packageJsonPath}`);
    if (!fileExists(packageJsonPath)) {
      console.error(`❌ package.json not found in: ${appPath}`);
      console.log(`🔍 Debug: Listing app directory contents...`);
      try {
        const fs = await import('fs');
        const contents = fs.readdirSync(appPath);
        console.log(`  App directory contents: ${contents.join(', ')}`);
      } catch (error) {
        console.log(`  Failed to list app directory: ${error}`);
      }
      throw new Error(`package.json not found in: ${appPath}`);
    }

    console.log(`🔨 Building app: ${appPath}`);
    const startTime = Date.now();

    try {
      // Clean any existing build artifacts first
      const distPath = join(appPath, 'dist');
      if (dirExists(distPath)) {
        console.log(`  Cleaning existing dist directory: ${distPath}`);
        await this.runCommand('pnpm run clean:dist', appPath);
      }

      // Install dependencies
      await this.runCommand('pnpm install', appPath);

      // Build the app (all apps use the same build command)
      await this.runCommand('pnpm run build', appPath);

      const duration = Date.now() - startTime;
      console.log(`✅ App built successfully in ${formatDuration(duration)}: ${appPath}`);

      this.builtApps.add(appPath);
      return true;
    } catch (error) {
      console.error(`❌ Failed to build app: ${appPath}`, error);
      return false;
    }
  }

  /**
   * Build all apps for the current environment
   */
  async buildAppsForEnvironment(): Promise<void> {
    const envContext = createEnvironmentContext();
    const appsDir = join(process.cwd(), '..', 'fixtures', 'e2e-apps');

    console.log(`🏗️ Building apps for environment: ${envContext.toString()}`);

    // Determine which apps to build based on environment
    const appsToBuild: string[] = [];

    if (envContext.platform === 'no-binary') {
      appsToBuild.push(join(appsDir, `no-binary-${envContext.moduleType}`));
    } else {
      appsToBuild.push(join(appsDir, `${envContext.platform}-${envContext.moduleType}`));
    }

    // If Mac Universal, also build the other module type
    if (envContext.isMacUniversal) {
      const otherModuleType = envContext.moduleType === 'cjs' ? 'esm' : 'cjs';
      appsToBuild.push(join(appsDir, `${envContext.platform}-${otherModuleType}`));
    }

    console.log(`📦 Apps to build: ${appsToBuild.map((p) => p.split('/').pop()).join(', ')}`);

    // Build each app
    for (const appPath of appsToBuild) {
      await this.ensureAppBuilt(appPath);
    }
  }

  /**
   * Build all apps (for comprehensive testing)
   */
  async buildAllApps(): Promise<void> {
    const appsDir = join(process.cwd(), '..', 'fixtures', 'e2e-apps');
    const appDirs = ['builder-cjs', 'builder-esm', 'forge-cjs', 'forge-esm', 'no-binary-cjs', 'no-binary-esm'];

    console.log('🏗️ Building all apps...');

    for (const appDir of appDirs) {
      const appPath = join(appsDir, appDir);
      if (dirExists(appPath)) {
        await this.ensureAppBuilt(appPath);
      } else {
        console.warn(`⚠️ App directory not found: ${appPath}`);
      }
    }
  }

  /**
   * Check if an app needs building
   */
  needsBuild(appPath: string): boolean {
    if (this.builtApps.has(appPath)) {
      return false;
    }

    // Check if dist directory exists and has content
    const distPath = join(appPath, 'dist');
    if (!dirExists(distPath)) {
      return true;
    }

    // For now, assume any app without a recorded build needs building
    // In the future, we could check timestamps, etc.
    return true;
  }

  /**
   * Run a command in a specific directory
   */
  private async runCommand(command: string, cwd: string): Promise<void> {
    const cwdName = process.platform === 'win32' ? cwd.split('\\').pop() : cwd.split('/').pop();
    console.log(`  Running: ${command} (in ${cwdName})`);
    
    // Add CI environment debugging
    console.log(`🔍 Debug: CI Environment Info:`);
    console.log(`    CI: ${process.env.CI || 'false'}`);
    console.log(`    GITHUB_ACTIONS: ${process.env.GITHUB_ACTIONS || 'false'}`);
    console.log(`    RUNNER_OS: ${process.env.RUNNER_OS || 'unknown'}`);
    console.log(`    Memory usage: ${JSON.stringify(process.memoryUsage())}`);
    console.log(`    Platform: ${process.platform} ${process.arch}`);
    console.log(`    Node version: ${process.version}`);
    console.log(`    Working directory: ${cwd}`);
    console.log(`    Free disk space check...`);
    
    try {
      // Check disk space on Unix systems
      if (process.platform !== 'win32') {
        const { execSync } = await import('child_process');
        try {
          const dfOutput = execSync('df -h .', { cwd, encoding: 'utf8' });
          console.log(`    Disk space: ${dfOutput.split('\n')[1]}`);
        } catch (e) {
          console.log(`    Could not check disk space: ${e}`);
        }
      }
    } catch (e) {
      console.log(`    Disk space check failed: ${e}`);
    }

    const startTime = Date.now();
    console.log(`🔍 Debug: Starting command at ${new Date().toISOString()}`);

    try {
      const result = await execWithEnv(command, {}, { cwd, timeout: 180000 }); // 3 minutes
      const duration = Date.now() - startTime;

      console.log(`🔍 Debug: Command completed in ${duration}ms with exit code: ${result.code}`);
      
      if (result.stdout) {
        console.log(`🔍 Debug: Command stdout (${result.stdout.length} chars): ${result.stdout.slice(0, 500)}${result.stdout.length > 500 ? '...' : ''}`);
      }
      if (result.stderr) {
        console.log(`🔍 Debug: Command stderr (${result.stderr.length} chars): ${result.stderr.slice(0, 500)}${result.stderr.length > 500 ? '...' : ''}`);
      }

      if (result.code !== 0) {
        console.error(`❌ Command failed with code ${result.code} after ${duration}ms`);
        console.error(`❌ Full stderr: ${result.stderr}`);
        console.error(`❌ Full stdout: ${result.stdout}`);
        throw new Error(`Command failed with code ${result.code}: ${result.stderr}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Command failed after ${duration}ms: ${command}`);
      console.error(`❌ Working directory: ${cwd}`);
      console.error(`❌ Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`❌ Error message: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`❌ Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      throw error;
    }
  }

  /**
   * Clean built apps (remove dist directories)
   */
  async cleanApps(): Promise<void> {
    const appsDir = join(process.cwd(), '..', 'fixtures', 'e2e-apps');
    const appDirs = ['builder-cjs', 'builder-esm', 'forge-cjs', 'forge-esm', 'no-binary-cjs', 'no-binary-esm'];

    console.log('🧹 Cleaning app build artifacts...');

    for (const appDir of appDirs) {
      const appPath = join(appsDir, appDir);
      const distPath = join(appPath, 'dist');
      const outPath = join(appPath, 'out');

      try {
        if (dirExists(distPath)) {
          execSync(`rm -rf "${distPath}"`, { stdio: 'inherit' });
          console.log(`  Cleaned: ${appDir}/dist`);
        }
        if (dirExists(outPath)) {
          execSync(`rm -rf "${outPath}"`, { stdio: 'inherit' });
          console.log(`  Cleaned: ${appDir}/out`);
        }
      } catch (error) {
        console.warn(`Warning: Failed to clean ${appDir}:`, error);
      }
    }

    // Clear the built apps cache
    this.builtApps.clear();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const buildManager = new BuildManager();

  try {
    if (args.includes('--clean')) {
      await buildManager.cleanApps();
      return;
    }

    if (args.includes('--all')) {
      await buildManager.buildAllApps();
    } else {
      await buildManager.buildAppsForEnvironment();
    }

    console.log('🎉 Build process completed successfully!');
  } catch (error) {
    console.error('❌ Build process failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export default BuildManager;
