# Development

## Prerequisites

Development and building the service locally requires [Node.JS](https://nodejs.org) (>= 18) with [PNPM](https://pnpm.io) as a package manager -- and Git, obviously.

To start with development, use e.g. [NVM](https://github.com/nvm-sh/nvm) to install an appropriate version of NodeJS, then [install PNPM](https://pnpm.io/installation). Once that is done you can check out the repo with git, and install the dependencies with PNPM.

[Husky](https://typicode.github.io/husky/) is used for git commit hooks in combination with [`lint-staged`](https://github.com/lint-staged/lint-staged). \
[Turborepo](https://turbo.build) is used to handle builds and testing.

## Rebuilding on file changes

During development it is helpful to rebuild the main package and dependencies when files change. To do this, run the dev script in a new terminal:

```bash
pnpm dev
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

OR

```bash
pnpm test:dev
```

...for running the tests in watch mode.

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

**[Help Wanted Issues](https://github.com/webdriverio-community/wdio-electron-service/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22help+wanted%22)** \
**[Good First Issues](https://github.com/webdriverio-community/wdio-electron-service/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22good+first+issue%22)**

## Release

Project maintainers can publish a release or pre-release of the npm package by manually running the [`Manual NPM Publish`](https://github.com/webdriverio-community/wdio-electron-service/actions/workflows/release.yml) GitHub workflow. They will choose the release type to trigger a `major` , `minor`, or `patch` release following [Semantic Versioning](https://semver.org/), or a pre-release. The workflow uses [`release-it`](https://github.com/release-it/release-it?tab=readme-ov-file#release-it-) to do most of the work for us.

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
