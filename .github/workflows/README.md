# CI/CD Workflows

This directory contains the GitHub Actions workflows for CI/CD processes.

## Artifact Retention Policy

Our workflows use a dual-storage approach combining cache and artifacts for maximum reliability:

- **Primary Storage**: GitHub Actions cache (90-day retention)

  - Faster access times and longer retention
  - Deterministic keys based on runner OS, workflow run ID, and content hash
  - Automatically deleted and replaced during reruns (requires `actions: write` permission)

- **Fallback Storage**: GitHub Actions artifacts (1-day default retention)
  - Provides redundancy when cache retrieval fails
  - Immune to cache eviction policies
  - Configurable retention via `retention-days` parameter

**Implementation Flow**:

- Parallel upload to both cache and artifacts
- Download attempts cache first, falls back to artifacts if needed
- Ensures both long-term availability and reliable access

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
