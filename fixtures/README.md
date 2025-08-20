# Test Fixtures

This directory contains test fixtures organized by functional domain for the WebdriverIO Electron Service packages.

## Structure

### `config-formats/`

Configuration file format testing for all build tools (electron-builder, electron-forge, bundler):

- **Bundler configs**: `valid-ts-config.ts`, `minimal-config.json`, `complex-config.js`, `invalid-syntax.ts`, `missing-exports.ts`
- **Builder configs**: Various formats (`builder-dependency-*-config/`) testing TypeScript, JavaScript, JSON, YAML, TOML, etc.
- **Forge configs**: Various formats (`forge-dependency-*-config/`) testing JavaScript configs, inline configs, linked configs

### `package-scenarios/`

Package.json and dependency scenarios for testing package analysis:

- **Electron dependencies**: `electron-in-dependencies/`, `electron-in-dev-dependencies/`, `no-electron/`, `old-electron/`
- **Build tools**: `no-build-tool/`, `multiple-build-tools-*`, `no-app-name-in-build-tool-config/`
- **Monorepos**: `pnpm-workspace/` - PNPM workspace and catalog functionality

### `build-cjs/` & `build-esm/`

Complete packages for testing actual build and bundling processes:

- **CJS packages**: `no-config/`, `simple-ts-config/`, `complex-transformations/`
- **ESM packages**: `no-config/`, `simple-ts-config/`, `build-test-esm/`

Each package contains:

- `package.json` - Package configuration
- `src/index.ts` - Source code to be bundled
- `wdio-bundler.config.ts` - Bundler configuration (if applicable)

### `e2e-apps/`

Complete Electron applications for end-to-end testing:

- **Builder-based**: `builder-cjs/`, `builder-esm/`
- **Forge-based**: `forge-cjs/`, `forge-esm/`
- **No-binary**: `no-binary-cjs/`, `no-binary-esm/`

## Usage in Tests

```typescript
// Package scenario testing
const pkg = await getFixturePackageJson('package-scenarios', 'electron-in-dependencies');

// Config format testing
const configPath = path.join('fixtures', 'config-formats', 'valid-ts-config.ts');

// Build testing
const buildPath = path.join('fixtures', 'build-cjs', 'simple-ts-config');

// E2E testing
const appPath = path.join('fixtures', 'e2e-apps', 'forge-esm');
```

## Migration Notes

This structure replaces the previous package-specific and module-type-based organization:

- **Before**: `fixtures/cjs/`, `fixtures/esm/`, `fixtures/bundler/`, `fixtures/pnpm/`
- **After**: Functional domains with clear separation of concerns

The new organization makes it easier to:

- Find fixtures by what they test rather than technical implementation
- Add new scenarios without restructuring
- Understand fixture purpose from directory name
- Reduce duplication between CJS/ESM when scenarios are identical
