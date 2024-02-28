# Development

## Prerequisites

Development and building the service locally requires [Node.JS](https://nodejs.org) (>= 16) with [PNPM](https://pnpm.io) as a package manager.

To start with development, use e.g. [NVM](https://github.com/nvm-sh/nvm) to install an appropriate version of NodeJS, then [install PNPM](https://pnpm.io/installation), check out the repo with git, and run the following command:

```bash
pnpm init-dev
```

This will initialise the repo and set up `husky`, which is used for git commit hooks in combination with `lint-staged`.

## Testing

E2E / Integration tests can be run locally via:

```bash
pnpm test:integration-local
```

And unit tests (using [Vitest](https://vitest.dev/)) can be run via:

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

## Formatting

The repo uses [Prettier](https://prettier.io) for formatting. It is encouraged to format code on save using, e.g. the [Prettier plugin for VSCode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode), however Prettier is configured to run on git pre-commit hook to ensure consistent formatting across the repo. Prettier can be invoked manually via:

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

Project maintainers can publish a release or pre-release of the npm package by manually running the [`Manual NPM Publish`](https://github.com/webdriverio-community/wdio-electron-service/actions/workflows/release.yml) GitHub Workflow. They will choose the release type to trigger a `major` , `minor`, or `patch` release following [Semantic Versioning](https://semver.org/).

To publish a release, run the Workflow with default **Branch** `main` and **NPM Tag** `latest` and the appropriate **Release Type**. This will:

* Create a Git tag
* Create a GitHub Release
* Publish to npm

To publish a pre-release, also referred to as a test release, run the Workflow with the **NPM Tag** `next`. This will:

* Create a Git tag with the `-next.0` suffix. Consecutive pre-releases will increment the last number.
* Create a GitHub Pre-Release
* Publish to npm

The workflow uses [`release-it`](https://github.com/release-it/release-it?tab=readme-ov-file#release-it-) to do most of the work for us.
