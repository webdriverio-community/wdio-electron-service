# CI/CD Workflows

This directory contains the GitHub Actions workflows for CI/CD processes.

## Artifact Retention Policy

Build artifacts are stored using GitHub Actions cache with the following characteristics:

- **Retention Period**: ~90 days (compared to 1 day for standard GitHub Actions artifacts)
- **Implementation**: Uses actions/cache instead of actions/upload-artifact
- **Automatic Cleanup**: GitHub automatically evicts unused caches after ~90 days
- **Cache Keys**: Based on runner OS, workflow run ID, and content hash

## Workflow Structure

- **Main CI Pipeline**: `ci.yml` - Orchestrates all CI processes
- **Build**: `_ci-build.reusable.yml` - Builds all packages using Turbo
- **Unit Tests**: `_ci-unit.reusable.yml` - Runs unit tests for all packages
- **E2E Tests**: `_ci-e2e.reusable.yml` - Runs E2E tests across different configurations
- **Linting**: `_ci-lint.reusable.yml` - Performs code quality checks

## Shared Actions

Custom actions in `.github/workflows/actions/`:

- **upload-archive**: Compresses and uploads build artifacts to cache
- **download-archive**: Downloads and extracts artifacts from cache
- **setup-workspace**: Sets up Node.js and PNPM environment
