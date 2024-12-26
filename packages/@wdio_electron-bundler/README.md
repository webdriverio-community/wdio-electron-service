# WDIO Electron Package Bundler

<a href="https://www.npmjs.com/package/@wdio/electron-bundler" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/@wdio/electron-bundler" /></a>
<a href="https://www.npmjs.com/package/@wdio/electron-bundler" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/@wdio/electron-bundler" /></a>

<br />

## Description

This package is creating rollup configuration for building up javascript code.
The configuration to build esm and cjs code will be created by this package.  
The `input` of Rollup option is auto detected based `exports` field of `package.json`.

## How to use

1. Add this library to the `devDependencies`.

1. Create the configuration file for rollup `rollup.config.ts`

   ```ts
   import { RollupOptionCreator } from '@wdio/electron-bundler';

   const creator = new RollupOptionCreator();

   export default creator.getConfigs();
   ```

## How to maintain rollup configuration

There are 2 options.

1. The common parameter between each packages managed by this monorepo
   Please update `src/config.ts`. There is all rollup configuration include automatically generated.

1. The package specific parameter
   Please set the parameters for `createRollupConfig()` in `rollup.config.ts` in the package that needs to be changed.

### Parameters

If the rollup parameters is necessary to customize depend on package requirements, use following parameters to change it.

|              parameter              | default         | overview                                                                                                                                                         |
| :---------------------------------: | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|               rootDir               | `process.cwd()` | The root directory for the package.                                                                                                                              |
|               srcDir                | `src`           | The root directory for input source code.                                                                                                                        |
| options.{cjs,esm}.typescriptOptions | `{}`            | The parameter for [`@rollup/plugin-typescript`](https://www.npmjs.com/package/@rollup/plugin-typescript). The parameter which is set by this library is override |
|  options.{cjs,esm}.externalOptions  | `{}`            | The parameter for [`rollup-plugin-node-externals`](https://www.npmjs.com/package/rollup-plugin-node-externals).                                                  |

**Types for the [WDIO Electron Service](https://github.com/webdriverio-community/wdio-electron-service)**
