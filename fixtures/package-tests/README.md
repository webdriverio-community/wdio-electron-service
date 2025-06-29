# Example Applications

This directory contains simple example Electron applications that serve two purposes:

1. Demonstrate different ways to use `wdio-electron-service` in real-world applications
2. Serve as package tests to validate basic service functionality during development

These examples are intentionally minimal and unlikely to be expanded in scope; the E2E test suite used for fully testing service functionality can be found in the [e2e](/e2e) directory and the apps which are tested by that suite are in the [e2e-apps](/fixtures/e2e-apps/) directory.

Note that the examples are fully self-contained with no dependency on other parts of the repo, this is to ensure that they can be copied to a temporary directory and executed as part of the [package testing](/scripts/test-examples.ts).

## Available Examples

### [builder-app](./builder-app/)

```
📦 Electron Builder + electron-vite
├── Uses Electron Builder for packaging
├── TypeScript support
├── Version and app name IPC examples
└── Tests covering app functionality and electron APIs
```

### [forge-app](./forge-app/)

```
🔨 Electron Forge + electron-vite
├── Uses Electron Forge for packaging
├── TypeScript support
├── Version and app name IPC examples
└── Tests covering app functionality and electron APIs
```

### [script-app](./script-app/)

```
📝 Simple npm scripts + electron-vite
├── Minimal configuration approach
├── TypeScript support
├── Version and app name IPC examples
└── Tests covering app functionality and electron APIs
```

## Common Features

All examples demonstrate:

- electron-vite for building and development
- TypeScript support
- IPC communication between main and renderer processes
- WebdriverIO test configuration and patterns
- Context isolation and security best practices
- Modern Electron application structure

## Testing Features Demonstrated

### Core Service Features

- ✅ Electron API Access via `browser.electron.execute()`
- ✅ IPC Communication Testing
- ✅ Security Validation (context isolation, preload scripts)

### UI Testing

- ✅ Element Interaction
- ✅ Content Validation
- ✅ Dynamic Updates

## Quick Start

Each example can be run independently:

```bash
cd <example-directory>

# Install dependencies
pnpm install

# Build the app (for builder and forge examples)
pnpm build

# Run the tests
pnpm test
```
