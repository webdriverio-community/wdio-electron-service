#!/usr/bin/env tsx

import { join } from 'path';
import { execSync } from 'child_process';
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
    if (this.builtApps.has(appPath)) {
      console.log(`✅ App already built: ${appPath}`);
      return true;
    }

    if (!dirExists(appPath)) {
      throw new Error(`App directory does not exist: ${appPath}`);
    }

    const packageJsonPath = join(appPath, 'package.json');
    if (!fileExists(packageJsonPath)) {
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
    console.log(`  Running: ${command} (in ${cwd.split('/').pop()})`);

    try {
      const result = await execWithEnv(command, {}, { cwd, timeout: 180000 }); // 3 minutes

      if (result.code !== 0) {
        throw new Error(`Command failed with code ${result.code}: ${result.stderr}`);
      }
    } catch (error) {
      console.error(`Failed to run command: ${command}`);
      console.error(`Working directory: ${cwd}`);
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
