# WebdriverIO Electron Service E2E Tests

This directory contains end-to-end tests for the WebdriverIO Electron Service.

## Test Structure

The tests are organized by test type:

- **Standard Tests**: Basic API tests that run in the main Electron process
- **Window Tests**: Tests that interact with Electron windows
- **Multiremote Tests**: Tests that use WebdriverIO's multiremote feature
- **Standalone Tests**: Tests that run without WebdriverIO's test runner

Each test type can be run against different platforms and module types:

- **Platforms**: `builder`, `forge`, `no-binary`
- **Module Types**: `cjs`, `esm`
- **Binary**: `true` or `false` (whether to use a packaged app or not)

## Optimized Test Workflow

To avoid duplicating setup work, the test suite is designed to prepare the test apps once and reuse them for all tests. This significantly reduces the time needed to run multiple tests.

### Preparing Test Apps

Before running tests, you can prepare the test apps once:

```bash
pnpm run prepare-apps
```

This will:

1. Package the wdio-electron-service
2. Copy the example apps
3. Install dependencies
4. Set up the test environment

The prepared apps will be stored in a temporary directory, and the environment variables `WDIO_TEST_APPS_PREPARED` and `WDIO_TEST_APPS_DIR` will be set to indicate that the apps are ready.

### Running Tests

After preparing the apps, you can run tests without having to prepare the apps again:

```bash
# Run all tests
pnpm run test:all

# Run a specific test
pnpm run test:standard
pnpm run test:window
pnpm run test:multiremote
pnpm run test:standalone

# Run tests for a specific platform and module type
pnpm run test:builder:cjs
pnpm run test:builder:esm
pnpm run test:forge:cjs
pnpm run test:forge:esm
pnpm run test:no-binary:cjs
pnpm run test:no-binary:esm
```

## Monitoring Test Progress

### Status Monitor (Default)

When you run `pnpm run test:all` or `pnpm run test:matrix`, a full-screen status monitor is displayed by default. This monitor shows:

- Overall test progress
- Number of passed, failed, and skipped tests
- Currently running tests
- Elapsed time
- Last updated timestamp

The status monitor provides a clean, real-time overview of your test execution without overwhelming you with detailed logs.

### Viewing Detailed Logs

There are two ways to view detailed test logs:

#### 1. Real-time Log Monitoring

To view detailed logs in real-time while tests are running, open a separate terminal window and run:

```bash
pnpm run logs
```

This TypeScript-based log monitor will:

- Display all test logs with colorized output
- Highlight test results (passed, failed, skipped)
- Show detailed error messages and stack traces
- Update in real-time as tests progress

#### 2. View All Logs After Tests Complete

To view all logs after tests have completed:

```bash
pnpm run cat-logs
```

This will display the contents of all log files created during test execution.

## Cleaning Up

To clean up temporary directories and logs:

```bash
# Clean up temporary directories
pnpm run clean:temp-dirs

# Clean up logs
pnpm run clean:logs

# Clean up everything
pnpm run clean
```
