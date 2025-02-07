# WDIO Electron Package Bundler

<a href="https://www.npmjs.com/package/@wdio/electron-bundler" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/@wdio/electron-bundler" /></a>
<a href="https://www.npmjs.com/package/@wdio/electron-bundler" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/@wdio/electron-bundler" /></a>

<br />

## Overview

The WDIO Electron Package Bundler provides a set of utilities and plugins for configuring Rollup to build packages in this repository. It simplifies the build process by providing common configurations and specialized plugins for both ESM and CommonJS output formats.

## Core Features

### Utility Functions

#### `readPackageJson()`

Returns configuration based on your package.json:

- Input paths for Rollup
- Package name
- Output directories for ESM/CJS builds

### Plugins

#### 1. TypeScript Plugin

Configures TypeScript compilation with declaration file generation.

```ts
import { typescript } from '@wdio/electron-bundler';
export default {
  plugins: [
    typescript({
      // optional TypeScript options
    }),
  ],
};
```

#### 2. Package.json Generator (`emitPackageJsonPlugin`)

Generates appropriate package.json files for ESM and CJS builds with correct module type settings.

#### 3. Warning Handler (`warnToErrorPlugin`)

Elevates build warnings to errors to ensure clean production builds.

#### 4. Dependency Injector (`injectDependencyPlugin`)

Injects library dependencies into specific code locations during ESM builds.

Configuration options:
| Option | Description |
|--------|-------------|
| `packageName` | Name of the library to inject |
| `targetFile` | Target bundle file for injection |
| `importName` | Variable name for the imported library |
| `bundleRegExp` | RegExp pattern to identify injection points |
| `bundleReplace` | Function to generate replacement code |

### External Plugins

The package also exports:

- `nodeExternals` from 'rollup-plugin-node-externals'
- `nodeResolve` from '@rollup/plugin-node-resolve'
