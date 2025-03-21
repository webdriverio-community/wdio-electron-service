import { mkdtemp, readFile, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
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

    if (this.tmpDir) {
      this.isPrepared = true;
      return this.tmpDir;
    }

    const serviceDir = join(process.cwd(), '..', 'packages', 'wdio-electron-service');
    const appsDir = join(process.cwd(), '..', 'apps');

    // 1. Create temp directory first with a shorter path
    console.log('Creating temp directory');
    // Use a shorter prefix to avoid path length issues
    this.tmpDir = await mkdtemp(join(tmpdir(), 'wdio-e2e-'));

    // 2. Package the service
    console.log('Packing service');
    const { stdout: packOutput } = await execAsync('pnpm pack', {
      cwd: serviceDir,
    });

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
    const tempPackagePath = join(this.tmpDir, packageFileName);
    try {
      // Use fs.promises.copyFile instead of rename to avoid issues if the file is in use
      await fs.promises.copyFile(packagePath, tempPackagePath);
      console.log(`Copied tarball to: ${tempPackagePath}`);

      // Verify the copy was successful
      await fs.promises.access(tempPackagePath, fs.constants.F_OK);
      console.log(`Verified tarball copy exists at: ${tempPackagePath}`);
    } catch (copyError: unknown) {
      console.error(`Error copying tarball:`, copyError);
      throw new Error(`Failed to copy tarball: ${copyError instanceof Error ? copyError.message : String(copyError)}`);
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
    if (this.tmpDir) {
      try {
        console.log(`Cleaning up temp directory: ${this.tmpDir}`);
        await rm(this.tmpDir, { recursive: true, force: true });
        this.tmpDir = null;
        this.isPrepared = false;
        console.log('Temp directory cleanup completed successfully');
      } catch (error) {
        console.error('Failed to cleanup temp directory:', error);
        // Even if cleanup fails, reset the state
        this.tmpDir = null;
        this.isPrepared = false;
      }
    }
  }

  /**
   * Clean up all temporary directories created by the test runner
   * This is useful for cleaning up after crashes or interrupted tests
   */
  static async cleanupAllTempDirs(): Promise<void> {
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

      let tempDirs: string[] = [];

      try {
        const { stdout } = await execAsync(cmd);

        // Extract directory names from ls output
        if (process.platform !== 'win32') {
          const lines = stdout.trim().split('\n').filter(Boolean);
          tempDirs = lines.map((line) => {
            const parts = line.trim().split(/\s+/);
            const dirName = parts[parts.length - 1];
            return `${tempDir}/${dirName}`;
          });
        } else {
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
          console.log(`Removing ${dir}...`);
          await rm(dir, { recursive: true, force: true });
        } catch (error) {
          console.error(`Failed to remove ${dir}:`, error);
        }
      }

      console.log('All temporary directories cleaned up.');
    } catch (error) {
      console.error('Error cleaning up temporary directories:', error);
    }
  }
}

export const testAppsManager = TestAppsManager.getInstance();

// Add a static method to the exported object for convenience
export const cleanupAllTempDirs = TestAppsManager.cleanupAllTempDirs;
