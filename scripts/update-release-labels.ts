#!/usr/bin/env node

/**
 * Script to update GitHub issue and PR labels after a release
 *
 * This script updates labels from 'release:future' to 'release:next' for the next batch
 * of issues and PRs that should be included in the next release.
 *
 * Usage:
 *   pnpx tsx scripts/update-release-labels.ts
 *
 * Environment variables:
 *   GITHUB_TOKEN - GitHub token for authentication
 *   GITHUB_REPOSITORY - Repository in format owner/repo
 *   TRACK - (Required) Specific track to update (main, feature, maintenance)
 *   BATCH_MODE - Set to 'true' to update all items without individual confirmation
 */

import { confirm } from '@inquirer/prompts';
import { Octokit } from '@octokit/rest';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';

// Configuration
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
if (!GITHUB_REPOSITORY) {
  console.error('❌ GITHUB_REPOSITORY environment variable is required.');
  process.exit(1);
}
const [REPO_OWNER, REPO_NAME] = GITHUB_REPOSITORY.split('/');

// Required track filter
const TRACK = process.env.TRACK;
if (!TRACK) {
  console.error('❌ TRACK environment variable is required (main, feature, or maintenance)');
  process.exit(1);
}

// Check if batch mode is enabled
const BATCH_MODE = process.env.BATCH_MODE?.toLowerCase() === 'true';

// Get the GitHub token from environment
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable is required');
  console.error('\nTo create a GitHub token:');
  console.error('1. Go to https://github.com/settings/tokens');
  console.error('2. Click "Generate new token" > "Generate new token (classic)"');
  console.error('3. Give it a name like "Label Update Script"');
  console.error('4. Select the "repo" scope (to manage repository labels)');
  console.error('5. Click "Generate token" and copy the token');
  console.error('\nThen run the script with:');
  console.error(`GITHUB_TOKEN=your_token_here TRACK=${TRACK} pnpx tsx scripts/update-release-labels.ts\n`);
  console.error('To update all items without confirmation, add BATCH_MODE=true');
  process.exit(1);
}

// Validate track value
const validTracks = ['main', 'feature', 'maintenance'] as const;
type ValidTrack = (typeof validTracks)[number];
const trackValue = TRACK.toLowerCase() as ValidTrack;

if (!validTracks.includes(trackValue)) {
  console.error(`❌ Invalid TRACK value: ${TRACK}. Must be one of: ${validTracks.join(', ')}`);
  process.exit(1);
}

// Initialize Octokit
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// Label definitions
const LABELS = {
  FUTURE: 'release:future',
  NEXT: 'release:next',
};

// Track labels
const TRACK_LABELS = {
  MAIN: 'track:main',
  FEATURE: 'track:feature',
  MAINTENANCE: 'track:maintenance',
};

type Issue = GetResponseDataTypeFromEndpointMethod<Octokit['rest']['issues']['listForRepo']> extends (infer U)[]
  ? U
  : never;

/**
 * Find all open issues and PRs with the 'release:future' label
 */
async function findItemsToUpdate(): Promise<Issue[]> {
  const items: Issue[] = [];
  let page = 1;
  const perPage = 100;

  // Build the label query
  const labels = [LABELS.FUTURE];

  // Add track filter based on the specified track
  switch (trackValue) {
    case 'main':
      labels.push(TRACK_LABELS.MAIN);
      break;
    case 'feature':
      labels.push(TRACK_LABELS.FEATURE);
      break;
    case 'maintenance':
      labels.push(TRACK_LABELS.MAINTENANCE);
      break;
  }

  try {
    console.log(`🔍 Finding issues and PRs with the release:future label`);

    while (true) {
      const { data } = await octokit.issues.listForRepo({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        state: 'open',
        labels: labels.join(','),
        per_page: perPage,
        page,
      });

      if (data.length === 0) {
        break;
      }

      items.push(...data);
      page++;

      if (data.length < perPage) {
        break;
      }
    }

    return items;
  } catch (error) {
    console.error('❌ Error finding items to update:', error);
    return [];
  }
}

/**
 * Update labels for an issue or PR with confirmation
 */
async function updateLabels(item: Issue): Promise<void> {
  try {
    // Display item information
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`#${item.number}: ${item.title}`);
    console.log(`URL: ${item.html_url}`);
    console.log(`Author: ${item.user?.login || 'unknown'}`);
    console.log(`Created: ${new Date(item.created_at).toLocaleDateString()}`);
    console.log(
      `Labels: ${item.labels
        .map((label) => {
          return typeof label === 'string' ? label : label.name;
        })
        .join(', ')}`,
    );

    // Skip confirmation in batch mode
    let shouldUpdate = true;
    if (!BATCH_MODE) {
      shouldUpdate = await confirm({
        message: `Update this item from 'release:future' to 'release:next'?`,
        default: true,
      });
    }

    if (!shouldUpdate) {
      console.log(`⏭️ Skipping #${item.number}`);
      return;
    }

    // Remove the 'release:future' label
    await octokit.issues.removeLabel({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: item.number,
      name: LABELS.FUTURE,
    });

    // Add the 'release:next' label
    await octokit.issues.addLabels({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: item.number,
      labels: [LABELS.NEXT],
    });

    console.log(`✅ Updated labels for #${item.number}`);
  } catch (error) {
    console.error(`❌ Error updating labels for #${item.number}:`, error);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(`🚀 Starting label update process for track: ${trackValue}`);
    if (BATCH_MODE) {
      console.log(`ℹ️ Running in batch mode - all items will be updated without individual confirmation`);
    } else {
      console.log(`ℹ️ Running in interactive mode - you'll be asked to confirm each update`);
    }

    // Find all items to update
    const itemsToUpdate = await findItemsToUpdate();

    if (itemsToUpdate.length === 0) {
      console.log(`ℹ️ No items found with the release:future label`);
      process.exit(0);
    }

    console.log(`\n🔍 Found ${itemsToUpdate.length} items with the release:future label`);

    // In interactive mode, explain the process
    if (!BATCH_MODE) {
      console.log(`You'll be asked to confirm each update from 'release:future' to 'release:next'`);
    }

    // Ask for global confirmation before proceeding
    let shouldProceed = true;
    if (!BATCH_MODE || itemsToUpdate.length > 10) {
      shouldProceed = await confirm({
        message: BATCH_MODE
          ? `Proceed with updating all ${itemsToUpdate.length} items without individual confirmation?`
          : `Proceed with reviewing ${itemsToUpdate.length} items?`,
        default: true,
      });
    }

    if (!shouldProceed) {
      console.log('❌ Operation cancelled by user');
      process.exit(0);
    }

    // Update labels for each item
    let updatedCount = 0;
    for (const item of itemsToUpdate) {
      await updateLabels(item);
      updatedCount++;
    }

    console.log(`\n✅ Label update process completed. Updated ${updatedCount} items.`);
  } catch (error) {
    console.error('❌ Error in label update process:', error);
    process.exit(1);
  }
}

main();
