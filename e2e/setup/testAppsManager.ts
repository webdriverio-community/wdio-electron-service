import { mkdtemp, readFile, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import * as path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

class TestAppsManager {
  private static instance: TestAppsManager;
  private tmpDir: string | null = null;
  private cleanupRegistered = false;
  private isPrepared = false;
  private _currentPhase: string | null = null;
  private _lastCompletedPhase: string | null = null;
  private _currentOperation: string | null = null;

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

        // Linux-specific diagnostics to help troubleshoot SIGTERM issues
        if (process.platform === 'linux' && signal === 'SIGTERM') {
          console.log('************* LINUX SIGTERM DIAGNOSTIC INFO *************');
          console.log(`Process ${process.pid} terminating due to SIGTERM at ${new Date().toISOString()}`);

          // Print the current phase of execution
          console.log(`Current execution phase: ${this._currentPhase || 'unknown'}`);
          console.log(`Last completed phase: ${this._lastCompletedPhase || 'none'}`);
          console.log(`Current operation: ${this._currentOperation || 'unknown'}`);

          // Memory usage details
          const memoryUsage = process.memoryUsage();
          console.log('Memory usage at termination:');
          console.log(`- RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
          console.log(`- Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
          console.log(`- Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);

          // Try to get system memory info on Linux
          try {
            console.log('System memory:');
            const memInfo = execSync('free -m').toString();
            console.log(memInfo);
          } catch (_err) {
            console.log('Could not get system memory info');
          }

          // Log active processes
          try {
            console.log('Top processes by memory usage:');
            console.log(execSync('ps aux --sort=-%mem | head -10').toString());
          } catch (_err) {
            console.log('Could not get top processes');
          }

          console.log('************* LINUX SIGTERM DIAGNOSTIC INFO END *************');
        }

        try {
          // Allow more time for cleanup on Linux
          const timeoutMs = process.platform === 'linux' ? 20000 : 10000;
          const cleanupPromise = this.cleanup();

          // Set up a timeout that resolves after the specified time
          const timeoutPromise = new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              console.log(`Cleanup timeout reached after ${timeoutMs}ms`);
              resolve();
            }, timeoutMs);
            timeout.unref(); // Don't prevent process exit
          });

          // Race the cleanup and timeout, but don't throw if cleanup takes too long
          await Promise.race([cleanupPromise, timeoutPromise]);
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }

        // For Linux, delay exit slightly to allow for pending operations
        if (process.platform === 'linux') {
          console.log('Delaying exit on Linux to allow for cleanup completion...');
          setTimeout(() => {
            // Exit with non-zero code for errors
            if (signal === 'uncaughtException' || signal === 'unhandledRejection') {
              process.exit(1);
            } else if (signal === 'SIGTERM') {
              process.exit(143); // Standard SIGTERM exit code
            } else {
              process.exit(0);
            }
          }, 500);
        } else {
          // Exit with non-zero code for errors
          if (signal === 'uncaughtException' || signal === 'unhandledRejection') {
            process.exit(1);
          } else if (signal === 'SIGTERM') {
            process.exit(143); // Standard SIGTERM exit code
          } else {
            process.exit(0);
          }
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
    const scenarioEnv = process.env.SCENARIO || process.env.PLATFORM;
    const moduleTypeEnv = process.env.MODULE_TYPE;

    let scenarios = [...allScenarios];
    let moduleTypes = [...allModuleTypes];

    // If scenario/platform is specified, use only those scenarios
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
    // Add tracking properties to track where in the process we are
    this._currentPhase = 'init';
    this._lastCompletedPhase = null;
    this._currentOperation = 'starting';

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
      this._currentPhase = step;
      const now = Date.now();
      const elapsed = now - (timings.last || startTime);
      timings[step] = elapsed;
      timings.last = now;
      console.log(`Step "${step}" completed in ${(elapsed / 1000).toFixed(2)}s`);
      console.log(`Memory usage after "${step}": RSS=${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
      this._lastCompletedPhase = step;
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
    this._currentOperation = 'creating temp directory';
    console.log('Creating temp directory');
    // Use a shorter prefix to avoid path length issues
    this.tmpDir = await mkdtemp(join(tmpdir(), 'wdio-e2e-'));
    console.log(`Created temp directory: ${this.tmpDir}`);
    timeStep('create_temp_dir');

    // 2. Obtain the service package
    this._currentOperation = 'setting up service package';
    console.log('Setting up service package');
    console.log('Environment variables for package detection:');
    console.log(`- USE_ARTIFACT_SERVICE: ${process.env.USE_ARTIFACT_SERVICE || 'not set'}`);
    console.log(`- SKIP_SERVICE_PACKING: ${process.env.SKIP_SERVICE_PACKING || 'not set'}`);
    console.log(`- WDIO_SERVICE_TARBALL: ${process.env.WDIO_SERVICE_TARBALL || 'not set'}`);

    let packageFileName: string;

    try {
      // Check if we should use a pre-built artifact
      if (process.env.USE_ARTIFACT_SERVICE === 'true' && process.env.WDIO_SERVICE_TARBALL) {
        this._currentOperation = 'using pre-built service artifact';
        console.log(`Using pre-built service from: ${process.env.WDIO_SERVICE_TARBALL}`);

        const sourceTarball = process.env.WDIO_SERVICE_TARBALL;
        packageFileName = path.basename(sourceTarball);

        // Verify the tarball exists
        try {
          this._currentOperation = 'verifying tarball exists';
          await fs.promises.access(sourceTarball, fs.constants.F_OK);
          console.log(`Verified tarball exists at: ${sourceTarball}`);

          // Copy the tarball to the temp directory
          this._currentOperation = 'copying tarball to temp directory';
          const tempPackagePath = join(this.tmpDir, packageFileName);
          try {
            await fs.promises.copyFile(sourceTarball, tempPackagePath);
            console.log(`Copied tarball to: ${tempPackagePath}`);

            // Verify the copy was successful
            this._currentOperation = 'verifying tarball copy';
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
          this._currentOperation = 'falling back to packaging service';
          packageFileName = await this.packService(serviceDir);
        }
      } else {
        // Package the service on demand
        this._currentOperation = 'packaging service on demand';
        packageFileName = await this.packService(serviceDir);
      }
    } catch (servicePackageError) {
      console.error('Error preparing service package:', servicePackageError);
      throw new Error(
        `Failed to prepare service package: ${
          servicePackageError instanceof Error ? servicePackageError.message : String(servicePackageError)
        }`,
      );
    }

    // 3. Copy apps
    this._currentPhase = 'copying_apps';
    this._currentOperation = 'setting up app directories';
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
      this._currentOperation = `copying app directory: ${appDir}`;
      const sourceAppDir = join(appsDir, appDir);
      const targetAppDir = join(this.tmpDir, 'apps', appDir);

      if (!fs.existsSync(sourceAppDir)) {
        console.warn(`Warning: source app directory ${appDir} not found, skipping`);
        continue;
      }

      // Build the app first
      this._currentOperation = `building app: ${appDir}`;
      console.log(`Building app: ${appDir}`);
      try {
        // Run the build command
        await execAsync('pnpm run build', { cwd: sourceAppDir });
        console.log(`Successfully built ${appDir}`);
      } catch (buildError) {
        console.error(`Error building ${appDir}:`, buildError);
        throw new Error(
          `Failed to build ${appDir}: ${buildError instanceof Error ? buildError.message : String(buildError)}`,
        );
      }

      // Ensure the dist directory exists in the source app
      const distDir = join(sourceAppDir, 'dist');
      const outDir = join(sourceAppDir, 'out');
      const hasDistDir = fs.existsSync(distDir);
      const hasOutDir = fs.existsSync(outDir);

      if (!hasDistDir && !hasOutDir) {
        console.warn(`Warning: neither dist nor out directory found in ${appDir}. The app may not be built.`);
      } else {
        if (hasDistDir) {
          console.log(`Found dist directory in ${appDir}`);
        }
        if (hasOutDir) {
          console.log(`Found out directory in ${appDir}`);
        }
      }

      // Create the target app directory
      await this.createDirectory(targetAppDir);

      // Use cp -R with the --preserve=all flag to ensure all file attributes are preserved
      // Copy all files and directories except node_modules to avoid large copies
      console.log(`Copying ${appDir} to ${targetAppDir}...`);

      try {
        // Copy package.json and other files in the root directory
        this._currentOperation = `copying package.json for ${appDir}`;
        await execAsync(`cp -R ${sourceAppDir}/package.json ${targetAppDir}/`);

        // Copy the src directory if it exists
        if (fs.existsSync(join(sourceAppDir, 'src'))) {
          this._currentOperation = `copying src directory for ${appDir}`;
          await execAsync(`cp -R ${sourceAppDir}/src ${targetAppDir}/`);
        }

        // Copy the dist directory if it exists - this is critical for the tests
        if (fs.existsSync(distDir)) {
          this._currentOperation = `copying dist directory for ${appDir}`;
          console.log(`Copying dist directory for ${appDir}...`);

          // Create the dist directory in the target app
          const targetDistDir = join(targetAppDir, 'dist');
          await this.createDirectory(targetDistDir);

          // Special handling for Mac app bundles
          const macArmDir = join(distDir, 'mac-arm64');
          if (fs.existsSync(macArmDir)) {
            // Create the mac-arm64 directory in target
            const targetMacArmDir = join(targetDistDir, 'mac-arm64');
            await this.createDirectory(targetMacArmDir);
            console.log(`Created mac-arm64 directory in ${targetDistDir}`);

            // Find app bundles in mac-arm64 directory
            const items = fs.readdirSync(macArmDir);
            const appBundles = items.filter((item) => item.endsWith('.app'));

            if (appBundles.length > 0) {
              for (const appBundle of appBundles) {
                const sourceAppBundle = join(macArmDir, appBundle);
                const targetAppBundle = join(targetMacArmDir, appBundle);

                console.log(`Copying ${appBundle} using preserving command...`);

                // Use platform-specific command to preserve permissions and structure
                if (process.platform === 'darwin' || process.platform === 'linux') {
                  try {
                    // Use ditto on macOS for better preservation of bundle attributes
                    if (process.platform === 'darwin') {
                      await execAsync(`ditto "${sourceAppBundle}" "${targetAppBundle}"`);
                    } else {
                      await execAsync(`cp -R "${sourceAppBundle}" "${targetAppBundle}"`);
                    }
                    console.log(`Successfully copied ${appBundle} to ${targetMacArmDir}`);

                    // Make sure the app binary is executable
                    const appName = appBundle.replace('.app', '');
                    const appExecutable = join(targetAppBundle, 'Contents/MacOS', appName);
                    if (fs.existsSync(appExecutable)) {
                      await execAsync(`chmod +x "${appExecutable}"`);
                      console.log(`Made app executable: ${appExecutable}`);
                    }
                  } catch (err) {
                    console.warn(`Error copying app bundle ${appBundle}:`, err);
                  }
                } else if (process.platform === 'win32') {
                  try {
                    await execAsync(`xcopy "${sourceAppBundle}" "${targetAppBundle}" /E /H /C /I`);
                    console.log(`Successfully copied ${appBundle} to ${targetMacArmDir}`);
                  } catch (err) {
                    console.warn(`Error copying app bundle ${appBundle}:`, err);
                  }
                }
              }
            } else {
              console.warn(`No .app bundles found in ${macArmDir}`);
            }
          }

          // Copy remaining files in the dist directory (excluding mac-arm64 which was handled above)
          const distFiles = fs.readdirSync(distDir);
          for (const file of distFiles) {
            if (file === 'mac-arm64') continue; // Skip, already handled above

            const sourcePath = join(distDir, file);
            const targetPath = join(targetDistDir, file);

            if (fs.statSync(sourcePath).isDirectory()) {
              try {
                await execAsync(`cp -R "${sourcePath}" "${targetDistDir}/"`);
              } catch (err) {
                console.warn(`Error copying directory ${file}:`, err);
              }
            } else {
              try {
                await fs.promises.copyFile(sourcePath, targetPath);
              } catch (err) {
                console.warn(`Error copying file ${file}:`, err);
              }
            }
          }

          console.log(`Successfully copied dist directory for ${appDir}`);

          // Verify files in dist directory
          if (fs.existsSync(targetDistDir)) {
            try {
              const distFiles = fs.readdirSync(targetDistDir);
              console.log(`Copied dist directory for ${appDir} with ${distFiles.length} files/directories`);

              // For binary apps, check if we have the binary properly copied
              if (appDir.startsWith('builder-') || appDir.startsWith('forge-')) {
                // ... existing code ...
              }
            } catch (error) {
              console.error('Error verifying dist directory:', error);
            }
          } else {
            console.error(`Error: dist directory not created for ${appDir}`);
          }
        }

        // Copy the out directory for forge apps if it exists
        if (fs.existsSync(outDir)) {
          this._currentOperation = `copying out directory for ${appDir}`;
          console.log(`Copying out directory for ${appDir}...`);

          // Create the out directory in the target app
          const targetOutDir = join(targetAppDir, 'out');
          await this.createDirectory(targetOutDir);

          // Get all items in the out directory
          const outItems = fs.readdirSync(outDir);

          for (const item of outItems) {
            const sourceItemPath = join(outDir, item);
            const targetItemPath = join(targetOutDir, item);

            if (fs.statSync(sourceItemPath).isDirectory()) {
              // If it's a directory, check if it contains a .app bundle (macOS)
              const isDarwinAppDir =
                item.includes('darwin') &&
                fs.existsSync(join(sourceItemPath, `${appDir.split('-')[0]}-${appDir.split('-')[1]}.app`));

              if (isDarwinAppDir) {
                // Special handling for macOS app bundles
                await this.createDirectory(targetItemPath);

                // Get the app bundle name
                const appName = `${appDir.split('-')[0]}-${appDir.split('-')[1]}`;
                const appBundleName = `${appName}.app`;
                const sourceAppBundle = join(sourceItemPath, appBundleName);
                const targetAppBundle = join(targetItemPath, appBundleName);

                console.log(`Copying ${appBundleName} from ${item} directory...`);

                // Use platform-specific command to preserve permissions and structure
                if (process.platform === 'darwin') {
                  try {
                    await execAsync(`ditto "${sourceAppBundle}" "${targetAppBundle}"`);
                    console.log(`Successfully copied ${appBundleName} to ${targetItemPath}`);

                    // Make sure the app binary is executable
                    const appExecutable = join(targetAppBundle, 'Contents/MacOS', appName);
                    if (fs.existsSync(appExecutable)) {
                      await execAsync(`chmod +x "${appExecutable}"`);
                      console.log(`Made app executable: ${appExecutable}`);
                    }
                  } catch (err) {
                    console.warn(`Error copying app bundle ${appBundleName}:`, err);
                  }
                } else {
                  // For non-macOS platforms, just copy the directory
                  try {
                    await execAsync(`cp -R "${sourceItemPath}" "${targetOutDir}/"`);
                  } catch (err) {
                    console.warn(`Error copying directory ${item}:`, err);
                  }
                }
              } else {
                // For regular directories, just copy them
                try {
                  await execAsync(`cp -R "${sourceItemPath}" "${targetOutDir}/"`);
                } catch (err) {
                  console.warn(`Error copying directory ${item}:`, err);
                }
              }
            } else {
              // For regular files, just copy them
              try {
                await fs.promises.copyFile(sourceItemPath, targetItemPath);
              } catch (err) {
                console.warn(`Error copying file ${item}:`, err);
              }
            }
          }

          console.log(`Successfully copied out directory for ${appDir}`);

          // Verify files in out directory
          if (fs.existsSync(targetOutDir)) {
            try {
              const outFiles = fs.readdirSync(targetOutDir);
              console.log(`Copied out directory for ${appDir} with ${outFiles.length} files/directories`);
            } catch (error) {
              console.error('Error verifying out directory:', error);
            }
          } else {
            console.error(`Error: out directory not created for ${appDir}`);
          }
        }

        // Copy other important files and directories
        this._currentOperation = `copying config files for ${appDir}`;
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
    this._currentOperation = 'creating workspace package.json';
    const workspacePackageJson = {
      name: 'wdio-electron-test-apps',
      version: '1.0.0',
      private: true,
    };
    await writeFile(join(this.tmpDir, 'apps', 'package.json'), JSON.stringify(workspacePackageJson, null, 2));

    // Verify the apps directory structure
    this._currentOperation = 'verifying apps directory structure';
    console.log('Verifying apps directory structure');
    try {
      const { stdout: lsOutput } = await execAsync(`ls -la ${join(this.tmpDir, 'apps')}`);
      console.log('Apps directory contents:', lsOutput);
    } catch (error) {
      console.error('Error verifying apps directory:', error);
    }

    // 4. Update each app's package.json
    this._currentPhase = 'updating_package_jsons';
    console.log('Updating package.jsons');

    for (const appDir of appDirsToCopy) {
      this._currentOperation = `updating package.json for ${appDir}`;
      const appPath = join(this.tmpDir, 'apps', appDir);
      const packageJsonPath = join(appPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

      // Use a relative path that's shorter
      packageJson.dependencies['wdio-electron-service'] = `../../${packageFileName}`;

      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    // 5. Install dependencies
    this._currentPhase = 'installing_dependencies';
    this._currentOperation = 'running pnpm install';
    console.log('Installing dependencies');
    await execAsync('pnpm install --no-lockfile', { cwd: join(this.tmpDir, 'apps') });
    timeStep('install_dependencies');

    // 6. Create a symlink to the wdio-electron-service package in node_modules
    // This helps with module resolution in ESM mode
    this._currentPhase = 'creating_service_symlink';
    this._currentOperation = 'preparing wdio-electron-service symlink';
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
        this._currentOperation = 'extracting service tarball';
        console.log(`Using pre-built service from tarball: ${process.env.WDIO_SERVICE_TARBALL}`);

        // Create the service directory
        const serviceDir = join(nodeModulesDir, 'wdio-electron-service');
        console.log(`About to create service directory: ${serviceDir}`);
        await this.createDirectory(serviceDir);

        // Use pnpx pacote to extract the tarball - this is the most reliable option across platforms
        console.log(`Extracting tarball using pnpx pacote...`);
        try {
          // Normalize path for Windows
          const tarballPath = process.env.WDIO_SERVICE_TARBALL.replace(/\\/g, '/');

          // Log before extraction
          console.log(`About to extract tarball at path: ${tarballPath}`);
          console.log(`Target extract directory: ${serviceDir}`);
          console.log(`Current operation: ${this._currentOperation}`);
          console.log(`Current memory usage: RSS=${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

          // Log command being executed
          const extractCmd = `pnpx pacote extract "${tarballPath}" "${serviceDir}"`;
          console.log(`Executing extract command: ${extractCmd}`);

          // Add a timestamp before starting extraction
          console.log(`Starting extraction at: ${new Date().toISOString()}`);

          this._currentOperation = 'executing pacote extract';
          await execAsync(extractCmd);

          // Add a timestamp after extraction completes
          console.log(`Extraction completed at: ${new Date().toISOString()}`);
          console.log(`Successfully extracted tarball to ${serviceDir}`);

          // Verify the extraction was successful
          this._currentOperation = 'verifying extraction success';
          const distDir = join(serviceDir, 'dist');
          if (fs.existsSync(distDir)) {
            console.log(`Verified dist directory exists at: ${distDir}`);

            // List contents to confirm
            try {
              const { stdout } = await execAsync(
                process.platform === 'win32' ? `dir "${distDir}"` : `ls -la "${distDir}"`,
              );
              console.log(`Directory contents: ${stdout}`);
            } catch (lsError) {
              console.error('Error listing directory:', lsError);
            }
          } else {
            console.error(`Error: dist directory not found at ${distDir}`);
            this._currentOperation = 'searching for dist directory';

            // Try to find the correct dist directory structure
            console.log('Searching for dist directory in extracted contents...');
            try {
              const { stdout: findOutput } = await execAsync(
                process.platform === 'win32'
                  ? `dir /s /b "${serviceDir}\\dist"`
                  : `find "${serviceDir}" -name "dist" -type d`,
              );

              if (findOutput.trim()) {
                console.log(`Found potential dist directories: ${findOutput}`);

                // If we find a package/dist directory, move it up to the correct location
                const packageDistDirs = findOutput
                  .trim()
                  .split('\n')
                  .filter((dir) => dir.includes('package/dist'));
                if (packageDistDirs.length > 0) {
                  this._currentOperation = 'moving dist directory to correct location';
                  console.log(`Found package/dist at ${packageDistDirs[0]}, moving to correct location...`);
                  await execAsync(`cp -r "${packageDistDirs[0]}" "${serviceDir}/"`);

                  // Check if the move was successful
                  if (fs.existsSync(distDir)) {
                    console.log(`Successfully moved dist directory to ${distDir}`);
                  } else {
                    console.error(`Failed to move dist directory to ${distDir}`);
                  }
                }
              } else {
                console.log('No dist directory found in extracted contents');
              }
            } catch (findError) {
              console.error('Error searching for dist directory:', findError);
            }

            throw new Error(`Extraction failed: dist directory not found`);
          }
        } catch (extractError) {
          console.error('Error extracting tarball:', extractError);
          throw new Error(
            `Failed to extract tarball: ${extractError instanceof Error ? extractError.message : String(extractError)}`,
          );
        }
      } else {
        // Build the package to ensure the dist directory exists
        this._currentOperation = 'building wdio-electron-service package';
        try {
          console.log('Building wdio-electron-service package to ensure dist directory exists');
          const packageDir = join(process.cwd(), '..', 'packages', 'wdio-electron-service');
          await execAsync('pnpm build', { cwd: packageDir });
          console.log('Successfully built wdio-electron-service package');

          // Create a symlink to the package directory
          this._currentOperation = 'creating symlink to package directory';
          const wdioServicePath = join(nodeModulesDir, 'wdio-electron-service');
          try {
            // Remove existing symlink if it exists
            if (fs.existsSync(wdioServicePath)) {
              await fs.promises.unlink(wdioServicePath);
            }
            // Create a new symlink
            await fs.promises.symlink(packageDir, wdioServicePath, 'junction');
            console.log(`Created symlink from ${packageDir} to ${wdioServicePath}`);

            // For standalone mode, ensure service dependencies are available
            if (process.env.STANDALONE === 'true') {
              this._currentOperation = 'setting up service dependencies';
              console.log('Setting up service dependencies for standalone mode');

              // Create the service's node_modules directory
              const serviceNodeModules = join(wdioServicePath, 'node_modules');
              await fs.promises.mkdir(serviceNodeModules, { recursive: true });

              // Copy dependencies from the service package's node_modules
              const sourceNodeModules = join(packageDir, 'node_modules');
              const dependencies = [
                'read-package-up',
                'read-pkg',
                'read-pkg-up',
                'pkg-up',
                'find-up',
                'locate-path',
                'path-exists',
              ];

              for (const dep of dependencies) {
                const sourceDep = join(sourceNodeModules, dep);
                const targetDep = join(serviceNodeModules, dep);

                if (fs.existsSync(sourceDep)) {
                  console.log(`Copying dependency: ${dep}`);
                  await this.copyDir(sourceDep, targetDep);
                } else {
                  console.warn(`Warning: dependency ${dep} not found in source node_modules`);
                }
              }

              console.log('Successfully set up service dependencies');
            }
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

    timeStep('finish_setup');
    this._currentPhase = 'completed';
    this._currentOperation = 'done';

    this.isPrepared = true;
    return this.tmpDir;
  }

  private async copyDir(src: string, dest: string) {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
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

          // On Linux, use a more gradual approach to avoid resource spikes
          if (process.platform === 'linux') {
            try {
              // First try to remove the largest subdirectories individually
              const appsDir = join(process.env.WDIO_TEST_APPS_DIR, 'apps');
              if (fs.existsSync(appsDir)) {
                console.log('Cleaning up apps subdirectory first...');
                await rm(appsDir, { recursive: true, force: true });
                console.log('Apps subdirectory removed');
              }

              const nodeModulesDir = join(process.env.WDIO_TEST_APPS_DIR, 'node_modules');
              if (fs.existsSync(nodeModulesDir)) {
                console.log('Cleaning up node_modules subdirectory...');
                await rm(nodeModulesDir, { recursive: true, force: true });
                console.log('node_modules subdirectory removed');
              }
            } catch (subDirError) {
              console.error('Error removing subdirectories:', subDirError);
              // Continue to full directory removal
            }
          }

          // Now remove the entire directory
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

      // On Linux, process fewer directories at once and add delays
      const batchSize = process.platform === 'linux' ? 2 : tempDirs.length;
      const delayMs = process.platform === 'linux' ? 1000 : 0;

      for (let i = 0; i < tempDirs.length; i += batchSize) {
        const batch = tempDirs.slice(i, i + batchSize);

        // Process batch concurrently
        await Promise.all(
          batch.map(async (dir) => {
            try {
              // Skip cleaning if it's the current test directory and PRESERVE_TEMP_DIR is true
              if (process.env.WDIO_TEST_APPS_DIR === dir && process.env.PRESERVE_TEMP_DIR === 'true') {
                console.log(`Preserving ${dir} as it's the current test directory and PRESERVE_TEMP_DIR=true`);
                return;
              }

              console.log(`Removing ${dir}...`);

              // On Linux, use a more gradual approach
              if (process.platform === 'linux') {
                // First try to remove the largest subdirectories individually
                try {
                  const appsDir = join(dir, 'apps');
                  if (fs.existsSync(appsDir)) {
                    await rm(appsDir, { recursive: true, force: true });
                  }

                  const nodeModulesDir = join(dir, 'node_modules');
                  if (fs.existsSync(nodeModulesDir)) {
                    await rm(nodeModulesDir, { recursive: true, force: true });
                  }
                } catch (subDirError) {
                  console.error(`Error removing subdirectories in ${dir}:`, subDirError);
                  // Continue to full directory removal
                }
              }

              await rm(dir, { recursive: true, force: true });
              console.log(`Successfully removed ${dir}`);
            } catch (error) {
              console.error(`Failed to remove ${dir}:`, error);
            }
          }),
        );

        // Add delay between batches on Linux
        if (delayMs > 0 && i + batchSize < tempDirs.length) {
          console.log(`Pausing for ${delayMs}ms before next cleanup batch...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
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

      // Log system resources before packing
      if (process.platform === 'linux') {
        try {
          console.log('System resources before packing:');
          const memInfo = execSync('free -m').toString();
          console.log(memInfo);
        } catch (_err) {
          console.log('Could not get system memory info');
        }
      }

      // For Linux, adjust timeout and run with reduced priority to avoid OOM killer
      let packCommand = 'pnpm pack';
      if (process.platform === 'linux') {
        // Use nice to reduce priority
        packCommand = 'nice -n 10 pnpm pack';
        console.log('Using nice command on Linux to reduce process priority');
      }

      // Set up a timeout for the packing process to prevent hanging
      // Longer timeout on Linux because of resource constraints
      const timeoutMs = process.platform === 'linux' ? 300000 : 120000; // 5 mins on Linux, 2 mins elsewhere
      const timeoutPromise = new Promise<{ stdout: string }>((_, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Service packing timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);
        timeout.unref(); // Don't prevent process exit
      });

      console.log(`Pack command timeout set to ${timeoutMs / 1000} seconds`);

      // Run the packing command with a timeout
      const packPromise = execAsync(packCommand, { cwd: serviceDir });
      let packOutput: string;

      try {
        const result = await Promise.race([packPromise, timeoutPromise]);
        packOutput = result.stdout;
      } catch (error) {
        // If we timeout or have an error, try to get a pre-built package if available
        console.error('Error or timeout during packing:', error);
        if (process.env.WDIO_SERVICE_TARBALL) {
          console.log(`Attempting to use pre-built tarball as fallback: ${process.env.WDIO_SERVICE_TARBALL}`);
          const fallbackTarball = process.env.WDIO_SERVICE_TARBALL;
          const packageFileName = path.basename(fallbackTarball);

          try {
            // Verify the tarball exists
            await fs.promises.access(fallbackTarball, fs.constants.F_OK);

            // Copy to temp directory
            const tempPackagePath = join(this.tmpDir!, packageFileName);
            await fs.promises.copyFile(fallbackTarball, tempPackagePath);
            console.log(`Used fallback tarball: ${tempPackagePath}`);
            return packageFileName;
          } catch (fallbackError) {
            console.error('Error using fallback tarball:', fallbackError);
          }
        }

        throw new Error(`Service packing failed: ${error instanceof Error ? error.message : String(error)}`);
      }

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
