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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serviceDir = join(rootDir, 'packages', 'wdio-electron-service');

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
      cwd,
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`);
    if (error instanceof Error && 'stdout' in error) {
      console.error(error.stdout);
    }
    throw error;
  }
}

async function buildAndPackService(): Promise<{ servicePath: string; utilsPath: string; typesPath: string }> {
  log('Building and packing wdio-electron-service and dependencies...');

  // Build all packages
  execCommand('pnpm build', rootDir, 'Building all packages');

  // Pack the dependencies first
  const utilsDir = join(rootDir, 'packages', '@wdio_electron-utils');
  const typesDir = join(rootDir, 'packages', '@wdio_electron-types');

  execCommand('pnpm pack', utilsDir, 'Packing @wdio/electron-utils');
  execCommand('pnpm pack', typesDir, 'Packing @wdio/electron-types');

  // Pack the service
  execCommand('pnpm pack', serviceDir, 'Packing wdio-electron-service');

  // Find the generated .tgz files
  const findTgzFile = (dir: string, prefix: string): string => {
    const files = readdirSync(dir);
    const tgzFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.tgz'));
    if (!tgzFile) {
      throw new Error(`Could not find ${prefix} .tgz file in ${dir}`);
    }
    return join(dir, tgzFile);
  };

  const servicePath = findTgzFile(serviceDir, 'wdio-electron-service-');
  const utilsPath = findTgzFile(utilsDir, 'wdio-electron-utils-');
  const typesPath = findTgzFile(typesDir, 'wdio-electron-types-');

  log(`📦 Packages packed:`);
  log(`   Service: ${servicePath}`);
  log(`   Utils: ${utilsPath}`);
  log(`   Types: ${typesPath}`);

  return { servicePath, utilsPath, typesPath };
}

async function testExample(
  examplePath: string,
  packages: { servicePath: string; utilsPath: string; typesPath: string },
) {
  const exampleName = examplePath.split('/').pop();
  log(`Testing example: ${exampleName}`);

  if (!existsSync(examplePath)) {
    throw new Error(`Example not found: ${examplePath}`);
  }

  // Create isolated test environment to avoid pnpm hoisting issues
  const tempDir = join(tmpdir(), `wdio-electron-test-${Date.now()}`);
  const isolatedExamplePath = join(tempDir, exampleName);

  try {
    log(`Creating isolated test environment at ${tempDir}`);
    mkdirSync(tempDir, { recursive: true });
    cpSync(examplePath, isolatedExamplePath, { recursive: true });

    // Create .pnpmrc to prevent hoisting and ensure proper resolution
    writeFileSync(join(isolatedExamplePath, '.pnpmrc'), 'hoist=false\nnode-linker=isolated\n');

    // Add pnpm overrides to package.json to force local package versions
    const packageJsonPath = join(isolatedExamplePath, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    packageJson.pnpm = {
      ...packageJson.pnpm,
      overrides: {
        '@wdio/electron-utils': `file:${packages.utilsPath}`,
        '@wdio/electron-types': `file:${packages.typesPath}`,
      },
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Install all dependencies with pnpm
    execCommand('pnpm install', isolatedExamplePath, `Installing dependencies for ${exampleName}`);

    // Install local packages
    execCommand(
      `pnpm add ${packages.typesPath} ${packages.utilsPath} ${packages.servicePath}`,
      isolatedExamplePath,
      `Installing local packages for ${exampleName}`,
    );

    // Debug: Check what's actually installed
    execCommand('ls -la node_modules/@wdio/', isolatedExamplePath, `Checking @wdio packages in isolated environment`);
    execCommand(
      'ls -la node_modules/wdio-electron-service/',
      isolatedExamplePath,
      `Checking service in isolated environment`,
    );

    // Build the app if needed (for examples that require built binaries)
    if (packageJson.scripts.build && (exampleName.includes('builder') || exampleName.includes('forge'))) {
      execCommand('pnpm build', isolatedExamplePath, `Building ${exampleName} app`);
    }

    // Run tests
    execCommand('pnpm test', isolatedExamplePath, `Running tests for ${exampleName}`);

    log(`✅ ${exampleName} tests passed!`);
  } finally {
    // Clean up isolated environment
    if (existsSync(tempDir)) {
      log(`Cleaning up isolated test environment`);
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options: TestOptions = {
    example: args.find((arg) => arg.startsWith('--example='))?.split('=')[1],
    skipBuild: args.includes('--skip-build'),
  };

  try {
    // Build and pack service (unless skipped)
    let packages: { servicePath: string; utilsPath: string; typesPath: string };
    if (options.skipBuild) {
      // Find existing .tgz files
      const findTgzFile = (dir: string, prefix: string): string => {
        const files = readdirSync(dir);
        const tgzFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.tgz'));
        if (!tgzFile) {
          throw new Error(`No ${prefix} .tgz file found. Run without --skip-build first.`);
        }
        return join(dir, tgzFile);
      };

      const utilsDir = join(rootDir, 'packages', '@wdio_electron-utils');
      const typesDir = join(rootDir, 'packages', '@wdio_electron-types');

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
      packages = await buildAndPackService();
    }

    // Find examples to test
    const examplesDir = join(rootDir, 'fixtures', 'package-tests');
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
      const examplePath = join(examplesDir, example);

      // Skip if it's just a placeholder (no package.json)
      if (!existsSync(join(examplePath, 'package.json'))) {
        log(`⏭️  Skipping ${example} (no package.json found)`);
        continue;
      }

      await testExample(examplePath, packages);
    }

    log(`🎉 All example tests completed successfully!`);
  } catch (error) {
    console.error('❌ Example testing failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
