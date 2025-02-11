# Development

## Prerequisites

Development and building the service locally requires [Node.JS](https://nodejs.org) (>= 18) with [PNPM](https://pnpm.io) as a package manager -- and Git, obviously.

To start with development, use e.g. [NVM](https://github.com/nvm-sh/nvm) to install an appropriate version of NodeJS, then [install PNPM](https://pnpm.io/installation). Once that is done you can check out the repo with git, and install the dependencies with PNPM.

[Husky](https://typicode.github.io/husky/) is used for git commit hooks in combination with [`lint-staged`](https://github.com/lint-staged/lint-staged).
[Turborepo](https://turbo.build) is used to handle builds and testing.

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
pnpm update:all
```

## Updating E2E Task Graphs

Task graphs can be updated by running:

```bash
pnpm graph
```

## Formatting

The repo uses [Prettier](https://prettier.io) for formatting. It is encouraged to format code on save using, e.g. the [Prettier plugin for VSCode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode), however it is not a requirement; Husky is configured to run Prettier on git pre-commit hook to ensure consistent formatting across the repo.

Prettier can be invoked manually via:

```bash
pnpm format
```

And a formatting check (without updating any files) can be performed via:

```bash
pnpm format:check
```

## Linting

ESLint is used for linting, it can be performed via:

```bash
pnpm lint
```

and to apply auto-fix for issues raised:

```bash
pnpm lint:fix
```

## Contributing

Check the issues or [raise a new one](https://github.com/webdriverio-community/wdio-electron-service/issues/new) for discussion:

**[Help Wanted Issues](https://github.com/webdriverio-community/wdio-electron-service/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22help+wanted%22)**
**[Good First Issues](https://github.com/webdriverio-community/wdio-electron-service/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22good+first+issue%22)**

## Release

Project maintainers can publish a release or pre-release of the npm package by manually running the [`Manual NPM Publish`](https://github.com/webdriverio-community/wdio-electron-service/actions/workflows/release.yml) GitHub workflow. They will choose the release type to trigger a `major` , `minor`, or `patch` release following [Semantic Versioning](https://semver.org/), or a pre-release.

### Publish a Release

To publish a release, run the [release workflow](https://github.com/webdriverio-community/wdio-electron-service/actions/workflows/release.yml) with the defaults for **Branch** `main` and **NPM Tag** `latest`, and set the appropriate **Release Type** (`major`, `minor`, or `patch`). This will:

- Create a Git tag
- Create a GitHub Release
- Publish to npm

### Publish a Pre-Release

To publish a pre-release, also referred to as a test release, run the [pre-release workflow](https://github.com/webdriverio-community/wdio-electron-service/actions/workflows/pre-release.yml) with the **NPM Tag** `next`. This will:

- Create a Git tag with the `-next.0` suffix
- Create a GitHub Pre-Release
- Publish to npm

Use the **Release Type** to control which version to increment for the pre-release. The following table provides examples for publishing a pre-release from the current version `6.3.1`:

| Release Type | Pre-Release Version |
| ------------ | ------------------- |
| `major`      | `7.0.0-next.0`      |
| `minor`      | `6.4.0-next.0`      |
| `patch`      | `6.3.2-next.0`      |
| `existing`   | `6.3.1-next.0`      |

To create consecutive pre-releases you can select `existing` which will increment the pre-release version in the suffix. For example, if the current version is `6.3.1-next.3`, the following will be published:

| Release Type | Pre-Release Version |
| ------------ | ------------------- |
| `major`      | `7.0.0-next.0`      |
| `minor`      | `6.4.0-next.0`      |
| `patch`      | `6.3.2-next.0`      |
| `existing`   | `6.3.1-next.4`      |

### Major Version Maintenance Tasks

When releasing a new major version, update the maintenance branch references in the following files:

1. Update the release workflow

   - Edit `.github/workflows/release.yml`
   - In the `on.workflow_dispatch.inputs.branch.options` field, update the maintenance branch name
   - Example: When releasing v8, change `v6` to `v7` in the branch options

2. Update the Dependabot configuration
   - Edit `.github/dependabot.yml`
   - Update the existing maintenance branch configuration's `target-branch`
   - Example: When releasing v8, change `v6` to `v7` in the non-main branch configuration

## Maintenance policy

Starting from v8 the team intends to backport all features that would be still backwards compatible with older (maintained) versions. With a new major version update (e.g. v8) we continue to maintain the previous version (e.g. v7) and deprecate the previously maintained version (e.g. v6 and lower).

## Backporting Bug Fixes

In accordance with the maintenance policy, do the following to ensure that backwards-compatible fixes are reflected in the maintenance version.

### As a Triager

Anyone making a triage or reviewing a PR should label it with `backport-requested` if the changes can be applied to the maintained (previous) version. Generally every PR that would not be a breaking change for the previous version should be considered for backporting. If a change relies on features or code pieces that are only available in the current version, then a backport can still be considered if you feel comfortable making the necessary adjustments. That said, don't feel forced to backport code if the time investment and complexity is too high. Backporting functionality is a reasonable contribution that can be made by any contributor.

### As a Merger

Once a PR with a `backport-requested` label is merged, you are responsible for backporting the patch to the older version. To do so, pull the latest code from GitHub:

```sh
git pull
$ git fetch --all
$ git checkout v7
```

Before you can start, you will need to create the file `.env` in the project root with the access token set as `GITHUB_TOKEN` in order to allow the executing script to fetch data about pull requests and set proper labels. Go to your [personal access token](https://github.com/settings/tokens) settings page and generate such a token with only the `public_repo` field enabled. Then copy the token to the `.env` file and run the backport script. It fetches all commits connected with PRs that are labeled with `backport-requested` and cherry-picks them into the maintenance branch. Via an interactive console you can get the chance to review the PR again and whether you want to backport it or not. To start the process, just execute:

```sh
pnpm run backport
```

If during the process a cherry-pick fails, you can always abort and manually troubleshoot. If you are not able to resolve the problem, create an issue in the repo and include the author of that PR. A successful backport of two PRs will look like this:

```
$ pnpm run backport

> webdriverio-monorepo@ backport /path/to/webdriverio/webdriverio
> node ./scripts/backport.js

Welcome to the backport script for v7! 🚀

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
