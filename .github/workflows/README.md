# CI/CD Workflows

This directory contains the GitHub Actions workflows for CI/CD processes.

## Artifact Retention Policy

Build artifacts are stored using GitHub Actions cache with the following characteristics:

- **Retention Period**: ~90 days (compared to 1 day for standard GitHub Actions artifacts)
- **Implementation**: Uses actions/cache instead of actions/upload-artifact
- **Automatic Cleanup**: GitHub automatically evicts unused caches after ~90 days
- **Cache Keys**: Based on runner OS, workflow run ID, and content hash
- **Rerun Behavior**: When a workflow job is rerun, the previous cache is automatically deleted and replaced with a new one

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

## Required Permissions

Some workflows require specific permissions:

- **Cache Deletion**: When rerunning jobs, the workflow requires `actions: write` permission to delete old caches
  ```yaml
  permissions:
    actions: write # Required for deleting and overwriting caches during reruns
  ```
