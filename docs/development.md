# Development

## Prerequisites

Development and building the service locally requires [Node.JS](https://nodejs.org) (>= 18) with [PNPM](https://pnpm.io) as a package manager -- and Git, obviously.

To start with development, use e.g. [NVM](https://github.com/nvm-sh/nvm) to install an appropriate version of NodeJS, then [install PNPM](https://pnpm.io/installation). Once that is done you can check out the repo with git, and install the dependencies with PNPM.

[Husky](https://typicode.github.io/husky/) is used for git commit hooks in combination with [`lint-staged`](https://github.com/lint-staged/lint-staged).
[Turborepo](https://turbo.build) is used to handle builds and testing.

## Dependency Management

The project uses a catalog system to manage dependencies across all packages. There are three catalogs:

1. **`default`**: Production-ready configuration using stable versions
   - Example: `electron: "catalog:default"` (resolves to version ^32.0.1)
   - Provides a reliable, well-tested baseline

2. **`next`**: Forward-looking configuration with latest versions
   - Example: `electron-nightly: "catalog:next"` (latest nightly builds)
   - Validates compatibility with upcoming changes

3. **`minimum`**: Lowest supported versions
   - Example: `electron: "catalog:minimum"` (version ^28.0.0)
   - Ensures backward compatibility

### Switching Catalogs

To switch all packages to use a specific catalog:

```bash
# Switch to default catalog (stable versions)
pnpm catalog:default

# Switch to next catalog (latest/nightly versions)
pnpm catalog:next

# Switch to minimum catalog (lowest supported versions)
pnpm catalog:minimum
```

### Updating Catalog Versions

To update the versions in a catalog:

```bash
# Update a specific catalog
pnpm catalog:update

# Preview changes without applying them
pnpm catalog:update:dry

# Update all catalogs and other dependencies
pnpm update:all
```

You can also specify the catalog directly using shortcuts:

```bash
pnpm catalog:update --default  # Update default catalog
pnpm catalog:update --next     # Update next catalog
pnpm catalog:update --minimum  # Update minimum catalog
```

The update process will:

1. Show available updates for all packages in the selected catalog
2. Allow you to select which packages to update
3. Update the versions in the workspace file
4. Run `pnpm install` to apply the changes

For the `next` catalog specifically, the update process will:

- Fetch the latest electron-nightly version from npm
- Set other packages to use the most appropriate tag:
  - Checks all available tags (next, beta, alpha, latest)
  - Compares full semantic versions to find the highest version across all tags
  - Prioritizes cutting-edge tags in order: next > beta > alpha > latest
- Remove the electron dependency since only electron-nightly is used in this catalog

## Rebuilding on file changes

During development, it is helpful to rebuild files as they change, with respect to all packages. To do this, run the dev script in a new terminal:

```bash
pnpm dev
```

Alternatively, you can run it for each individual package.
For example, run the dev script for `@wdio/electron-utils` in a new terminal:

```bash
pnpm dev --filter "@wdio/electron-utils"
```

## Testing - E2Es

E2E tests can be run locally via:

```bash
pnpm test:e2e-local
```

```bash
pnpm test:e2e-mac-universal-local
```

Below are the task graphs for the E2Es:

![E2E Task Graph](../.github/assets/e2e-graph.png 'E2E Task Graph')

![Mac Universal E2E Task Graph](../.github/assets/e2e-graph-mac-universal.png 'Mac Universal E2E Task Graph')

Note: The E2E runner logs are saved per run in the configured `outputDir` and include service namespaces (e.g., `wdio-electron-service:service`). Enable debug output for all namespaces by setting `DEBUG=wdio-electron-service:*`.

## Testing - Units

Unit tests (using [Vitest](https://vitest.dev/)) can be run via:

```bash
pnpm test:unit
```

...in the root to run all of the tests for each package, OR

```bash
pnpm test:dev
```

...in each package directory to run tests in watch mode.

## Updating Dependencies

Dependencies can be updated interactively via:

```bash
pnpm update:interactive
```

and

```bash
pnpm update:interactive:dry
```

for a dry run.

## Updating E2E Task Graphs

Task graphs can be updated by running:

```bash
pnpm graph
```

## Formatting & Linting

The repo uses [Biome](https://biomejs.dev) for formatting and primary lint checks, alongside ESLint for additional rules.

- Format all files:

```bash
pnpm format
```

- Check formatting only (no writes):

```bash
pnpm format:check
```

- Lint (Biome + ESLint):

```bash
pnpm lint
```

- Lint with fixes:

```bash
pnpm lint:fix
```

## Contributing

Check the issues or [raise a new one](https://github.com/webdriverio-community/wdio-electron-service/issues/new) for discussion:

**[Help Wanted Issues](https://github.com/webdriverio-community/wdio-electron-service/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22help+wanted%22)**
**[Good First Issues](https://github.com/webdriverio-community/wdio-electron-service/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22good+first+issue%22)**

## Release

Project maintainers can publish a release or pre-release of the npm package by manually running the [`Manual NPM Publish`](https://github.com/webdriverio-community/wdio-electron-service/actions/workflows/release.yml) GitHub workflow. They will choose the release type to trigger a `major` , `minor`, or `patch` release following [Semantic Versioning](https://semver.org/), or a pre-release.

For detailed information about our release management process, including milestone structure, labeling system, and workflow, see the [Release Management](./release-management.md) documentation.

### Publish a Release

## Release Process

Project maintainers can publish releases using GitHub Actions workflows. The project follows a feature branch strategy with three main branch types, e.g.

- `main` - current stable version (e.g., v8.x)
- `feature/v9` - next major version development (e.g. v9.0.0-next.0)
- `v7.x` - maintenance/LTS branch

### Publishing Pre-releases

To publish a pre-release, run the [pre-release workflow](https://github.com/webdriverio-community/wdio-electron-service/actions/workflows/pre-release.yml):

1. Select the branch:
   - `feature` for next major (automatically resolves to current feature branch, e.g., feature/v9)
   - `main` for current version pre-releases
2. Choose the pre-release type:
   - `prepatch` - e.g., 8.2.4-alpha.0
   - `preminor` - e.g., 8.3.0-alpha.0
   - `premajor` - e.g., 9.0.0-alpha.0
   - `prerelease` - increment alpha/beta number
3. Optionally enable dry-run mode to preview the changes

### Publishing Releases

To publish a release, run the [release workflow](https://github.com/webdriverio-community/wdio-electron-service/actions/workflows/release.yml):

1. Select the branch:
   - `main` for current stable releases
   - `feature` for major version releases (automatically resolves to current feature branch)
   - `maintenance` for LTS releases (automatically resolves to current maintenance branch)
2. Choose the release type:
   - `patch` for bug fixes
   - `minor` for new features
   - `major` for breaking changes (only allowed from feature branch)
3. Optionally enable dry-run mode to preview the changes

### Major Version Releases

When releasing a new major version (e.g., v9.0.0):

1. Ensure all changes are ready in the feature branch
2. Run the release workflow with:
   - Branch: `feature`
   - Release type: `major`
3. This will automatically:
   - Create maintenance branch for current version (e.g., `v8.x`)
   - Update dependabot configuration
   - Archive old maintenance branch
   - Merge feature branch to main
   - Create GitHub release

### Maintenance Policy

- Current version (e.g., v8.x) receives all updates
- Previous version (e.g., v7.x) receives security updates and critical fixes
- Older versions are not maintained

### Branch Lifecycle

```
feature/v9 (development) → main (v9.x) → v9.x (maintenance)
                          main (v8.x) → v8.x (maintenance) → archived
                                       v7.x (maintenance) → archived
```

### Backporting Changes

In accordance with the maintenance policy, changes should be backported from the current stable version to the maintenance version. This ensures that critical fixes are available in both versions.

#### Backporting Process Overview

1. **Identify PRs for backporting**: PRs that contain fixes applicable to the maintenance version should be labeled with `backport:requested`
2. **Run the backport script**: After merging such PRs, run the backport script to cherry-pick changes to the maintenance branch
3. **Release backported changes**: Create a patch release from the maintenance branch using the release workflow

#### As a Triager

Anyone making a triage or reviewing a PR should label it with `backport:requested` if the changes can be applied to the maintained (previous) version. Generally every PR that would not be a breaking change for the previous version should be considered for backporting. If a change relies on features or code pieces that are only available in the current version, then a backport can still be considered if you feel comfortable making the necessary adjustments. That said, don't feel forced to backport code if the time investment and complexity is too high. Backporting functionality is a reasonable contribution that can be made by any contributor.

#### As a Merger

Once a PR with a `backport:requested` label is merged, you are responsible for backporting the patch to the older version. To do so, pull the latest code from GitHub:

```sh
git pull
git fetch --all
git checkout v7  # Replace with current maintenance branch (e.g., v8.x for v9 active)
```

Before you can start, you will need to create the file `.env` in the project root with the access token set as `GITHUB_TOKEN` in order to allow the executing script to fetch data about pull requests and set proper labels. Go to your [personal access token](https://github.com/settings/tokens) settings page and generate such a token with only the `public_repo` field enabled. Then copy the token to the `.env` file and run the backport script.

The script will:

1. Automatically determine the active and maintenance versions from package.json
2. If version detection fails, it will interactively ask you to confirm the versions
3. Fetch all commits connected with PRs labeled with `backport:requested`
4. Cherry-pick them into the maintenance branch

To start the process, just execute:

```sh
pnpm run backport
```

If during the process a cherry-pick fails, you can always abort and manually troubleshoot. If you are not able to resolve the problem, create an issue in the repo and include the author of that PR. A successful backport of two PRs will look like this:

```
$ pnpm run backport

> webdriverio-monorepo@ backport /path/to/webdriverio/webdriverio
> node ./scripts/backport.js

Welcome to the backport script for v7! 🚀
Will backport changes from v8 to v7

================================================================================
PR: #904 - ci: workaround for CI on linux
Author: mato533
URL: https://github.com/webdriverio-community/wdio-electron-service/pull/904
--------------------------------------------------------------------------------
✔ Do you want to backport this PR? Yes, I want to backport this PR.
Backporting sha 94bb9daa9ff24fce172f3fdf6d99ede98984a91e from v8 to v7
> git cherry-pick -x -m 1 94bb9daa9ff24fce172f3fdf6d99ede98984a91e
[v7 f5b1393] Merge pull request #904 from webdriverio-community/sm/ci-fix-linux
 Date: Fri Jan 24 10:24:30 2025 +0900
 1 file changed, 3 insertions(+)

================================================================================
PR: #908 - ci: add support to release multiple versions
Author: mato533
URL: https://github.com/webdriverio-community/wdio-electron-service/pull/908
--------------------------------------------------------------------------------
✔ Do you want to backport this PR? Yes, I want to backport this PR.
Backporting sha 7976224f74bd57ebafa38819d05ac4f937c957fe from v8 to v7
> git cherry-pick -x -m 1 7976224f74bd57ebafa38819d05ac4f937c957fe
[v7 bef1b08] Merge pull request #908 from webdriverio-community/sm/ci-release
 Author: goosewobbler <432005+goosewobbler@users.noreply.github.com>
 Date: Wed Jan 29 00:13:14 2025 +0000
 2 files changed, 15 insertions(+), 3 deletions(-)

Successfully backported 2 PRs 👏!
Please now push them to v7 and make a new v7.x release!
```

#### Creating a Backport Release

After successfully backporting changes:

1. Push the changes to the maintenance branch

   ```sh
   git push origin v7  # Replace with current maintenance branch
   ```

2. Create a patch release using the [release workflow](https://github.com/webdriverio-community/wdio-electron-service/actions/workflows/release.yml):
   - Select `maintenance` as the branch type
   - Choose `patch` as the release type
   - The workflow will automatically detect the current maintenance branch

This ensures that backported changes are properly versioned and released according to the project's maintenance policy.
