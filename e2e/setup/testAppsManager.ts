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

  // Add a new method to get apps to prepare based on environment variables
  getAppsToPrepare(): { scenarios: string[]; moduleTypes: string[] } {
    // Default is to prepare all apps
    const allScenarios = ['builder', 'forge', 'no-binary'];
    const allModuleTypes = ['cjs', 'esm'];

    // Check for environment variables that specify which apps to prepare
    const scenarioEnv = process.env.SCENARIO;
    const moduleTypeEnv = process.env.MODULE_TYPE;

    let scenarios = [...allScenarios];
    let moduleTypes = [...allModuleTypes];

    // If SCENARIO is specified, use only those scenarios
    if (scenarioEnv) {
      // Handle comma-separated list of scenarios
      const requestedScenarios = scenarioEnv.split(',').map((s) => s.trim());
      scenarios = requestedScenarios.filter((s) => allScenarios.includes(s));

      // If no valid scenarios were specified, fall back to all scenarios
      if (scenarios.length === 0) {
        console.log(`Warning: No valid scenarios found in "${scenarioEnv}", using all scenarios`);
        scenarios = [...allScenarios];
      } else {
        console.log(`Preparing only these scenarios: ${scenarios.join(', ')}`);
      }
    }

    // If MODULE_TYPE is specified, use only those module types
    if (moduleTypeEnv && moduleTypeEnv !== '*') {
      // Handle comma-separated list of module types
      const requestedModuleTypes = moduleTypeEnv.split(',').map((t) => t.trim());
      moduleTypes = requestedModuleTypes.filter((t) => allModuleTypes.includes(t));

      // If no valid module types were specified, fall back to all module types
      if (moduleTypes.length === 0) {
        console.log(`Warning: No valid module types found in "${moduleTypeEnv}", using all module types`);
        moduleTypes = [...allModuleTypes];
      } else {
        console.log(`Preparing only these module types: ${moduleTypes.join(', ')}`);
      }
    }

    return { scenarios, moduleTypes };
  }

  async prepareTestApps(): Promise<string> {
    // Register cleanup handlers when preparing test apps
    this.registerCleanupHandlers();

    // Log start time and memory usage
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Starting test apps preparation`);
    console.log(`Initial memory usage: RSS=${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

    // Determine which apps to prepare
    const { scenarios, moduleTypes } = this.getAppsToPrepare();
    console.log(`Will prepare apps for scenarios: ${scenarios.join(', ')}`);
    console.log(`Will prepare apps for module types: ${moduleTypes.join(', ')}`);

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
    console.log('Environment variables for package detection:');
    console.log(`- USE_ARTIFACT_SERVICE: ${process.env.USE_ARTIFACT_SERVICE || 'not set'}`);
    console.log(`- SKIP_SERVICE_PACKING: ${process.env.SKIP_SERVICE_PACKING || 'not set'}`);
    console.log(`- WDIO_SERVICE_TARBALL: ${process.env.WDIO_SERVICE_TARBALL || 'not set'}`);

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

    // Get the list of apps to prepare
    const { scenarios: prepareScenarios, moduleTypes: prepareModuleTypes } = this.getAppsToPrepare();

    // Generate the list of app directories to copy based on the scenarios and moduleTypes
    const appDirsToCopy: string[] = [];
    for (const scenario of prepareScenarios) {
      for (const moduleType of prepareModuleTypes) {
        appDirsToCopy.push(`${scenario}-${moduleType}`);
      }
    }

    console.log(
      `Selective app preparation: copying ${appDirsToCopy.length} app directories: ${appDirsToCopy.join(', ')}`,
    );

    // Copy each selected app directory individually to ensure proper structure
    for (const appDir of appDirsToCopy) {
      const sourceAppDir = join(appsDir, appDir);
      const targetAppDir = join(this.tmpDir, 'apps', appDir);

      if (!fs.existsSync(sourceAppDir)) {
        console.warn(`Warning: source app directory ${appDir} not found, skipping`);
        continue;
      }

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

    for (const appDir of appDirsToCopy) {
      const appPath = join(this.tmpDir, 'apps', appDir);
      const packageJsonPath = join(appPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

      // Use a relative path that's shorter
      packageJson.dependencies['wdio-electron-service'] = `../../${packageFileName}`;

      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    // 5. Install dependencies
    console.log('Installing dependencies');
    await execAsync('pnpm install --no-lockfile', { cwd: join(this.tmpDir, 'apps') });

    // 6. Create a symlink to the wdio-electron-service package in node_modules
    // This helps with module resolution in ESM mode
    console.log('Creating symlink for wdio-electron-service');
    try {
      const nodeModulesDir = join(this.tmpDir, 'apps', 'node_modules');

      // First, make sure the node_modules directory exists
      try {
        await this.createDirectory(nodeModulesDir);
        console.log(`Created node_modules directory at: ${nodeModulesDir}`);
      } catch (mkdirError) {
        console.error('Error creating node_modules directory:', mkdirError);
      }

      // Check if we're using a pre-built tarball
      if (process.env.USE_ARTIFACT_SERVICE === 'true' && process.env.WDIO_SERVICE_TARBALL) {
        console.log(`Using pre-built service from tarball: ${process.env.WDIO_SERVICE_TARBALL}`);

        // Extract the tarball directly to the node_modules directory
        try {
          const extractDir = join(nodeModulesDir, 'wdio-electron-service');
          await this.createDirectory(extractDir);
          console.log(`Created extraction directory: ${extractDir}`);

          // Normalize paths for Windows compatibility
          // Copy the tarball locally if on Windows to avoid path issues with tar command
          let tarballPath = process.env.WDIO_SERVICE_TARBALL;

          if (process.platform === 'win32' && tarballPath.includes('/')) {
            const localTarballPath = join(this.tmpDir!, 'wdio-electron-service-8.0.2.tgz');
            console.log(`Copying tarball to local path for Windows compatibility: ${localTarballPath}`);
            await fs.promises.copyFile(tarballPath, localTarballPath);
            tarballPath = localTarballPath;
          }

          // Use platform-specific command for extraction
          if (process.platform === 'win32') {
            // Use Windows built-in tar command (available in Windows 10+)
            console.log('Extracting using Windows tar command...');
            await execAsync(`tar -xf "${tarballPath}" -C "${extractDir}" --strip-components=1`);
            console.log(`Successfully extracted tarball to ${extractDir} using Windows tar`);
          } else {
            // On Unix-like systems, use tar command
            await execAsync(`tar -xzf "${tarballPath}" -C "${extractDir}" --strip-components=1`);
            console.log(`Successfully extracted tarball to ${extractDir} using tar`);
          }

          // Verify the extraction was successful by checking for key files
          const distDir = join(extractDir, 'dist');
          if (fs.existsSync(distDir)) {
            console.log(`Verified dist directory exists at ${distDir}`);
          } else {
            console.error(`Error: dist directory not found in extracted tarball at ${distDir}`);
            throw new Error(`Dist directory not found in extracted tarball at ${distDir}`);
          }
        } catch (extractError) {
          console.error('Error extracting tarball to node_modules:', extractError);
          throw new Error(
            `Failed to extract tarball: ${extractError instanceof Error ? extractError.message : String(extractError)}`,
          );
        }
      } else {
        // Build the package to ensure the dist directory exists
        try {
          console.log('Building wdio-electron-service package to ensure dist directory exists');
          const packageDir = join(process.cwd(), '..', 'packages', 'wdio-electron-service');
          await execAsync('pnpm build', { cwd: packageDir });
          console.log('Successfully built wdio-electron-service package');

          // Create a symlink to the package directory
          const wdioServicePath = join(nodeModulesDir, 'wdio-electron-service');
          try {
            // Remove existing symlink if it exists
            if (fs.existsSync(wdioServicePath)) {
              await fs.promises.unlink(wdioServicePath);
            }
            // Create a new symlink
            await fs.promises.symlink(packageDir, wdioServicePath, 'junction');
            console.log(`Created symlink from ${packageDir} to ${wdioServicePath}`);
          } catch (symlinkError) {
            console.error('Error creating symlink:', symlinkError);
            throw new Error(
              `Failed to create symlink: ${symlinkError instanceof Error ? symlinkError.message : String(symlinkError)}`,
            );
          }
        } catch (buildError) {
          console.error('Error building wdio-electron-service package:', buildError);
          throw new Error(
            `Failed to build package: ${buildError instanceof Error ? buildError.message : String(buildError)}`,
          );
        }
      }
    } catch (error) {
      console.error('Error setting up wdio-electron-service:', error);
      throw new Error(
        `Failed to set up wdio-electron-service: ${error instanceof Error ? error.message : String(error)}`,
      );
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
      // Check if we should skip service packing
      if (process.env.SKIP_SERVICE_PACKING === 'true' && process.env.WDIO_SERVICE_TARBALL) {
        console.log(`Skipping service packing as SKIP_SERVICE_PACKING=true`);
        console.log(`Using pre-packaged service from: ${process.env.WDIO_SERVICE_TARBALL}`);

        // Verify the tarball path is valid
        const sourceTarball = process.env.WDIO_SERVICE_TARBALL;
        if (!sourceTarball || !sourceTarball.endsWith('.tgz')) {
          console.error(`Invalid tarball path: ${sourceTarball}`);
          console.log(`Will fall back to packaging the service`);
        } else {
          const packageFileName = path.basename(sourceTarball);

          // Verify the tarball exists
          try {
            await fs.promises.access(sourceTarball, fs.constants.F_OK);
            console.log(`Verified tarball exists at: ${sourceTarball}`);

            // Copy the tarball to the temp directory
            const tempPackagePath = join(this.tmpDir!, packageFileName);
            try {
              await fs.promises.copyFile(sourceTarball, tempPackagePath);
              console.log(`Copied tarball to: ${tempPackagePath}`);

              // Verify the copy was successful
              await fs.promises.access(tempPackagePath, fs.constants.F_OK);
              console.log(`Verified tarball copy exists at: ${tempPackagePath}`);

              return packageFileName;
            } catch (copyError: unknown) {
              console.error(`Error copying tarball:`, copyError);
              console.log(`Will fall back to packaging the service`);
              // Fall through to regular packaging
            }
          } catch (error) {
            console.error(`Pre-packaged tarball not found at ${sourceTarball}:`, error);
            console.log(`Will fall back to packaging the service`);
            // Fall through to regular packaging
          }
        }
      }

      const packageStartTime = Date.now();
      console.log(`[${new Date().toISOString()}] Starting service packing`);
      console.log(`Running pnpm pack in directory: ${serviceDir}`);
      console.log(`Service directory exists: ${fs.existsSync(serviceDir)}`);

      // Set up a timeout for the packing process to prevent hanging
      const timeoutPromise = new Promise<{ stdout: string }>((_, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Service packing timed out after 2 minutes'));
        }, 120000); // 2 minutes timeout
        timeout.unref(); // Don't prevent process exit
      });

      // Run the packing command with a timeout
      const packPromise = execAsync('pnpm pack', { cwd: serviceDir });
      const { stdout: packOutput } = await Promise.race([packPromise, timeoutPromise]);

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
