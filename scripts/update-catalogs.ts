#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import * as yaml from 'yaml';
import { checkbox, confirm, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';

const execAsync = promisify(exec);

interface PackageInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  isUpToDate: boolean;
  updateType: 'patch' | 'minor' | 'major' | 'unknown';
}

interface WorkspaceConfig {
  packages: string[];
  catalogs: {
    [key: string]: {
      [key: string]: string;
    };
  };
}

// Check if dry run mode is enabled
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--dryRun');

async function readWorkspaceYaml(): Promise<WorkspaceConfig> {
  const workspaceYamlPath = path.join(process.cwd(), 'pnpm-workspace.yaml');
  const yamlContent = await fs.readFile(workspaceYamlPath, 'utf8');
  return yaml.parse(yamlContent);
}

/**
 * Determine the type of update between two semantic versions
 */
function getUpdateType(currentVersion: string, latestVersion: string): 'patch' | 'minor' | 'major' | 'unknown' {
  if (currentVersion === 'unknown' || latestVersion === 'unknown') {
    return 'unknown';
  }

  // Handle non-semver versions
  if (!currentVersion.match(/^\d+\.\d+\.\d+/) || !latestVersion.match(/^\d+\.\d+\.\d+/)) {
    return 'unknown';
  }

  const current = currentVersion.split('-')[0].split('.').map(Number);
  const latest = latestVersion.split('-')[0].split('.').map(Number);

  if (latest[0] > current[0]) {
    return 'major';
  } else if (latest[0] === current[0] && latest[1] > current[1]) {
    return 'minor';
  } else if (latest[0] === current[0] && latest[1] === current[1] && latest[2] > current[2]) {
    return 'patch';
  }

  return 'unknown';
}

/**
 * Get chalk color for update type
 */
function getUpdateColor(updateType: 'patch' | 'minor' | 'major' | 'unknown'): (text: string) => string {
  switch (updateType) {
    case 'patch':
      return chalk.green;
    case 'minor':
      return chalk.yellow;
    case 'major':
      return chalk.red;
    default:
      return chalk.gray;
  }
}

/**
 * Check if a version string is a non-semver tag
 */
function isNonSemverTag(version: string): boolean {
  return ['latest', 'next', 'beta', 'alpha', 'nightly'].includes(version.toLowerCase());
}

async function getLatestVersions(packages: Record<string, string>): Promise<PackageInfo[]> {
  console.log(chalk.blue('Fetching latest versions for packages...'));

  const packageInfos: PackageInfo[] = [];
  const spinner = ora('').start();

  for (const [name, currentVersion] of Object.entries(packages)) {
    spinner.text = `Checking ${chalk.cyan(name)}`;

    try {
      // Skip non-semver tags
      if (isNonSemverTag(currentVersion)) {
        console.log(chalk.dim(`  Skipping ${name}: using non-semver tag "${currentVersion}"`));
        packageInfos.push({
          name,
          currentVersion,
          latestVersion: currentVersion,
          isUpToDate: true,
          updateType: 'unknown',
        });
        continue;
      }

      // Clean the version to remove prefixes like ^, ~, etc.
      const cleanVersion = currentVersion.replace(/^\^|~/, '');

      // Use pnpm view to get the latest version
      const { stdout } = await execAsync(`pnpm view ${name} version`);
      const latestVersion = stdout.trim();
      const updateType = getUpdateType(cleanVersion, latestVersion);

      packageInfos.push({
        name,
        currentVersion: cleanVersion,
        latestVersion,
        isUpToDate: cleanVersion === latestVersion,
        updateType,
      });
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`Error fetching version for ${name}:`, error));
      spinner.start();

      packageInfos.push({
        name,
        currentVersion: currentVersion.replace(/^\^|~/, ''),
        latestVersion: 'unknown',
        isUpToDate: true, // Mark as up-to-date to exclude from selection
        updateType: 'unknown',
      });
    }
  }

  spinner.succeed('Finished checking all packages');
  return packageInfos;
}

