#!/usr/bin/env tsx

/**
 * Script to update branch protection rules for repository branches
 * Used during the release process to ensure consistent protection across branches
 */

import { Octokit } from '@octokit/rest';
import type { RestEndpointMethodTypes } from '@octokit/rest';

type BranchProtectionParams = RestEndpointMethodTypes['repos']['updateBranchProtection']['parameters'];

// Get environment variables
const token = process.env.GITHUB_TOKEN;
const owner = process.env.REPO_OWNER || 'webdriverio-community';
const repo = process.env.REPO_NAME || 'wdio-electron-service';
const ltsBranch = process.env.NEXT_LTS_BRANCH;

if (!token) {
  console.error('Error: GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

if (!ltsBranch) {
  console.error('Error: NEXT_LTS_BRANCH environment variable is required');
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

try {
  // Format the branch name with .x suffix for standardization
  const formattedLtsBranch = `${ltsBranch}.x`;

  console.log(`Setting up protection rules for ${formattedLtsBranch}...`);

  // Create the protection parameters with all required properties
  const protectionParams: BranchProtectionParams = {
    owner,
    repo,
    branch: formattedLtsBranch,
    required_status_checks: {
      strict: true,
      contexts: ['build'],
    },
    enforce_admins: true,
    required_pull_request_reviews: {
      dismissal_restrictions: {},
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      required_approving_review_count: 1,
    },
    restrictions: null,
  };

  await octokit.repos.updateBranchProtection(protectionParams);
  console.log(`✅ Successfully updated branch protection for ${formattedLtsBranch}`);

  // Verify main branch protection is still in place
  console.log('Verifying main branch protection...');
  await octokit.repos.getBranchProtection({
    owner,
    repo,
    branch: 'main',
  });
  console.log('✅ Main branch protection is in place');
} catch (error) {
  console.error('Error updating branch protection:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
