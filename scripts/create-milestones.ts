/**
 * Script to create GitHub milestones for releases
 *
 * This script creates appropriate milestones based on the release type:
 * - For major releases: Creates both the specific major milestone (e.g., 9.0.0) and the range milestone (e.g., 9.x.y)
 * - For minor/patch releases: Updates the description of the range milestone if needed
 *
 * Usage:
 *   pnpx tsx scripts/create-milestones.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Octokit } from '@octokit/rest';

// Configuration
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
if (!GITHUB_REPOSITORY) {
  console.error('❌ GITHUB_REPOSITORY environment variable is required.');
  process.exit(1);
}
const [REPO_OWNER, REPO_NAME] = GITHUB_REPOSITORY.split('/');

// Get the GitHub token from environment
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// Initialize Octokit
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

/**
 * Get the current version from package.json
 */
async function getCurrentVersion(): Promise<string> {
  const packageJsonPath = path.join(process.cwd(), 'packages/wdio-electron-service/package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

/**
 * Parse version string into components
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-.*)?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Check if a milestone exists
 */
async function milestoneExists(title: string): Promise<number | null> {
  try {
    const { data: milestones } = await octokit.issues.listMilestones({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'open',
    });

    const milestone = milestones.find((m) => m.title === title);
    return milestone ? milestone.number : null;
  } catch (error) {
    console.error(`❌ Error checking milestone ${title}:`, error);
    return null;
  }
}

/**
 * Create a new milestone
 */
async function createMilestone(title: string, description: string): Promise<void> {
  try {
    const existingMilestoneNumber = await milestoneExists(title);

    if (existingMilestoneNumber) {
      console.log(`✅ Milestone ${title} already exists (ID: ${existingMilestoneNumber})`);

      // Update the description if it's different
      const { data: milestone } = await octokit.issues.getMilestone({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        milestone_number: existingMilestoneNumber,
      });

      if (milestone.description !== description) {
        await octokit.issues.updateMilestone({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          milestone_number: existingMilestoneNumber,
          description,
        });
        console.log(`✅ Updated description for milestone ${title}`);
      }

      return;
    }

    await octokit.issues.createMilestone({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title,
      description,
    });

    console.log(`✅ Created milestone ${title}`);
  } catch (error) {
    console.error(`❌ Error creating milestone ${title}:`, error);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Get current version and release type from environment
    const currentVersion = await getCurrentVersion();
    const releaseType = process.env.RELEASE_TYPE || 'patch';

    console.log(`Current version: ${currentVersion}`);
    console.log(`Release type: ${releaseType}`);

    const { major } = parseVersion(currentVersion);

    // Create appropriate milestones based on release type
    if (releaseType === 'major') {
      // For major releases, create both specific and range milestones
      const nextMajor = major + 1;

      // Create specific major milestone (e.g., 9.0.0)
      await createMilestone(`${nextMajor}.0.0`, `Major release ${nextMajor}.0.0 - Breaking changes and new features`);

      // Create range milestone for post-release (e.g., 9.x.y)
      await createMilestone(
        `${nextMajor}.x.y`,
        `Post-${nextMajor}.0.0 releases - Features and fixes for the ${nextMajor}.x series`,
      );

      // Update the current range milestone description to indicate it's now maintenance
      await createMilestone(`${major}.x.y`, `Maintenance releases for the ${major}.x series`);
    } else if (releaseType === 'minor') {
      // For minor releases, ensure the range milestone exists
      await createMilestone(`${major}.x.y`, `Features and fixes for the ${major}.x series`);
    } else {
      // For patch releases, ensure the range milestone exists
      await createMilestone(`${major}.x.y`, `Features and fixes for the ${major}.x series`);
    }

    console.log('✅ Milestone creation completed successfully');
  } catch (error) {
    console.error('❌ Error in milestone creation:', error);
    process.exit(1);
  }
}

// Run the script
main();
