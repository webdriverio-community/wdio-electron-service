# Bundler Test Fixtures

This directory contains test fixtures for the `@wdio/electron-bundler` package.

## Structure

### Package Fixtures

**`cjs/` and `esm/`** - Full package fixtures for integration testing:

- `no-config/` - Package using bundler defaults (no config file)
- `simple-ts-config/` - Package with basic TypeScript bundler config
- `complex-transformations/` - Package with advanced config (nodeExternals, transformations)

Each package fixture contains:

- `package.json` - Package configuration
- `src/index.ts` - Source code to be bundled
- `wdio-bundler.config.ts` - Bundler configuration (if applicable)

### Standalone Config Fixtures

**`configs/`** - Standalone config files for unit testing config loading:

- `valid-ts-config.ts` - Valid TypeScript config for testing tsx loading
- `invalid-syntax.ts` - Config with syntax errors for testing error handling
- `minimal-config.json` - Minimal JSON config for testing JSON loading
- `complex-config.js` - JavaScript config with functions and environment variables
- `missing-exports.ts` - Config with no default export for testing validation

## Usage in Tests

```typescript
// Test full package builds (integration)
const cjsPackage = getBundlerFixturePath('cjs', 'simple-ts-config');
await runBundlerBuild(cjsPackage);

// Test config loading (unit tests)
const configFile = getBundlerConfigPath('valid-ts-config.ts');
const config = await loadConfigFile(configFile);
```

## Note

The linter errors in fixture files are expected since they're not in a context where the bundler package is available. These fixtures are designed to be used by tests that have the proper setup and dependencies.
