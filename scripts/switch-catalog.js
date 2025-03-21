#!/usr/bin/env node
/**
 * Script to switch catalog dependencies for all example apps
 * Usage: node scripts/switch-catalog.js [default|next|minimum] [--update]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';

// Get the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const appsDir = path.join(rootDir, 'apps');
const workspaceFile = path.join(rootDir, 'pnpm-workspace.yaml');

// Valid catalog names
const VALID_CATALOGS = ['default', 'next', 'minimum'];

// Handle CLI arguments
const catalogName = process.argv[2]?.toLowerCase();
const updateFlag = process.argv.includes('--update');

if (!catalogName || !VALID_CATALOGS.includes(catalogName)) {
  console.error(`Error: Please specify a valid catalog: ${VALID_CATALOGS.join(', ')}`);
  process.exit(1);
}

// Dependencies that use catalogs
const CATALOG_DEPENDENCIES = [
  'electron',
  'electron-nightly',
  'webdriverio',
  '@wdio/cli',
  '@wdio/globals',
  '@wdio/local-runner',
  '@wdio/mocha-framework',
];

/**
 * Create readline interface for user input
 */
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a yes/no question
 */
async function askQuestion(question) {
  const rl = createPrompt();

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Get latest electron-nightly version
 */
function getLatestElectronNightly() {
  try {
    const output = execSync('npm view electron-nightly dist-tags.latest', { encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    console.error('Error fetching latest electron-nightly version:', error.message);
    return null;
  }
}

/**
 * Compare semantic versions
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  if (!v1) return -1;
  if (!v2) return 1;

  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);

  // Compare major
  if (v1Parts[0] !== v2Parts[0]) return v1Parts[0] > v2Parts[0] ? 1 : -1;

  // Compare minor
  if (v1Parts[1] !== v2Parts[1]) return v1Parts[1] > v2Parts[1] ? 1 : -1;

  // Compare patch
  if (v1Parts[2] !== v2Parts[2]) return v1Parts[2] > v2Parts[2] ? 1 : -1;

  return 0; // Versions are equal
}

/**
 * Get the best tag to use for a package
 * Checks next, beta, alpha, and latest tags to find the most forward-looking version
 */
function getBestTagForPackage(packageName) {
  try {
    // Get dist-tags for the package
    const tagsOutput = execSync(`npm view ${packageName} dist-tags --json`, { encoding: 'utf8' });
    const tags = JSON.parse(tagsOutput);

    console.log(`  ${packageName} available tags:`, tags);

    // For the next catalog, prioritize in order: next > beta > alpha > latest
    const tagPriorityForNext = ['next', 'beta', 'alpha', 'latest'];

    // Get full versions for comparison
    const versions = {
      next: tags.next || '0.0.0',
      beta: tags.beta || '0.0.0',
      alpha: tags.alpha || '0.0.0',
      latest: tags.latest || '0.0.0',
    };

    // First find the highest version across all tags
    let highestTag = 'latest';
    let highestVersion = versions.latest;

    for (const tag of tagPriorityForNext) {
      if (!versions[tag]) continue;

      if (compareVersions(versions[tag], highestVersion) > 0) {
        highestVersion = versions[tag];
        highestTag = tag;
      }
    }

    // If we have multiple tags with same exact version, prioritize according to tagPriorityForNext
    const tagsWithSameVersion = Object.keys(versions).filter(
      (tag) => versions[tag] && compareVersions(versions[tag], highestVersion) === 0,
    );

    if (tagsWithSameVersion.length > 1) {
      highestTag = tagPriorityForNext.find((tag) => tagsWithSameVersion.includes(tag)) || highestTag;
    }

    console.log(
      `  ${packageName}: Using "${highestTag}" tag (versions: next=${versions.next}, beta=${versions.beta}, alpha=${versions.alpha}, latest=${versions.latest})`,
    );

    return highestTag;
  } catch (err) {
    console.log(`  ${packageName}: Error determining best tag, falling back to "latest": ${err.message}`);
    return 'latest';
  }
}

/**
 * Update the pnpm-workspace.yaml next catalog with latest package versions
 */
async function updateNextCatalog() {
  // Check if we need to update
  if (catalogName !== 'next') {
    return false;
  }

  const updateCatalog =
    updateFlag || (await askQuestion('Would you like to update the "next" catalog with the latest package versions?'));
  if (!updateCatalog) {
    return false;
  }

  console.log('\nUpdating the "next" catalog with latest package versions...');

  // Get latest electron-nightly version
  const latestElectronNightly = getLatestElectronNightly();
  console.log(`Found latest electron-nightly: ${latestElectronNightly}`);

  // Track packages we've processed
  const processedPackages = new Set();

  // Read the workspace.yaml
  const workspaceContent = fs.readFileSync(workspaceFile, 'utf8');
  const workspaceLines = workspaceContent.split('\n');

  let inNextCatalog = false;
  let updatedLines = [];
  let hasMissingElectronNightly = true;

  // Update the catalog entries
  for (const line of workspaceLines) {
    if (line.trim() === 'next:') {
      inNextCatalog = true;
      updatedLines.push(line);
    } else if (inNextCatalog && line.match(/^\s{4}\S/)) {
      const [packagePart] = line.split(':');
      const packageName = packagePart.trim();
      processedPackages.add(packageName);

      if (packageName === 'electron-nightly') {
        // Update electron-nightly with latest version
        updatedLines.push(`    electron-nightly: "${latestElectronNightly}"`);
        hasMissingElectronNightly = false;
      } else if (packageName === 'electron') {
        // Skip the electron line - we only want electron-nightly in next catalog
        continue;
      } else {
        // For all other packages, determine the best tag to use
        const tagToUse = getBestTagForPackage(packageName);
        updatedLines.push(`    ${packageName}: "${tagToUse}"`);
      }
    } else if (inNextCatalog && line.match(/^\s{2}\S/)) {
      // We've reached the end of the next catalog
      inNextCatalog = false;

      // If electron-nightly wasn't present, add it
      if (hasMissingElectronNightly) {
        updatedLines.push(`    electron-nightly: "${latestElectronNightly}"`);
      }

      updatedLines.push(line);
    } else {
      updatedLines.push(line);
    }
  }

  // Write the updated content back to the file
  fs.writeFileSync(workspaceFile, updatedLines.join('\n'), 'utf8');
  console.log('✓ Updated next catalog in pnpm-workspace.yaml');
  return true;
}

// Find all package.json files in the apps directory
const appDirs = fs.readdirSync(appsDir).filter((dir) => {
  return fs.statSync(path.join(appsDir, dir)).isDirectory() && dir !== 'node_modules' && !dir.startsWith('.');
});

console.log(`Switching all example apps to '${catalogName}' catalog...\n`);

// Process each app's package.json
for (const appDir of appDirs) {
  const packageJsonPath = path.join(appsDir, appDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.warn(`Warning: No package.json found in ${appDir}`);
    continue;
  }

  // Read and parse the package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let changed = false;

  // Update dependencies
  if (packageJson.devDependencies) {
    // Handle specific catalog transitions
    if (catalogName !== 'next' && packageJson.devDependencies['electron-nightly']) {
      // When switching from next to any other catalog, remove electron-nightly and add electron
      delete packageJson.devDependencies['electron-nightly'];
      packageJson.devDependencies['electron'] = `catalog:${catalogName}`;
      console.log(`  Replaced electron-nightly with electron in ${appDir}`);
      changed = true;
    }

    // Handle typescript - if it has a catalog reference but typescript is no longer in catalogs
    if (packageJson.devDependencies['typescript'] && packageJson.devDependencies['typescript'].startsWith('catalog:')) {
      // Set it to a specific version instead
      packageJson.devDependencies['typescript'] = '^5.8.2';
      console.log(`  Updated typescript to use specific version in ${appDir}`);
      changed = true;
    }

    for (const dep of CATALOG_DEPENDENCIES) {
      if (packageJson.devDependencies[dep]) {
        const currentValue = packageJson.devDependencies[dep];
        // Only update if it's already a catalog reference or contains a version number
        if (
          currentValue.startsWith('catalog:') ||
          currentValue.includes('.') ||
          currentValue.includes('^') ||
          currentValue.includes('~') ||
          currentValue.includes('@')
        ) {
          // Special handling for next catalog - use electron-nightly instead of electron
          if (catalogName === 'next' && dep === 'electron') {
            // Remove electron and add electron-nightly instead
            delete packageJson.devDependencies[dep];
            packageJson.devDependencies['electron-nightly'] = `catalog:${catalogName}`;
            console.log(`  Replaced electron with electron-nightly in ${appDir}`);
          } else {
            packageJson.devDependencies[dep] = `catalog:${catalogName}`;
          }
          changed = true;
        }
      }
    }

    // Special handling for next catalog - ensure electron-nightly is added even if electron wasn't present
    if (
      catalogName === 'next' &&
      !packageJson.devDependencies['electron-nightly'] &&
      packageJson.devDependencies['electron']
    ) {
      packageJson.devDependencies['electron-nightly'] = `catalog:${catalogName}`;
      delete packageJson.devDependencies['electron'];
      changed = true;
      console.log(`  Added electron-nightly in ${appDir}`);
    }
  }

  if (changed) {
    // Write the updated package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
    console.log(`✓ Updated ${appDir} to use catalog:${catalogName}`);
  } else {
    console.log(`- No changes needed for ${appDir}`);
  }
}

// Update the next catalog if requested
(async () => {
  const updated = await updateNextCatalog();

  console.log('\nDone! Run "pnpm install" to apply the changes.');

  if (updated) {
    console.log('\nNOTE: The "next" catalog has been updated with the latest package versions.');
    console.log('      This may cause breaking changes.');
  }
})();
