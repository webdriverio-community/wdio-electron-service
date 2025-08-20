#!/usr/bin/env tsx
/**
 * Script to test the wdio-electron-service package in the example apps
 * Usage: pnpx tsx scripts/test-package.ts [--example=<example-name>] [--skip-build]
 *
 * Examples:
 * pnpx tsx scripts/test-package.ts
 * pnpx tsx scripts/test-package.ts --example=builder-app
 * pnpx tsx scripts/test-package.ts --example=forge-app --skip-build
 * pnpx tsx scripts/test-package.ts --example=script-app
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// Add global error handlers to catch silent failures
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Fix Windows path handling for fileURLToPath
const __filename = (() => {
  try {
    const url = import.meta.url;
    return process.platform === 'win32' ? fileURLToPath(url) : fileURLToPath(url);
  } catch (_error) {
    return process.argv[1];
  }
})();

const __dirname = dirname(__filename);
const rootDir = normalize(join(__dirname, '..'));
const serviceDir = normalize(join(rootDir, 'packages', 'wdio-electron-service'));

interface TestOptions {
  example?: string;
  skipBuild?: boolean;
}

function log(message: string) {
  console.log(`🔧 ${message}`);
}

function execCommand(command: string, cwd: string, description: string) {
  log(`${description}...`);

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
    if (error instanceof Error) {
      console.error(error.message);
      if ('stderr' in error && error.stderr) {
        console.error(error.stderr);
      }
    }
    throw error;
  }
}

async function buildAndPackService(): Promise<{
  servicePath: string;
  utilsPath: string;
  typesPath: string;
  cdpBridgePath: string;
}> {
  log('Building and packing wdio-electron-service and dependencies...');

  try {
    // Build all packages
    execCommand('pnpm build', rootDir, 'Building all packages');

    // Pack the dependencies first
    const utilsDir = normalize(join(rootDir, 'packages', '@wdio_electron-utils'));
    const typesDir = normalize(join(rootDir, 'packages', '@wdio_electron-types'));
    const cdpBridgeDir = normalize(join(rootDir, 'packages', '@wdio_electron-cdp-bridge'));

    if (!existsSync(utilsDir)) {
      throw new Error(`Utils directory does not exist: ${utilsDir}`);
    }

    if (!existsSync(typesDir)) {
      throw new Error(`Types directory does not exist: ${typesDir}`);
    }

    if (!existsSync(cdpBridgeDir)) {
      throw new Error(`CDP Bridge directory does not exist: ${cdpBridgeDir}`);
    }

    execCommand('pnpm pack', utilsDir, 'Packing @wdio/electron-utils');
    execCommand('pnpm pack', typesDir, 'Packing @wdio/electron-types');
    execCommand('pnpm pack', cdpBridgeDir, 'Packing @wdio/cdp-bridge');

    // Pack the service
    execCommand('pnpm pack', serviceDir, 'Packing wdio-electron-service');

    // Find the generated .tgz files
    const findTgzFile = (dir: string, prefix: string): string => {
      const files = readdirSync(dir);
      const tgzFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.tgz'));
      if (!tgzFile) {
        throw new Error(`Could not find ${prefix} .tgz file in ${dir}`);
      }
      return normalize(join(dir, tgzFile));
    };

    const servicePath = findTgzFile(serviceDir, 'wdio-electron-service-');
    const utilsPath = findTgzFile(utilsDir, 'wdio-electron-utils-');
    const typesPath = findTgzFile(typesDir, 'wdio-electron-types-');
    const cdpBridgePath = findTgzFile(cdpBridgeDir, 'wdio-cdp-bridge-');

    log(`📦 Packages packed:`);
    log(`   Service: ${servicePath}`);
    log(`   Utils: ${utilsPath}`);
    log(`   Types: ${typesPath}`);
    log(`   CDP Bridge: ${cdpBridgePath}`);

    return { servicePath, utilsPath, typesPath, cdpBridgePath };
  } catch (error) {
    console.error('❌ Failed in buildAndPackService:');
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw error;
  }
}

async function testExample(
  examplePath: string,
  packages: { servicePath: string; utilsPath: string; typesPath: string; cdpBridgePath: string },
) {
  const exampleName = examplePath.split(/[/\\]/).pop();
  if (!exampleName) {
    throw new Error(`Invalid example path: ${examplePath}`);
  }

  log(`Testing example: ${exampleName}`);

  if (!existsSync(examplePath)) {
    throw new Error(`Example not found: ${examplePath}`);
  }

  // Create isolated test environment to avoid pnpm hoisting issues
  const tempDir = normalize(join(tmpdir(), `wdio-electron-test-${Date.now()}`));
  const exampleDir = normalize(join(tempDir, exampleName));

  try {
    log(`Creating isolated test environment at ${tempDir}`);
    mkdirSync(tempDir, { recursive: true });
    cpSync(examplePath, exampleDir, { recursive: true });

    // Create .pnpmrc to prevent hoisting and ensure proper resolution
    const pnpmrcPath = join(exampleDir, '.pnpmrc');
    writeFileSync(pnpmrcPath, 'hoist=false\nnode-linker=isolated\n');

    // Add pnpm overrides to package.json to force local package versions
    const packageJsonPath = join(exampleDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error(`package.json not found at ${packageJsonPath}`);
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    packageJson.pnpm = {
      ...packageJson.pnpm,
      overrides: {
        '@wdio/electron-utils': `file:${packages.utilsPath}`,
        '@wdio/electron-types': `file:${packages.typesPath}`,
        '@wdio/cdp-bridge': `file:${packages.cdpBridgePath}`,
      },
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Install all dependencies with pnpm
    execCommand('pnpm install', exampleDir, `Installing dependencies for ${exampleName}`);

    // Install local packages
    const addCommand = `pnpm add ${packages.typesPath} ${packages.utilsPath} ${packages.cdpBridgePath} ${packages.servicePath}`;
    execCommand(addCommand, exampleDir, `Installing local packages for ${exampleName}`);

    // Build the app if needed
    if (
      packageJson.scripts?.build &&
      (exampleName.includes('builder') || exampleName.includes('forge') || exampleName.includes('script'))
    ) {
      execCommand('pnpm build', exampleDir, `Building ${exampleName} app`);
    }

    execCommand('pnpm test', exampleDir, `Running tests for ${exampleName}`);

    log(`✅ ${exampleName} tests passed!`);
  } catch (error) {
    console.error(`❌ Error testing ${exampleName}:`);
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw error;
  } finally {
    // Clean up isolated environment
    if (existsSync(tempDir)) {
      log(`Cleaning up isolated test environment`);
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (_cleanupError) {
        console.error(`Failed to clean up temp directory: ${tempDir}`);
      }
    }
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const options: TestOptions = {
      example: args.find((arg) => arg.startsWith('--example='))?.split('=')[1],
      skipBuild: args.includes('--skip-build'),
    };

    // Build and pack service (unless skipped)
    let packages: { servicePath: string; utilsPath: string; typesPath: string; cdpBridgePath: string };
    if (options.skipBuild) {
      // Find existing .tgz files
      const findTgzFile = (dir: string, prefix: string): string => {
        const files = readdirSync(dir);
        const tgzFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.tgz'));
        if (!tgzFile) {
          throw new Error(`No ${prefix} .tgz file found. Run without --skip-build first.`);
        }
        return normalize(join(dir, tgzFile));
      };

      const utilsDir = normalize(join(rootDir, 'packages', '@wdio_electron-utils'));
      const typesDir = normalize(join(rootDir, 'packages', '@wdio_electron-types'));
      const cdpBridgeDir = normalize(join(rootDir, 'packages', '@wdio_electron-cdp-bridge'));

      packages = {
        servicePath: findTgzFile(serviceDir, 'wdio-electron-service-'),
        utilsPath: findTgzFile(utilsDir, 'wdio-electron-utils-'),
        typesPath: findTgzFile(typesDir, 'wdio-electron-types-'),
        cdpBridgePath: findTgzFile(cdpBridgeDir, 'wdio-cdp-bridge-'),
      };
      log(`📦 Using existing packages:`);
      log(`   Service: ${packages.servicePath}`);
      log(`   Utils: ${packages.utilsPath}`);
      log(`   Types: ${packages.typesPath}`);
      log(`   CDP Bridge: ${packages.cdpBridgePath}`);
    } else {
      packages = await buildAndPackService();
    }

    // Find examples to test
    const examplesDir = normalize(join(rootDir, 'fixtures', 'package-tests'));
    if (!existsSync(examplesDir)) {
      throw new Error(`Examples directory not found: ${examplesDir}`);
    }

    const examples = readdirSync(examplesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((name) => !name.startsWith('.'));

    // Filter examples if specific one requested
    const examplesToTest = options.example ? examples.filter((name) => name === options.example) : examples;

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
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Fix main module detection for Windows
const isMainModule = (() => {
  try {
    const scriptPath = normalize(process.argv[1]);
    const scriptUrl =
      process.platform === 'win32' ? `file:///${scriptPath.replace(/\\/g, '/')}` : `file://${scriptPath}`;
    return import.meta.url === scriptUrl;
  } catch (_error) {
    return __filename === process.argv[1] || __filename === normalize(process.argv[1]);
  }
})();

if (isMainModule) {
  main().catch((error) => {
    console.error('❌ Unhandled error in main:');
    console.error(error);
    process.exit(1);
  });
}
