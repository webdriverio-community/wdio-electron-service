# CI/CD Workflows

This directory contains the GitHub Actions workflows for CI/CD processes.

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

## Build Strategy

Our CI pipeline uses a single-source-of-truth approach for build artifacts:

- **Linux Build Job**: Generates artifacts used by all downstream jobs
  - Creates consistent, reliable build artifacts across all platforms
  - Produces a single cache key that's passed to all dependent jobs
  - Ensures exact same build artifacts are used in all tests

- **Windows Build Job**: Runs separately for validation purposes
  - Verifies the code builds correctly on Windows environments
  - Catches Windows-specific build issues early
  - Does not generate artifacts used by other jobs

This approach ensures maximum reliability in artifact sharing while still validating cross-platform build compatibility.

## Artifact Storage Strategy

Our workflows implement a robust two-tier storage approach for build artifacts:

- **Primary Storage: GitHub Actions Cache**
  - 90-day retention (vs. 1-day for standard artifacts)
  - Faster access times for subsequent jobs
  - Deterministic keys based on runner OS, workflow run ID, and content hash
  - Automatically managed during reruns (requires `actions: write` permission)

- **Fallback Storage: GitHub Actions Artifacts**
  - Provides redundancy when cache retrieval fails
  - Immune to cache eviction policies
  - Configurable retention periods

**Implementation**:

- Artifacts are uploaded to both storage systems in parallel
- Download process tries cache first, falls back to artifacts when needed
- Ensures both long-term availability and maximum reliability

## Required Permissions

Some workflows require specific permissions:

- **Cache Deletion**: When rerunning jobs, the workflow requires `actions: write` permission to delete old caches
  ```yaml
  permissions:
    actions: write # Required for deleting and overwriting caches during reruns
  ```