async function promptPackagesToUpdate(packageInfos: PackageInfo[]): Promise<string[]> {
  const outdatedPackages = packageInfos.filter((pkg) => !pkg.isUpToDate);

  if (outdatedPackages.length === 0) {
    console.log(chalk.green('All packages are up to date!'));
    return [];
  }

  // Sort packages by update type (major first, then minor, then patch)
  outdatedPackages.sort((a, b) => {
    const priority = { major: 0, minor: 1, patch: 2, unknown: 3 };
    return priority[a.updateType] - priority[b.updateType];
  });

  // Count updates by type
  const updateCounts = outdatedPackages.reduce(
    (acc, pkg) => {
      if (pkg.updateType !== 'unknown') {
        acc[pkg.updateType]++;
      }
      return acc;
    },
    { major: 0, minor: 0, patch: 0 },
  );

  console.log(chalk.yellow(`Found ${outdatedPackages.length} outdated packages:`));
  console.log(
    `  ${chalk.red(`${updateCounts.major} major`)} | ` +
      `${chalk.yellow(`${updateCounts.minor} minor`)} | ` +
      `${chalk.green(`${updateCounts.patch} patch`)}`,
  );

  const choices = outdatedPackages.map((pkg) => {
    const updateColor = getUpdateColor(pkg.updateType);
    const updateBadge = pkg.updateType !== 'unknown' ? ` [${updateColor(pkg.updateType)}]` : '';

    return {
      value: pkg.name,
      name: `${pkg.name}${updateBadge}: ${chalk.dim(pkg.currentVersion)} → ${updateColor(pkg.latestVersion)}`,
      checked: pkg.updateType === 'patch', // Pre-select patch updates
    };
  });

  return await checkbox({
    message: 'Select packages to update:',
    choices,
  });
}

async function updateWorkspaceYaml(
  workspaceYaml: WorkspaceConfig,
  packageInfos: PackageInfo[],
  packagesToUpdate: string[],
  selectedCatalog: string,
): Promise<void> {
  if (isDryRun) {
    console.log(chalk.yellow('DRY RUN: The following changes would be made to pnpm-workspace.yaml:'));
    console.log();

    for (const packageName of packagesToUpdate) {
      const pkg = packageInfos.find((p) => p.name === packageName);
      if (pkg) {
        // Skip if using a non-semver tag
        if (isNonSemverTag(workspaceYaml.catalogs[selectedCatalog][packageName])) {
          console.log(
            chalk.dim(
              `  Skipping ${packageName}: using non-semver tag "${workspaceYaml.catalogs[selectedCatalog][packageName]}"`,
            ),
          );
          continue;
        }

        // Preserve the version prefix (^, ~, etc.)
        const prefix = workspaceYaml.catalogs[selectedCatalog][packageName].startsWith('^')
          ? '^'
          : workspaceYaml.catalogs[selectedCatalog][packageName].startsWith('~')
            ? '~'
            : '';

        const updateColor = getUpdateColor(pkg.updateType);
        const updateBadge = pkg.updateType !== 'unknown' ? ` [${updateColor(pkg.updateType)}]` : '';

        console.log(
          `  ${packageName}${updateBadge}: ${chalk.dim(workspaceYaml.catalogs[selectedCatalog][packageName])} → ${updateColor(`${prefix}${pkg.latestVersion}`)}`,
        );
      }
    }
    console.log();
    return;
  }

  const spinner = ora('Updating workspace configuration...').start();

  for (const packageName of packagesToUpdate) {
    const pkg = packageInfos.find((p) => p.name === packageName);
    if (pkg) {
      // Skip if using a non-semver tag
      if (isNonSemverTag(workspaceYaml.catalogs[selectedCatalog][packageName])) {
        console.log(
          chalk.dim(
            `  Skipping ${packageName}: using non-semver tag "${workspaceYaml.catalogs[selectedCatalog][packageName]}"`,
          ),
        );
        continue;
      }

      // Preserve the version prefix (^, ~, etc.)
      const prefix = workspaceYaml.catalogs[selectedCatalog][packageName].startsWith('^')
        ? '^'
        : workspaceYaml.catalogs[selectedCatalog][packageName].startsWith('~')
          ? '~'
          : '';
      workspaceYaml.catalogs[selectedCatalog][packageName] = `${prefix}${pkg.latestVersion}`;
    }
  }

  const workspaceYamlPath = path.join(process.cwd(), 'pnpm-workspace.yaml');
  await fs.writeFile(workspaceYamlPath, yaml.stringify(workspaceYaml));

  spinner.succeed('Updated pnpm-workspace.yaml with new versions.');
}

