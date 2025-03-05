# Release Management

This document outlines how we manage releases, milestones, and issue/PR tracking for the WebdriverIO Electron Service project.

## Milestone Structure

We use a two-tier milestone structure to organize our work:

### Major Release Milestones

- **Specific major releases**: `8.0.0`, `9.0.0`, etc.
  - Used for breaking changes and features that must be included in a specific major release
  - PRs assigned to these milestones will be included in that specific release

### Post-Release Milestones

- **Version ranges**: `7.x.y`, `8.x.y`, `9.x.y`, etc.
  - Used for features, fixes, and improvements that will be released after a major version
  - These will be included in minor or patch releases

### Automated Milestone Creation

Milestones are automatically created as part of the release process:

- **For major releases**: Both the specific major milestone (e.g., `9.0.0`) and the range milestone (e.g., `9.x.y`) are created
- **For minor/patch releases**: The range milestone (e.g., `8.x.y`) is created if it doesn't exist
- **When a new major version is released**: The previous range milestone (e.g., `8.x.y`) is updated to indicate it's now a maintenance milestone

This automation ensures consistency in milestone naming and descriptions, and eliminates the need to manually create milestones for each release.

## Release Sequencing with Labels

To provide more granular control over which PRs go into specific releases, we use a comprehensive labeling system:

### Release Type Labels

- `release:next` - Will be included in the next release (patch or minor) of the current milestone
- `release:future` - Targeted for a future release (not the immediate next one) of the current milestone

### Version Track Labels (For Multi-Track Development)

When working on multiple version tracks simultaneously (e.g., v8.x.y maintenance and v9.0.0 development):

- `track:current` - For the current major version track (e.g., v8.x.y)
- `track:next` - For the next major version track (e.g., v9.0.0)
- `track:maintenance` - For the maintenance version track (e.g., v7.x.y)

### Version Increment Labels (Optional)

When you need to be more specific about the type of version change:

- `semver:patch` - Changes that don't affect the API (bug fixes)
- `semver:minor` - Backward-compatible new features
- `semver:major` - Breaking changes (typically assigned to major milestone directly)

### Priority Labels (Optional)

- `priority:high` - Critical fixes that should be prioritized
- `priority:medium` - Important but not critical
- `priority:low` - Nice to have, can be deferred if needed

## Label Usage Guidelines

### Apply Labels to Both Issues and PRs

For a complete release management system, apply these labels to both issues and PRs:

#### For Issues:

- Labels help plan and communicate when a feature or fix will be addressed
- They provide context for contributors about priority and release targets
- They allow for filtering in project boards and milestone planning

#### For PRs:

- Labels determine which PRs go into which release
- They guide the release manager on what to include when creating a release
- They track the progress of work toward specific releases

### Label Combinations

The power of this system comes from combining labels:

#### For Single-Track Development:

- `release:next` + `semver:patch` = Next patch release
- `release:next` + `semver:minor` = Next minor release
- `release:future` + `semver:patch` = Future patch release
- `release:future` + `semver:minor` = Future minor release

#### For Multi-Track Development:

- `track:current` + `release:next` = Next release in current major version
- `track:next` + `release:next` = Next release in upcoming major version
- `track:maintenance` + `release:next` = Next release in maintenance version
- `track:current` + `release:future` + `semver:minor` = Future minor release in current version

This approach allows for precise targeting of changes across multiple development tracks.

## End-to-End Workflow

Here's how to use this system throughout the development lifecycle:

### 1. Issue Creation and Triage

When an issue is created or triaged:

1. Assign the appropriate milestone:

   - `9.0.0` for breaking changes in the next major version
   - `8.x.y` for changes to be included after 8.0.0

2. Add appropriate labels:
   - Version track label (`track:current`, `track:next`, or `track:maintenance`) if working on multiple tracks
   - `semver:patch`, `semver:minor`, or `semver:major` to indicate change type
   - `release:next` or `release:future` to indicate timing
   - Priority label if needed

### 2. PR Creation

When a PR is created to address an issue:

1. Link it to the related issue (which transfers the milestone)
2. Copy the same labels from the issue
3. Update labels if implementation details changed the scope

### 3. Release Planning

When planning a release:

1. Filter PRs by milestone and `release:next` to see what's ready
2. Use the `semver:` labels to determine if you're doing a patch or minor release
3. Use priority labels to make decisions if you need to defer some changes

### 4. Release Execution

Our automated release process in `.github/workflows/release-shared.yml` handles:

1. Validating release parameters
2. Calculating version numbers
3. Building and verifying packages
4. Updating configurations for major releases
5. Creating tags and publishing to NPM

To trigger a release:

1. Go to the Actions tab in GitHub
2. Select either "Manual Release Publish" or "Manual Pre-Release Publish"
3. Choose the branch, version increment type, and whether it's a dry run
4. Review the workflow output to ensure everything is correct

### 5. Post-Release

After a release is complete:

1. Close issues and PRs that were included
2. Update `release:future` to `release:next` for the next batch
3. Review and adjust priorities for the next release

## GitHub Projects Integration

For better visualization of your release plan:

1. Create a GitHub Project board with columns for:

   - Upcoming releases (8.0.1, 8.1.0, etc.)
   - Priority levels within each release

2. Add automation rules:

   - Move issues/PRs based on label changes
   - Group items by milestone and release type

3. Use the board during release planning meetings to:
   - Visualize the scope of upcoming releases
   - Make decisions about what to include or defer
   - Communicate the plan to the team

## Setting Up Version Track Labels

To implement the multi-track development approach, create the following labels in your GitHub repository:

1. **Version Track Labels**:

   - `track:current` - Color: `#0075ca` (blue) - For the current major version track
   - `track:next` - Color: `#a2eeef` (light blue) - For the next major version track
   - `track:maintenance` - Color: `#fbca04` (yellow) - For the maintenance version track

2. **Using Track Labels**:

   - Apply these labels in combination with the existing release timing labels
   - For example, a bug fix for the next patch release of the current version would have both `track:current` and `release:next` labels
   - A feature for the next major version would have both `track:next` and `release:next` labels

3. **Filtering with Track Labels**:
   - Use these labels to create filtered views in GitHub Projects
   - Create saved searches like `is:open label:track:current label:release:next` to see all issues targeted for the next release of the current version

This approach provides clarity when working on multiple version tracks simultaneously and helps prevent confusion about which version a change is intended for.

## Benefits of This Approach

- **Cleaner milestone list**: Avoids proliferation of milestones
- **Flexibility**: Easy to move issues between releases
- **Better filtering**: Combine milestone and label filters for precise queries
- **Semantic clarity**: Labels clearly indicate the type of change
- **Multi-track development support**: Clear distinction between changes for different version tracks
- **Parallel development workflows**: Enables simultaneous work on maintenance, current, and next major versions
- **Matches our workflow**: Aligns with our automated release process
- **Improved communication**: Clear expectations for when changes will be released
