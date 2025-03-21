import { mkdtemp, readFile, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

class TestAppsManager {
  private static instance: TestAppsManager;
  private tmpDir: string | null = null;
  private cleanupRegistered = false;
  private isPrepared = false;

  private constructor() {}

  static getInstance(): TestAppsManager {
    if (!TestAppsManager.instance) {
      TestAppsManager.instance = new TestAppsManager();
    }
    return TestAppsManager.instance;
  }

  // Helper method for cross-platform directory creation
  private async createDirectory(dirPath: string): Promise<void> {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  }

  private registerCleanupHandlers() {
    if (this.cleanupRegistered) return;

    // Register process exit handlers to ensure cleanup happens
    process.on('exit', () => {
      // Check if we should preserve the temp directory
      if (process.env.PRESERVE_TEMP_DIR === 'true') {
        console.log(`Preserving temp directory: ${this.tmpDir} for reuse`);
        return;
      }

      if (this.tmpDir) {
        // Synchronous cleanup for 'exit' event
        try {
          fs.rmSync(this.tmpDir, { recursive: true, force: true });
          console.log('Cleaned up temp directory on exit');
        } catch (error) {
          console.error('Failed to cleanup temp directory on exit:', error);
        }
      }
    });

    // Handle other termination signals
    ['SIGINT', 'SIGTERM', 'SIGQUIT', 'uncaughtException', 'unhandledRejection'].forEach((signal) => {
      process.on(signal, async (error) => {
        if (error) console.error(`Process terminating due to ${signal}:`, error);
        console.log(`Received ${signal}, cleaning up...`);

        try {
          await this.cleanup();
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }

        // Exit with non-zero code for errors
        if (signal === 'uncaughtException' || signal === 'unhandledRejection') {
          process.exit(1);
        } else {
          process.exit(0);
        }
      });
    });

    this.cleanupRegistered = true;
    console.log('Registered cleanup handlers for process termination');
  }

  async prepareTestApps(): Promise<string> {
    // Register cleanup handlers when preparing test apps
    this.registerCleanupHandlers();

    // Log start time and memory usage
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Starting test apps preparation`);
    console.log(`Initial memory usage: RSS=${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

    // Track execution time for each step
    const timings: Record<string, number> = {};
    const timeStep = (step: string) => {
      const now = Date.now();
      const elapsed = now - (timings.last || startTime);
      timings[step] = elapsed;
      timings.last = now;
      console.log(`Step "${step}" completed in ${(elapsed / 1000).toFixed(2)}s`);
      console.log(`Memory usage after "${step}": RSS=${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
    };

    if (this.tmpDir) {
      console.log(`Reusing existing temp directory: ${this.tmpDir}`);
      this.isPrepared = true;
      return this.tmpDir;
    }

    const serviceDir = join(process.cwd(), '..', 'packages', 'wdio-electron-service');
    const appsDir = join(process.cwd(), '..', 'apps');

    console.log(`Service directory: ${serviceDir}`);
    console.log(`Apps directory: ${appsDir}`);

    // 1. Create temp directory first with a shorter path
    console.log('Creating temp directory');
    // Use a shorter prefix to avoid path length issues
    this.tmpDir = await mkdtemp(join(tmpdir(), 'wdio-e2e-'));
    console.log(`Created temp directory: ${this.tmpDir}`);
    timeStep('create_temp_dir');

    // 2. Obtain the service package
    console.log('Setting up service package');

    let packageFileName: string;

    // Check if we should use a pre-built artifact
    if (process.env.USE_ARTIFACT_SERVICE === 'true' && process.env.WDIO_SERVICE_TARBALL) {
      console.log(`Using pre-built service from: ${process.env.WDIO_SERVICE_TARBALL}`);

      const sourceTarball = process.env.WDIO_SERVICE_TARBALL;
      packageFileName = path.basename(sourceTarball);

      // Verify the tarball exists
      try {
        await fs.promises.access(sourceTarball, fs.constants.F_OK);
        console.log(`Verified tarball exists at: ${sourceTarball}`);

        // Copy the tarball to the temp directory
        const tempPackagePath = join(this.tmpDir, packageFileName);
        try {
          await fs.promises.copyFile(sourceTarball, tempPackagePath);
          console.log(`Copied tarball to: ${tempPackagePath}`);

          // Verify the copy was successful
          await fs.promises.access(tempPackagePath, fs.constants.F_OK);
          console.log(`Verified tarball copy exists at: ${tempPackagePath}`);
        } catch (copyError: unknown) {
          console.error(`Error copying tarball:`, copyError);
          throw new Error(
            `Failed to copy tarball: ${copyError instanceof Error ? copyError.message : String(copyError)}`,
          );
        }

        timeStep('use_artifact_package');
      } catch (error) {
        console.error(`Pre-built tarball not found at ${sourceTarball}:`, error);
        console.log('Falling back to packaging the service');

        // Fall back to packaging the service
        packageFileName = await this.packService(serviceDir);
      }
    } else {
      // Package the service on demand
      packageFileName = await this.packService(serviceDir);
    }

    // 3. Copy apps
    console.log('Copying apps');
    // Create the apps directory
    const appsTargetDir = join(this.tmpDir, 'apps');
    await this.createDirectory(appsTargetDir);

    // Copy each app directory individually to ensure proper structure
    const appDirs = ['builder-cjs', 'builder-esm', 'forge-cjs', 'forge-esm', 'no-binary-cjs', 'no-binary-esm'];
    for (const appDir of appDirs) {
      const sourceAppDir = join(appsDir, appDir);
      const targetAppDir = join(this.tmpDir, 'apps', appDir);

      // Ensure the dist directory exists in the source app
      const distDir = join(sourceAppDir, 'dist');
      if (!fs.existsSync(distDir)) {
        console.warn(`Warning: dist directory not found in ${appDir}. The app may not be built.`);
      } else {
        console.log(`Found dist directory in ${appDir}`);
      }

      // Create the target app directory
      await this.createDirectory(targetAppDir);

      // Use cp -R with the --preserve=all flag to ensure all file attributes are preserved
      // Copy all files and directories except node_modules to avoid large copies
      console.log(`Copying ${appDir} to ${targetAppDir}...`);

      try {
        // Copy package.json and other files in the root directory
        await execAsync(`cp -R ${sourceAppDir}/package.json ${targetAppDir}/`);

        // Copy the src directory if it exists
        if (fs.existsSync(join(sourceAppDir, 'src'))) {
          await execAsync(`cp -R ${sourceAppDir}/src ${targetAppDir}/`);
        }

        // Copy the dist directory if it exists
        if (fs.existsSync(distDir)) {
          console.log(`Copying dist directory for ${appDir}...`);

          // Create the dist directory in the target app
          const targetDistDir = join(targetAppDir, 'dist');
          await this.createDirectory(targetDistDir);

          // Use cp -R to copy the entire dist directory with all its contents
          // The /* pattern might miss hidden files or cause issues with nested directories
          await execAsync(`cp -R "${distDir}" "${targetAppDir}/"`);

          // Verify the dist directory was copied
          if (fs.existsSync(targetDistDir)) {
            // Check if mac-arm64 directory exists for binary apps
            const macArmDir = join(targetDistDir, 'mac-arm64');
            if (fs.existsSync(macArmDir)) {
              console.log(`Verified mac-arm64 directory exists in ${targetDistDir}`);

              // Check if the app exists
              const appName = `example-${appDir}.app`;
              const appPath = join(macArmDir, appName);
              if (fs.existsSync(appPath)) {
                console.log(`Verified ${appName} exists in mac-arm64 directory`);

                // Check if the executable exists
                const execPath = join(appPath, 'Contents', 'MacOS', `example-${appDir}`);
                if (fs.existsSync(execPath)) {
                  console.log(`Verified executable exists at ${execPath}`);
                } else {
                  console.warn(`Warning: Executable not found at ${execPath}`);
                }
              } else {
                console.warn(`Warning: ${appName} not found in mac-arm64 directory`);
              }
            }

            const distFiles = fs.readdirSync(targetDistDir);
            console.log(`Copied dist directory for ${appDir} with ${distFiles.length} files/directories`);
          } else {
            console.error(`Error: dist directory not created for ${appDir}`);
          }
        }

        // Copy other important files and directories
        const otherFiles = ['tsconfig.json', 'rollup.config.js', 'rollup.config.mjs', 'forge.config.js'];
        for (const file of otherFiles) {
          if (fs.existsSync(join(sourceAppDir, file))) {
            await execAsync(`cp -R ${sourceAppDir}/${file} ${targetAppDir}/`);
          }
        }
      } catch (copyError) {
        console.error(`Error copying ${appDir}:`, copyError);
        throw new Error(
          `Failed to copy app ${appDir}: ${copyError instanceof Error ? copyError.message : String(copyError)}`,
        );
      }
    }

    // Create a package.json in the apps directory for pnpm workspace
    const workspacePackageJson = {
      name: 'wdio-electron-test-apps',
      version: '1.0.0',
      private: true,
    };
    await writeFile(join(this.tmpDir, 'apps', 'package.json'), JSON.stringify(workspacePackageJson, null, 2));

    // Verify the apps directory structure
    console.log('Verifying apps directory structure');
    try {
      const { stdout: lsOutput } = await execAsync(`ls -la ${join(this.tmpDir, 'apps')}`);
      console.log('Apps directory contents:', lsOutput);
    } catch (error) {
      console.error('Error verifying apps directory:', error);
    }

    // 4. Update each app's package.json
    console.log('Updating package.jsons');

    for (const appDir of appDirs) {
      const appPath = join(this.tmpDir, 'apps', appDir);
      const packageJsonPath = join(appPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

      // Use a relative path that's shorter
      packageJson.dependencies['wdio-electron-service'] = `../../${packageFileName}`;

      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    // 5. Install dependencies
    console.log('Installing dependencies');
    await execAsync('pnpm install', { cwd: join(this.tmpDir, 'apps') });

    // 6. Create a symlink to the wdio-electron-service package in node_modules
    // This helps with module resolution in ESM mode
    console.log('Creating symlink for wdio-electron-service');
    try {
      const nodeModulesDir = join(this.tmpDir, 'apps', 'node_modules');
      const serviceSymlinkPath = join(nodeModulesDir, 'wdio-electron-service');

      // First, make sure the node_modules directory exists
      try {
        await this.createDirectory(nodeModulesDir);
        console.log(`Created node_modules directory at: ${nodeModulesDir}`);
      } catch (mkdirError) {
        console.error('Error creating node_modules directory:', mkdirError);
      }

      // Build the package to ensure the dist directory exists
      try {
        console.log('Building wdio-electron-service package to ensure dist directory exists');
        const packageDir = join(process.cwd(), '..', 'packages', 'wdio-electron-service');
        await execAsync('pnpm build', { cwd: packageDir });
        console.log('Successfully built wdio-electron-service package');
      } catch (buildError) {
        console.error('Error building wdio-electron-service package:', buildError);
        // Continue even if build fails, as the package might already be built
      }

      // Find the actual path of the installed package
      try {
        // List the contents of the node_modules/.pnpm directory to find the package
        const { stdout: pnpmDirContents } = await execAsync(
          `find ${nodeModulesDir}/.pnpm -name "wdio-electron-service" -type d | head -n 1`,
        );
        const extractedServicePath = pnpmDirContents.trim();

        if (extractedServicePath) {
          // Create the parent directory for the symlink if it doesn't exist
          await this.createDirectory(join(nodeModulesDir, 'wdio-electron-service'));

          // Create the symlink
          await execAsync(`ln -sf ${extractedServicePath} ${serviceSymlinkPath}`);
          console.log(`Created symlink from ${extractedServicePath} to ${serviceSymlinkPath}`);
        } else {
          console.log('Could not find wdio-electron-service package in node_modules/.pnpm');

          // Alternative approach: copy the package directly from the built package
          console.log('Trying alternative approach: copying package files');
          const packageDir = join(process.cwd(), '..', 'packages', 'wdio-electron-service');

          // Create the target directory
          await this.createDirectory(serviceSymlinkPath);

          // Copy the package.json
          await execAsync(`cp ${packageDir}/package.json ${serviceSymlinkPath}/`);

          // Verify the dist directory exists
          try {
            await fs.promises.access(join(packageDir, 'dist'), fs.constants.F_OK);
            console.log(`Verified dist directory exists at: ${join(packageDir, 'dist')}`);
          } catch (error) {
            console.error(`Dist directory not found at ${join(packageDir, 'dist')}:`, error);
            console.log('Attempting to build the package again');

            try {
              await execAsync('pnpm build', { cwd: packageDir });
              console.log('Successfully built wdio-electron-service package');
            } catch (buildError) {
              console.error('Error building wdio-electron-service package:', buildError);
              // Continue even if build fails, as we'll try to copy what exists
            }
          }

          // Create the dist directory structure
          await this.createDirectory(join(serviceSymlinkPath, 'dist', 'esm'));
          await this.createDirectory(join(serviceSymlinkPath, 'dist', 'cjs'));

          // Copy the dist files if they exist
          try {
            await execAsync(`cp -r ${packageDir}/dist/esm ${serviceSymlinkPath}/dist/`);
            await execAsync(`cp -r ${packageDir}/dist/cjs ${serviceSymlinkPath}/dist/`);
            console.log('Copied dist files to the target directory');
          } catch (copyError) {
            console.error('Error copying dist files:', copyError);
            // Continue even if copy fails, as we'll try to copy other directories
          }

          // Copy the main and preload directories if they exist
          try {
            if (fs.existsSync(join(packageDir, 'main'))) {
              await execAsync(`cp -r ${packageDir}/main ${serviceSymlinkPath}/`);
            }
            if (fs.existsSync(join(packageDir, 'preload'))) {
              await execAsync(`cp -r ${packageDir}/preload ${serviceSymlinkPath}/`);
            }
            console.log(`Copied package files to ${serviceSymlinkPath}`);
          } catch (copyError) {
            console.error('Error copying main/preload directories:', copyError);
            // Continue even if copy fails
          }
        }
      } catch (error) {
        console.error('Error creating symlink or copying files:', error);
        // Continue even if symlink creation fails
      }
    } catch (error) {
      console.error('Error setting up wdio-electron-service:', error);
      // Continue even if setup fails
    }

    this.isPrepared = true;
    return this.tmpDir;
  }

  /**
   * Check if test apps are already prepared
   * @returns true if test apps are prepared, false otherwise
   */
  isTestAppsPrepared(): boolean {
    // Check if environment variables are set first
    if (process.env.WDIO_TEST_APPS_PREPARED === 'true' && process.env.WDIO_TEST_APPS_DIR) {
      try {
        // Verify that the directory actually exists
        const stats = fs.statSync(process.env.WDIO_TEST_APPS_DIR);
        if (stats.isDirectory()) {
          // Update instance variables to match environment variables
          this.tmpDir = process.env.WDIO_TEST_APPS_DIR;
          this.isPrepared = true;
          return true;
        }
      } catch (error) {
        // If there's an error (e.g., directory doesn't exist), fall back to instance check
        console.error(`Error checking WDIO_TEST_APPS_DIR: ${error}`);
      }
    }

    // Fall back to instance variables
    return this.isPrepared && this.tmpDir !== null;
  }

  /**
   * Get the temporary directory where test apps are prepared
   * @returns The temporary directory path or null if not prepared
   */
  getTmpDir(): string | null {
    return this.tmpDir;
  }

  async cleanup(): Promise<void> {
    // Check if we should preserve the temp directory
    if (process.env.PRESERVE_TEMP_DIR === 'true') {
      console.log(`Preserving temp directory: ${this.tmpDir} for reuse`);
      return;
    }

    // First try the directory from the environment variable
    if (process.env.WDIO_TEST_APPS_DIR && process.env.WDIO_TEST_APPS_PREPARED === 'true') {
      try {
        console.log(`Cleaning up environment-specified temp directory: ${process.env.WDIO_TEST_APPS_DIR}`);
        await rm(process.env.WDIO_TEST_APPS_DIR, { recursive: true, force: true });
        console.log('Environment-specified temp directory cleanup completed successfully');

        // Clear environment variables
        process.env.WDIO_TEST_APPS_PREPARED = 'false';
        process.env.WDIO_TEST_APPS_DIR = '';
      } catch (error) {
        console.error('Failed to cleanup environment-specified temp directory:', error);
      }
    }

    // Then try the instance variable
    if (this.tmpDir) {
      try {
        console.log(`Cleaning up temp directory: ${this.tmpDir}`);
        await rm(this.tmpDir, { recursive: true, force: true });
        console.log('Temp directory cleanup completed successfully');
      } catch (error) {
        console.error('Failed to cleanup temp directory:', error);
      }

      // Even if cleanup fails, reset the state
      this.tmpDir = null;
      this.isPrepared = false;
    } else {
      console.log('No temp directory to clean up');
    }
  }

  /**
   * Clean up all temporary directories created by the test runner
   * This is useful for cleaning up after crashes or interrupted tests
   */
  static async cleanupAllTempDirs(): Promise<void> {
    try {
      // Check if environment has WDIO_TEST_APPS_DIR set
      if (process.env.WDIO_TEST_APPS_DIR && process.env.WDIO_TEST_APPS_PREPARED === 'true') {
        console.log(`Found prepared test apps directory: ${process.env.WDIO_TEST_APPS_DIR}`);

        // If PRESERVE_TEMP_DIR is set, don't clean up
        if (process.env.PRESERVE_TEMP_DIR === 'true') {
          console.log(`Preserving test apps directory as PRESERVE_TEMP_DIR=true`);
          return;
        }

        // Try to clean up the specific directory
        try {
          console.log(`Removing prepared test apps directory: ${process.env.WDIO_TEST_APPS_DIR}`);
          await rm(process.env.WDIO_TEST_APPS_DIR, { recursive: true, force: true });
          console.log(`Successfully removed ${process.env.WDIO_TEST_APPS_DIR}`);

          // Clear environment variables
          process.env.WDIO_TEST_APPS_PREPARED = 'false';
          process.env.WDIO_TEST_APPS_DIR = '';

          return;
        } catch (error) {
          console.error(`Failed to remove prepared test apps directory:`, error);
          // Continue with the cleanup of other directories
        }
      }

      const tempDir = tmpdir();
      console.log(`Searching for test directories in ${tempDir}...`);

      // Use different commands based on platform
      let cmd: string;
      if (process.platform === 'win32') {
        cmd = `dir /b /s "${tempDir}" | findstr "wdio-e2e-"`;
      } else {
        // Redirect stderr to /dev/null to suppress "Operation not permitted" errors
        cmd = `find ${tempDir} -maxdepth 1 -name "wdio-e2e-*" -type d 2>/dev/null || true`;
      }

      let tempDirs: string[] = [];

      try {
        const { stdout } = await execAsync(cmd);

        if (stdout.trim()) {
          tempDirs = stdout.trim().split('\n').filter(Boolean);
        }
      } catch (_cmdError) {
        // If the command fails with a non-zero exit code (e.g., no matches found), continue with empty array
        console.log('No temporary directories found or error listing directories');
      }

      if (tempDirs.length === 0) {
        console.log('No temporary test directories found.');
        return;
      }

      console.log(`Found ${tempDirs.length} temporary test directories to clean up.`);

      for (const dir of tempDirs) {
        try {
          // Skip cleaning if it's the current test directory and PRESERVE_TEMP_DIR is true
          if (process.env.WDIO_TEST_APPS_DIR === dir && process.env.PRESERVE_TEMP_DIR === 'true') {
            console.log(`Preserving ${dir} as it's the current test directory and PRESERVE_TEMP_DIR=true`);
            continue;
          }

          console.log(`Removing ${dir}...`);
          await rm(dir, { recursive: true, force: true });
          console.log(`Successfully removed ${dir}`);
        } catch (error) {
          console.error(`Failed to remove ${dir}:`, error);
        }
      }

      console.log('Temporary directory cleanup completed.');
    } catch (error) {
      console.error('Error cleaning up temporary directories:', error);
    }
  }

  /**
   * Package the service and return the package filename
   * @param serviceDir Directory containing the service
   * @returns The name of the tarball file
   */
  private async packService(serviceDir: string): Promise<string> {
    try {
      const packageStartTime = Date.now();
      console.log(`[${new Date().toISOString()}] Starting service packing`);
      console.log(`Running pnpm pack in directory: ${serviceDir}`);
      console.log(`Service directory exists: ${fs.existsSync(serviceDir)}`);

      const { stdout: packOutput } = await execAsync('pnpm pack', {
        cwd: serviceDir,
      });

      const packageEndTime = Date.now();
      console.log(
        `[${new Date().toISOString()}] Service packing completed in ${((packageEndTime - packageStartTime) / 1000).toFixed(2)}s`,
      );
      console.log(`pnpm pack output: ${packOutput}`);

      // Extract just the filename from the output
      // The last line of the output should be the tarball filename
      const packageFileName =
        packOutput
          .split('\n')
          .filter((line) => line.trim() && line.endsWith('.tgz'))
          .pop() || '';
      console.log(`Package filename: ${packageFileName}`);

      if (!packageFileName) {
        throw new Error('Failed to extract package filename from pnpm pack output');
      }

      // Verify the tarball exists
      const packagePath = join(serviceDir, packageFileName);
      try {
        await fs.promises.access(packagePath, fs.constants.F_OK);
        console.log(`Verified tarball exists at: ${packagePath}`);
      } catch (error) {
        console.error(`Tarball not found at ${packagePath}:`, error);
        throw new Error(`Tarball not found at ${packagePath}`);
      }

      // Move the package directly to the temp directory to avoid long paths
      const tempPackagePath = join(this.tmpDir!, packageFileName);
      try {
        // Use fs.promises.copyFile instead of rename to avoid issues if the file is in use
        await fs.promises.copyFile(packagePath, tempPackagePath);
        console.log(`Copied tarball to: ${tempPackagePath}`);

        // Verify the copy was successful
        await fs.promises.access(tempPackagePath, fs.constants.F_OK);
        console.log(`Verified tarball copy exists at: ${tempPackagePath}`);
      } catch (copyError: unknown) {
        console.error(`Error copying tarball:`, copyError);
        throw new Error(
          `Failed to copy tarball: ${copyError instanceof Error ? copyError.message : String(copyError)}`,
        );
      }

      return packageFileName;
    } catch (packError) {
      console.error('Error during service packing:');
      console.error(packError);
      throw packError;
    }
  }
}

export const testAppsManager = TestAppsManager.getInstance();

// Add a static method to the exported object for convenience
export const cleanupAllTempDirs = TestAppsManager.cleanupAllTempDirs;
