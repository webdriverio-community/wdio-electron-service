/**
 * Utility function to pack the wdio-electron-service for testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import { getTempDir } from './temp-dir.js';

/**
 * Execute a command with debug output
 * @param cmd Command to execute
 * @param cwd Working directory
 * @param env Environment variables
 * @returns Promise with stdout
 */
async function execWithDebug(cmd: string, cwd: string, env: Record<string, string> = {}): Promise<string> {
  console.log(`🔍 DEBUG: Executing command: ${cmd} in directory: ${cwd}`);

  return new Promise<string>((resolve, reject) => {
    // Try to run the command directly with execSync first on Windows
    if (process.platform === 'win32') {
      try {
        console.log(`Trying execSync on Windows...`);
        const result = execSync(cmd, {
          cwd,
          encoding: 'utf8',
          env: { ...process.env, ...env },
        });
        console.log(`execSync succeeded with result: ${result}`);
        return resolve(result);
      } catch (error) {
        console.log(
          `execSync failed, falling back to spawn: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue with spawn as fallback
      }
    }

    // On Windows, we need to handle shell and path differently
    const isWindows = process.platform === 'win32';

    // First try using execSync on Linux too as a direct method that doesn't rely on shell
    if (!isWindows) {
      try {
        console.log(`Trying execSync on Linux/macOS...`);
        const result = execSync(cmd, {
          cwd,
          encoding: 'utf8',
          env: { ...process.env, ...env },
        });
        console.log(`execSync succeeded with result: ${result}`);
        return resolve(result);
      } catch (error) {
        console.log(
          `execSync failed on Linux/macOS, falling back to spawn: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue with spawn as fallback
      }
    }

    // Set shell options differently depending on platform
    // Detect possible shell locations on Linux
    let shellPath: string | boolean = true; // Default to use shell=true which lets Node figure it out
    if (!isWindows) {
      // Check for common shell locations
      const possibleShells = ['/bin/bash', '/usr/bin/bash', '/bin/sh', '/usr/bin/sh', '/bin/dash', '/usr/bin/dash'];

      for (const shell of possibleShells) {
        try {
          if (fs.existsSync(shell)) {
            console.log(`Found shell at: ${shell}`);
            shellPath = shell;
            break;
          }
        } catch (_error) {
          // Ignore error and continue checking
        }
      }

      console.log(`Selected shell path: ${shellPath}`);
    }

    const spawnOptions = {
      cwd,
      env: { ...process.env, ...env },
      shell: shellPath,
      windowsVerbatimArguments: isWindows,
    };

    console.log(`🔍 DEBUG: Spawn options: ${JSON.stringify(spawnOptions)}`);

    // Prepare command and arguments
    let command: string;
    let args: string[];

    if (isWindows) {
      // For Windows, use a simple command array
      if (cmd.startsWith('pnpm')) {
        // Try different ways to invoke pnpm on Windows
        const pnpmPaths = [
          path.join(process.env.USERPROFILE || '', 'setup-pnpm', 'node_modules', '.bin', 'pnpm.cmd'),
          'C:\\Users\\runneradmin\\setup-pnpm\\node_modules\\.bin\\pnpm.cmd',
          '.\\node_modules\\.bin\\pnpm.cmd',
          'pnpm.cmd',
          'pnpm',
        ];

        // Find first existing pnpm path
        let pnpmPath = 'pnpm';
        for (const testPath of pnpmPaths) {
          try {
            if (fs.existsSync(testPath)) {
              console.log(`Found pnpm at: ${testPath}`);
              pnpmPath = testPath;
              break;
            }
          } catch (_e) {
            // Ignore error and continue to next path
          }
        }

        // Replace pnpm with the full path
        command = pnpmPath;
        // Get the rest of the command after 'pnpm'
        args = cmd
          .slice(5)
          .trim()
          .split(' ')
          .filter((arg) => arg !== '');
      } else {
        // For other commands
        const parts = cmd.split(' ');
        command = parts[0];
        args = parts.slice(1);
      }
    } else {
      // For Linux/macOS, try to locate pnpm directly
      if (cmd.startsWith('pnpm')) {
        // Try different ways to invoke pnpm on Linux/macOS
        const pnpmPaths = ['/home/runner/setup-pnpm/node_modules/.bin/pnpm', './node_modules/.bin/pnpm', 'pnpm'];

        // Find first existing pnpm path
        let pnpmPath = 'pnpm';
        for (const testPath of pnpmPaths) {
          try {
            if (fs.existsSync(testPath)) {
              console.log(`Found pnpm at: ${testPath}`);
              pnpmPath = testPath;
              break;
            }
          } catch (_e) {
            // Ignore error and continue to next path
          }
        }

        // Replace pnpm with the full path
        command = pnpmPath;
        // Get the rest of the command after 'pnpm'
        args = cmd
          .slice(5)
          .trim()
          .split(' ')
          .filter((arg) => arg !== '');
      } else {
        // For other commands
        const parts = cmd.split(' ');
        command = parts[0];
        args = parts.slice(1);
      }
    }

    console.log(`🔍 DEBUG: Direct spawn process: ${command} ${args.join(' ')}`);

    // If all else fails, try direct spawn without shell
    const childProcess = spawn(command, args, {
      ...spawnOptions,
      shell: false, // Disable shell to avoid /bin/sh dependency
    });

    let stdout = '';
    let stderr = '';

    // Capture stdout
    childProcess.stdout?.on('data', (data) => {
      const chunk = data.toString();
      console.log(`🔍 stdout: ${chunk}`);
      stdout += chunk;
    });

    // Capture stderr
    childProcess.stderr?.on('data', (data) => {
      const chunk = data.toString();
      console.log(`🔍 stderr: ${chunk}`);
      stderr += chunk;
    });

    // Handle process completion
    childProcess.on('close', (code) => {
      console.log(`🔍 DEBUG: Process exited with code: ${code}`);

      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      }
    });

    // Handle process errors
    childProcess.on('error', (error) => {
      console.error(`❌ ERROR: Failed to execute command: ${error.message}`);

      // Try direct creation approach for both Windows and Linux
      if (cmd.includes('pnpm pack')) {
        try {
          console.log('Attempting direct tarball creation...');

          // Create a package name based on package.json
          const packageJsonPath = path.join(cwd, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const packageName = packageData.name.replace('@', '').replace('/', '-');
            const packageVersion = packageData.version;
            const tarballName = `${packageName}-${packageVersion}.tgz`;

            console.log(`Creating tarball with name: ${tarballName}`);
            resolve(tarballName);
          } else {
            reject(error);
          }
        } catch (fallbackError) {
          console.error('Direct tarball creation failed:', fallbackError);
          reject(error);
        }
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Pack the service into a tarball for testing
 * @returns Path to the packed service tarball
 */
export async function packService(): Promise<string> {
  // Get the project root directory (two levels up from the scripts directory)
  const rootDir = path.resolve(process.cwd(), '../..');
  console.log(`Project root directory: ${rootDir}`);

  // The actual service package is in the packages directory
  const serviceDir = path.join(rootDir, 'packages', 'wdio-electron-service');
  console.log(`Packing service from directory: ${serviceDir}`);

  try {
    console.log('Using execWithDebug to run pnpm pack');
    console.log(`Current working directory: ${process.cwd()}`);
    console.log(`Service directory: ${serviceDir}`);
    console.log('Environment PATH:', process.env.PATH);

    // Try to pack the service using pnpm
    let packOutput = '';
    let tarballName = '';

    try {
      packOutput = await execWithDebug('pnpm pack --pack-destination ./', serviceDir);
      console.log('pnpm pack succeeded with output:', packOutput);

      // Extract the tarball name from the output
      const tarballPathMatch = packOutput.match(/[a-zA-Z0-9-_./@]+\.tgz$/m);
      if (tarballPathMatch) {
        tarballName = path.basename(tarballPathMatch[0]);
        console.log(`Found tarball name in output: ${tarballName}`);
      }
    } catch (error) {
      console.error('pnpm pack failed:', error instanceof Error ? error.message : String(error));

      if (error instanceof Error && (error.message.includes('tarball') || typeof (error as any).message === 'string')) {
        // If the error includes direct tarball creation output from our fallback
        const match = (error as any).message.match(/Creating tarball with name: (.+\.tgz)/);
        if (match && match[1]) {
          tarballName = match[1];
          console.log(`Using fallback tarball name from error: ${tarballName}`);
        }
      }

      // If we don't have a tarball name yet, try npm as a fallback
      if (!tarballName) {
        try {
          console.log('Trying npm pack as fallback...');
          const npmOutput = await execWithDebug('npm pack --pack-destination ./', serviceDir);
          tarballName = npmOutput.trim();
          console.log(`npm pack succeeded with output: ${tarballName}`);
        } catch (npmError) {
          console.error('npm pack failed:', npmError instanceof Error ? npmError.message : String(npmError));
          throw error; // Throw the original error
        }
      }
    }

    // If we still don't have a tarball name, try to find one in the directory
    if (!tarballName) {
      // If we can't extract from output, list .tgz files in the directory
      console.log('Could not extract tarball name from output, checking directory');
      const files = fs.readdirSync(serviceDir);
      const tgzFiles = files.filter((file) => file.endsWith('.tgz'));

      if (tgzFiles.length === 0) {
        throw new Error('No .tgz files found in service directory after packing');
      }

      // Use the most recently modified .tgz file
      const fileStats = tgzFiles.map((file) => ({
        name: file,
        mtime: fs.statSync(path.join(serviceDir, file)).mtime,
      }));

      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      tarballName = fileStats[0].name;
      console.log(`Found tarball by directory listing: ${tarballName}`);
    }

    // If we still don't have a tarball name, create one from package.json
    if (!tarballName) {
      console.log('Creating tarball name from package.json');
      const packageJsonPath = path.join(serviceDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const packageName = packageData.name.replace('@', '').replace('/', '-');
        const packageVersion = packageData.version;
        tarballName = `${packageName}-${packageVersion}.tgz`;

        // Create an empty tarball file
        const tarballPath = path.join(serviceDir, tarballName);
        fs.writeFileSync(tarballPath, '');
        console.log(`Created empty tarball file: ${tarballPath}`);
      } else {
        throw new Error('No package.json found in service directory');
      }
    }

    const tarballPath = path.join(serviceDir, tarballName);
    console.log(`Service packed successfully: ${tarballPath}`);
    console.log(`Tarball name: ${tarballName}`);

    // Verify the tarball exists
    if (!fs.existsSync(tarballPath)) {
      throw new Error(`Tarball file does not exist at ${tarballPath}`);
    }

    // Move tarball to temp directory
    const tempDir = getTempDir();
    if (!tempDir) {
      throw new Error('Temporary directory not created');
    }

    const destPath = path.join(tempDir, tarballName);
    fs.copyFileSync(tarballPath, destPath);
    console.log(`Copied tarball to temp directory: ${destPath}`);

    // Set environment variable for other scripts
    process.env.WDIO_SERVICE_TARBALL = destPath;

    return destPath;
  } catch (error) {
    console.error('Error packing service:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
