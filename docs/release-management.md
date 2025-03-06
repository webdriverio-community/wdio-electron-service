# Release Management

This document outlines how we manage releases, milestones, and issue/PR tracking for the WebdriverIO Electron Service project.

## Milestone Structure

We use a two-tier milestone structure:

### Major Release Milestones

- **Specific major releases**: `8.0.0`, `9.0.0`, etc.
  - For breaking changes and features that must be included in a specific major release

### Post-Release Milestones

- **Version ranges**: `7.x.y`, `8.x.y`, `9.x.y`, etc.
  - For features, fixes, and improvements released after a major version

### Automated Milestone Creation

Milestones are automatically created during the release process:

- **For major releases**: Both specific major milestone (e.g., `9.0.0`) and range milestone (e.g., `9.x.y`)
- **For minor/patch releases**: Range milestone (e.g., `8.x.y`) if it doesn't exist
- **When a new major version is released**: Previous range milestone updated to indicate it is now a maintenance milestone

## Release Labels

### Version Track Labels

- `track:main` - Current stable version track (e.g., v8.x.y)
- `track:feature` - Next major version track (e.g., v9.0.0)
- `track:maintenance` - Maintenance version track (e.g., v7.x.y)

### Release Timing Labels

- `release:next` - Included in the next release within its track
- `release:future` - Targeted for a future release within its track

### Version Increment Labels

- `semver:patch` - Bug fixes
- `semver:minor` - Backward-compatible new features
- `semver:major` - Breaking changes

### Priority Labels (Optional)

- `priority:high` - Critical fixes
- `priority:medium` - Important but not critical
- `priority:low` - Nice to have

## Workflow

### 1. Issue Creation and Triage

1. Assign the appropriate milestone
2. Add appropriate labels:
   - Version track label
   - Semver label
   - Release timing label
   - Priority label if needed

### 2. PR Creation

1. Link to the related issue (transfers the milestone)
2. Copy the same labels from the issue
3. Update labels if implementation details changed the scope

### 3. Release Planning

1. Filter PRs by milestone and `release:next` to see what's ready
2. Use the `semver:` labels to determine release type
3. Use priority labels to make decisions if needed

### 4. Release Execution

To trigger a release:

1. Go to the Actions tab in GitHub
2. Select either "Manual Release Publish" or "Manual Pre-Release Publish"
3. Choose the branch, version increment type, and whether it's a dry run
4. Review the workflow output

### 5. Post-Release

After a release is complete:

1. Close issues and PRs that were included
2. Review and update labels from `release:future` to `release:next` for the next batch
   - Run the interactive script: `GITHUB_TOKEN=<your-token> TRACK=<branch-type> pnpx tsx scripts/update-release-labels.ts`
   - For batch updating all items without individual confirmation: `GITHUB_TOKEN=<your-token> TRACK=<branch-type> BATCH_MODE=true pnpx tsx scripts/update-release-labels.ts`
   - To create a GitHub token:
     1. Go to https://github.com/settings/tokens
     2. Click "Generate new token" > "Generate new token (classic)"
     3. Give it a name like "Label Update Script"
     4. Select the "repo" scope (to manage repository labels)
     5. Click "Generate token" and copy the token
   - The script will show you each issue/PR and ask for confirmation before updating its labels (unless in batch mode)
3. Review and adjust priorities for the next release
