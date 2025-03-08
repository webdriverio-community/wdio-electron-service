# Maintenance Branch for ${NEW_LTS_BRANCH}

This is a maintenance branch for the ${NEW_LTS_BRANCH}.x.y releases of WebdriverIO Electron Service.

## Purpose

This branch receives:

- Bug fixes
- Security updates
- Documentation improvements
- Minor enhancements that don't break compatibility

## Release Process

To create a release from this branch:

1. Use the GitHub Actions workflow "Manual Release Publish"
2. Select "maintenance" as the branch
3. Select "patch" or "minor" as the release type

## Labeling

PRs targeting this branch should use:

- `track:maintenance` - To indicate this is for the maintenance track
- `release:next` or `release:future` - To indicate release timing
- `semver:patch` or `semver:minor` - To indicate change type
