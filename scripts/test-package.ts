#!/usr/bin/env tsx
/**
 * Script to test the wdio-electron-service package in the example apps
 * Usage: node scripts/test-package.ts [--example=<example-name>] [--skip-build]
 *
 * Examples:
 * node scripts/test-package.ts
 * node scripts/test-package.ts --example=builder-app
 * node scripts/test-package.ts --example=forge-app --skip-build
 * node scripts/test-package.ts --example=script-app
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// Add startup debug information
console.log(`🔍 Debug: Starting test-package.ts on platform: ${process.platform}`);
console.log(`🔍 Debug: Node.js version: ${process.version}`);
console.log(`🔍 Debug: Current working directory: ${process.cwd()}`);

// Add global error handlers to catch silent failures
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🔍 Debug: Error handlers registered');

// Fix Windows path handling for fileURLToPath
const __filename = (() => {
  try {
    const url = import.meta.url;
    console.log(`🔍 Debug: import.meta.url: ${url}`);

    // Handle Windows paths correctly
    if (process.platform === 'win32') {
      // Ensure URL format is correct for Windows
      const path = fileURLToPath(url);
      console.log(`🔍 Debug: Resolved path: ${path}`);
      return path;
    }

    return fileURLToPath(url);
  } catch (error) {
    console.error(`🔍 Debug: Error resolving __filename:`, error);
    // Fallback to process.argv[1] if fileURLToPath fails
    console.log(`🔍 Debug: Falling back to process.argv[1]: ${process.argv[1]}`);
    return process.argv[1];
  }
})();

const __dirname = dirname(__filename);
const rootDir = normalize(join(__dirname, '..'));
const serviceDir = normalize(join(rootDir, 'packages', 'wdio-electron-service'));

console.log(`🔍 Debug: Script directory: ${__dirname}`);
console.log(`🔍 Debug: Root directory: ${rootDir}`);
console.log(`🔍 Debug: Service directory: ${serviceDir}`);

// Check if directories exist
console.log(`🔍 Debug: Root directory exists: ${existsSync(rootDir)}`);
console.log(`🔍 Debug: Service directory exists: ${existsSync(serviceDir)}`);

interface TestOptions {
  example?: string;
  skipBuild?: boolean;
}

console.log(`🔍 Debug: Defined TestOptions interface`);

function log(message: string) {
  console.log(`🔧 ${message}`);
}

console.log(`🔍 Debug: Defined log function`);

function execCommand(command: string, cwd: string, description: string) {
  log(`${description}...`);
  console.log(`🔍 Debug: Running command: ${command}`);
  console.log(`🔍 Debug: Working directory: ${cwd}`);

  try {
    execSync(command, {
      cwd: normalize(cwd),
      stdio: 'inherit',
      encoding: 'utf-8',
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    });
    log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`);
    console.error(`🔍 Debug: Command failed: ${command}`);
    console.error(`🔍 Debug: Working directory: ${cwd}`);

    if (error instanceof Error) {
      console.error(`🔍 Debug: Error message: ${error.message}`);
      console.error(`🔍 Debug: Error name: ${error.name}`);
      console.error(`🔍 Debug: Error stack: ${error.stack}`);

      if ('stdout' in error) {
        console.error(`🔍 Debug: Error stdout: ${error.stdout}`);
      }

      if ('stderr' in error && error.stderr) {
        console.error(`🔍 Debug: Error stderr: ${error.stderr}`);
      }
    } else {
      console.error(`🔍 Debug: Unknown error type:`, error);
    }

    throw error;
  }
}

console.log(`🔍 Debug: Defined execCommand function`);

async function buildAndPackService(): Promise<{ servicePath: string; utilsPath: string; typesPath: string }> {
  console.log(`🔍 Debug: Entering buildAndPackService function`);
  log('Building and packing wdio-electron-service and dependencies...');

  try {
    // Build all packages
    execCommand('pnpm build', rootDir, 'Building all packages');

    // Pack the dependencies first
    const utilsDir = normalize(join(rootDir, 'packages', '@wdio_electron-utils'));
    const typesDir = normalize(join(rootDir, 'packages', '@wdio_electron-types'));

    console.log(`🔍 Debug: Utils directory: ${utilsDir}`);
    console.log(`🔍 Debug: Types directory: ${typesDir}`);

    if (!existsSync(utilsDir)) {
      throw new Error(`Utils directory does not exist: ${utilsDir}`);
    }

    if (!existsSync(typesDir)) {
      throw new Error(`Types directory does not exist: ${typesDir}`);
    }

    execCommand('pnpm pack', utilsDir, 'Packing @wdio/electron-utils');
    execCommand('pnpm pack', typesDir, 'Packing @wdio/electron-types');

    // Pack the service
    execCommand('pnpm pack', serviceDir, 'Packing wdio-electron-service');

    // Find the generated .tgz files
    const findTgzFile = (dir: string, prefix: string): string => {
      console.log(`🔍 Debug: Looking for ${prefix}*.tgz in ${dir}`);
      const files = readdirSync(dir);
      console.log(`🔍 Debug: Files in directory: ${files.join(', ')}`);

      const tgzFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.tgz'));
      if (!tgzFile) {
        throw new Error(`Could not find ${prefix} .tgz file in ${dir}`);
      }
      return normalize(join(dir, tgzFile));
    };

    const servicePath = findTgzFile(serviceDir, 'wdio-electron-service-');
    const utilsPath = findTgzFile(utilsDir, 'wdio-electron-utils-');
    const typesPath = findTgzFile(typesDir, 'wdio-electron-types-');

    log(`📦 Packages packed:`);
    log(`   Service: ${servicePath}`);
    log(`   Utils: ${utilsPath}`);
    log(`   Types: ${typesPath}`);

    return { servicePath, utilsPath, typesPath };
  } catch (error) {
    console.error('❌ Failed in buildAndPackService:');
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    } else {
      console.error('   Unknown error:', error);
    }
    throw error;
  }
}

function listDirectoryContents(dir: string, indent = '') {
  console.log(`🔍 Debug: Listing contents of ${dir}`);
  const items = readdirSync(dir, { withFileTypes: true });
  items.forEach((item) => {
    const fullPath = join(dir, item.name);
    console.log(`${indent}${item.isDirectory() ? '📁' : '📄'} ${item.name}`);
    if (item.isDirectory()) {
      listDirectoryContents(fullPath, `${indent}  `);
    }
  });
}

async function testExample(
  examplePath: string,
  packages: { servicePath: string; utilsPath: string; typesPath: string },
) {
  const exampleName = examplePath.split(/[/\\]/).pop();
  if (!exampleName) {
    throw new Error(`Invalid example path: ${examplePath}`);
  }

  log(`Testing example: ${exampleName}`);
  console.log(`🔍 Debug: Example path: ${examplePath}`);

  if (!existsSync(examplePath)) {
    throw new Error(`Example not found: ${examplePath}`);
  }

  // Create isolated test environment to avoid pnpm hoisting issues
  const tempDir = normalize(join(tmpdir(), `wdio-electron-test-${Date.now()}`));
  const exampleDir = normalize(join(tempDir, exampleName));

  console.log(`🔍 Debug: Temp directory: ${tempDir}`);
  console.log(`🔍 Debug: Isolated example path: ${exampleDir}`);

  try {
    log(`Creating isolated test environment at ${tempDir}`);
    mkdirSync(tempDir, { recursive: true });
    cpSync(examplePath, exampleDir, { recursive: true });

    // Create .pnpmrc to prevent hoisting and ensure proper resolution
    const pnpmrcPath = join(exampleDir, '.pnpmrc');
    writeFileSync(pnpmrcPath, 'hoist=false\nnode-linker=isolated\n');
    console.log(`🔍 Debug: Created .pnpmrc at ${pnpmrcPath}`);

    // Add pnpm overrides to package.json to force local package versions
    const packageJsonPath = join(exampleDir, 'package.json');
    console.log(`🔍 Debug: Reading package.json from ${packageJsonPath}`);

    if (!existsSync(packageJsonPath)) {
      throw new Error(`package.json not found at ${packageJsonPath}`);
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    console.log(`🔍 Debug: Original package.json:`, JSON.stringify(packageJson, null, 2));

    packageJson.pnpm = {
      ...packageJson.pnpm,
      overrides: {
        '@wdio/electron-utils': `file:${packages.utilsPath}`,
        '@wdio/electron-types': `file:${packages.typesPath}`,
      },
    };

    console.log(`🔍 Debug: Updated package.json:`, JSON.stringify(packageJson, null, 2));
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Install all dependencies with pnpm
    execCommand('pnpm install', exampleDir, `Installing dependencies for ${exampleName}`);

    // Install local packages
    const addCommand = `pnpm add ${packages.typesPath} ${packages.utilsPath} ${packages.servicePath}`;
    execCommand(addCommand, exampleDir, `Installing local packages for ${exampleName}`);

    // Debug: Check installed packages using Node.js fs instead of ls
    const checkInstalledPackages = (dir: string, description: string) => {
      console.log(`🔍 Debug: Checking directory: ${dir}`);
      if (existsSync(dir)) {
        const files = readdirSync(dir, { withFileTypes: true });
        log(`${description}:`);
        files.forEach((file) => {
          log(`   ${file.name}${file.isDirectory() ? '/' : ''}`);
        });
      } else {
        log(`${description}: Directory not found`);
        console.log(`🔍 Debug: Directory does not exist: ${dir}`);
      }
    };

    const wdioDir = join(exampleDir, 'node_modules', '@wdio');
    const serviceInstallDir = join(exampleDir, 'node_modules', 'wdio-electron-service');

    checkInstalledPackages(wdioDir, 'Checking @wdio packages in isolated environment');
    checkInstalledPackages(serviceInstallDir, 'Checking service in isolated environment');

    // Build the app if needed (for examples that require built binaries or source compilation)
    if (
      packageJson.scripts &&
      packageJson.scripts.build &&
      (exampleName.includes('builder') || exampleName.includes('forge') || exampleName.includes('script'))
    ) {
      execCommand('pnpm build', exampleDir, `Building ${exampleName} app`);

      // Add debug logging for dist-electron directory
      const distElectronDir = join(exampleDir, 'dist-electron');
      if (existsSync(distElectronDir)) {
        console.log('\n🔍 Debug: Inspecting dist-electron directory after build:');
        listDirectoryContents(distElectronDir);
        console.log(); // Add empty line for readability
      } else {
        console.log(`\n🔍 Debug: dist-electron directory not found at ${distElectronDir}\n`);
      }
    } else {
      console.log(`🔍 Debug: Skipping build for ${exampleName}`);
      if (packageJson.scripts) {
        console.log(`🔍 Debug: Available scripts:`, JSON.stringify(packageJson.scripts, null, 2));
      } else {
        console.log(`🔍 Debug: No scripts found in package.json`);
      }
    }

    execCommand('pnpm test', exampleDir, `Running tests for ${exampleName}`);

    log(`✅ ${exampleName} tests passed!`);
  } catch (error) {
    // Log more details about the error on Windows
    console.error(`❌ Error testing ${exampleName}:`);
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    } else {
      console.error('   Unknown error:', error);
    }
    throw error;
  } finally {
    // Clean up isolated environment
    if (existsSync(tempDir)) {
      log(`Cleaning up isolated test environment`);
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(`🔍 Debug: Failed to clean up temp directory: ${tempDir}`);
        console.error(cleanupError);
      }
    }
  }
}

async function main() {
  console.log(`🔍 Debug: Entering main function`);
  try {
    console.log('🔍 Debug: Starting main function');
    const args = process.argv.slice(2);
    console.log(`🔍 Debug: Command line arguments: ${args.join(' ')}`);

    const options: TestOptions = {
      example: args.find((arg) => arg.startsWith('--example='))?.split('=')[1],
      skipBuild: args.includes('--skip-build'),
    };

    console.log(`🔍 Debug: Parsed options:`, options);

    // Build and pack service (unless skipped)
    let packages: { servicePath: string; utilsPath: string; typesPath: string };
    if (options.skipBuild) {
      console.log('🔍 Debug: Skipping build, looking for existing packages');
      // Find existing .tgz files
      const findTgzFile = (dir: string, prefix: string): string => {
        console.log(`🔍 Debug: Looking for existing ${prefix}*.tgz in ${dir}`);
        const files = readdirSync(dir);
        console.log(`🔍 Debug: Files in directory: ${files.join(', ')}`);

        const tgzFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.tgz'));
        if (!tgzFile) {
          throw new Error(`No ${prefix} .tgz file found. Run without --skip-build first.`);
        }
        return normalize(join(dir, tgzFile));
      };

      const utilsDir = normalize(join(rootDir, 'packages', '@wdio_electron-utils'));
      const typesDir = normalize(join(rootDir, 'packages', '@wdio_electron-types'));

      packages = {
        servicePath: findTgzFile(serviceDir, 'wdio-electron-service-'),
        utilsPath: findTgzFile(utilsDir, 'wdio-electron-utils-'),
        typesPath: findTgzFile(typesDir, 'wdio-electron-types-'),
      };
      log(`📦 Using existing packages:`);
      log(`   Service: ${packages.servicePath}`);
      log(`   Utils: ${packages.utilsPath}`);
      log(`   Types: ${packages.typesPath}`);
    } else {
      console.log('🔍 Debug: Building and packing packages');
      packages = await buildAndPackService();
    }

    // Find examples to test
    const examplesDir = normalize(join(rootDir, 'fixtures', 'package-tests'));
    console.log(`🔍 Debug: Examples directory: ${examplesDir}`);

    if (!existsSync(examplesDir)) {
      throw new Error(`Examples directory not found: ${examplesDir}`);
    }

    const examples = readdirSync(examplesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((name) => !name.startsWith('.'));

    console.log(`🔍 Debug: Found examples: ${examples.join(', ')}`);

    // Filter examples if specific one requested
    const examplesToTest = options.example
      ? examples.filter((name) => name === options.example)
      : examples.filter((name) => name !== 'script-app');
    console.log(`🔍 Debug: Examples to test: ${examplesToTest.join(', ')}`);

    if (examplesToTest.length === 0) {
      if (options.example) {
        throw new Error(`Example '${options.example}' not found. Available: ${examples.join(', ')}`);
      } else {
        throw new Error(`No examples found in ${examplesDir}`);
      }
    }

    log(`Found examples to test: ${examplesToTest.join(', ')}`);

    // Test each example
    for (const example of examplesToTest) {
      const examplePath = normalize(join(examplesDir, example));
      console.log(`🔍 Debug: Processing example at ${examplePath}`);

      // Skip if it's just a placeholder (no package.json)
      const packageJsonPath = join(examplePath, 'package.json');
      if (!existsSync(packageJsonPath)) {
        log(`⏭️  Skipping ${example} (no package.json found)`);
        continue;
      }

      await testExample(examplePath, packages);
    }

    log(`🎉 All example tests completed successfully!`);
  } catch (error) {
    console.error('❌ Example testing failed:');
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    } else {
      console.error('   Unknown error:', error);
    }
    process.exit(1);
  }
}

// Fix main module detection for Windows
const isMainModule = (() => {
  try {
    // Convert process.argv[1] to URL format for comparison
    const scriptPath = normalize(process.argv[1]);

    // Handle different platforms for URL construction
    let scriptUrl: string;
    if (process.platform === 'win32') {
      // On Windows: file:///C:/path/to/file
      scriptUrl = `file:///${scriptPath.replace(/\\/g, '/')}`;
    } else {
      // On Unix: file:///path/to/file (no extra slash needed)
      scriptUrl = `file://${scriptPath}`;
    }

    console.log(`🔍 Debug: Script path: ${scriptPath}`);
    console.log(`🔍 Debug: Script URL: ${scriptUrl}`);
    console.log(`🔍 Debug: import.meta.url: ${import.meta.url}`);
    console.log(`🔍 Debug: URLs match: ${import.meta.url === scriptUrl}`);

    return import.meta.url === scriptUrl;
  } catch (error) {
    console.error(`🔍 Debug: Error in main module detection:`, error);
    // Fallback: check if the filename matches
    return __filename === process.argv[1] || __filename === normalize(process.argv[1]);
  }
})();

if (isMainModule) {
  console.log('🔍 Debug: Script running as main module');

  main().catch((error) => {
    console.error('❌ Unhandled error in main:');
    console.error(error);
    process.exit(1);
  });
} else {
  console.log('🔍 Debug: Script NOT running as main module');
}