async function runPnpmInstall(): Promise<void> {
  if (isDryRun) {
    console.log(chalk.yellow('DRY RUN: Would run "pnpm install" to update dependencies'));
    return;
  }

  const spinner = ora('Installing dependencies...').start();

  try {
    const { stdout, stderr } = await execAsync('pnpm install');
    spinner.succeed('Dependencies updated successfully!');

    if (stdout.trim()) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    spinner.fail('Error updating dependencies');
    console.error(chalk.red('Error details:'), error);
    process.exit(1);
  }
}

async function selectCatalog(catalogs: Record<string, Record<string, string>>): Promise<string> {
  const choices = Object.keys(catalogs).map((catalog) => ({
    value: catalog,
    name: catalog,
  }));

  return await select({
    message: 'Select catalog to update:',
    choices,
  });
}

async function main() {
  try {
    if (isDryRun) {
      console.log(chalk.yellow('Running in dry run mode. No changes will be made.'));
    }

    // Read the workspace YAML file
    const workspaceYaml = await readWorkspaceYaml();

    // Select which catalog to update
    const selectedCatalog = await selectCatalog(workspaceYaml.catalogs);

    // Get the latest versions for all packages in the selected catalog
    const packageInfos = await getLatestVersions(workspaceYaml.catalogs[selectedCatalog]);

    // Prompt the user to select packages to update
    const packagesToUpdate = await promptPackagesToUpdate(packageInfos);

    if (packagesToUpdate.length === 0) {
      console.log(chalk.yellow('No packages selected for update.'));
      return;
    }

    // Count updates by type
    const updateCounts = packagesToUpdate.reduce(
      (acc, packageName) => {
        const pkg = packageInfos.find((p) => p.name === packageName);
        if (pkg && pkg.updateType !== 'unknown') {
          acc[pkg.updateType]++;
        }
        return acc;
      },
      { major: 0, minor: 0, patch: 0 },
    );

    // Confirm the selection with update type counts
    const updateSummary =
      `${chalk.red(`${updateCounts.major} major`)}, ` +
      `${chalk.yellow(`${updateCounts.minor} minor`)}, ` +
      `${chalk.green(`${updateCounts.patch} patch`)}`;

    const confirmMessage = isDryRun
      ? `Preview updates for ${packagesToUpdate.length} packages in ${chalk.cyan(selectedCatalog)} catalog (${updateSummary})?`
      : `Update ${packagesToUpdate.length} packages in ${chalk.cyan(selectedCatalog)} catalog (${updateSummary})?`;

    const shouldProceed = await confirm({
      message: confirmMessage,
      default: true,
    });

    if (!shouldProceed) {
      console.log(chalk.yellow('Update cancelled.'));
      return;
    }

    // Update the workspace YAML file with the new versions
    await updateWorkspaceYaml(workspaceYaml, packageInfos, packagesToUpdate, selectedCatalog);

    // Run pnpm install to apply the updates
    await runPnpmInstall();

    if (isDryRun) {
      console.log(chalk.green('Dry run completed. Run without --dry-run to apply changes.'));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

main();
