# WDIO Electron Package Bundler

<a href="https://www.npmjs.com/package/@wdio/electron-bundler" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/@wdio/electron-bundler" /></a>
<a href="https://www.npmjs.com/package/@wdio/electron-bundler" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/@wdio/electron-bundler" /></a>

<br />

## Description

This package provides the common functions needed to configure `rollup` and the plugins needed to build packages hosted by this repository.

## Common functions

1. `readPackageJson`.
   　　This function returns the `input` option for `rollup`, package name, and `output.dir` values ​​for each esm/cjs based on the definition of `package.json`.

## Pulugins

1. 'rollup-plugin-node-externals'

1. '@rollup/plugin-node-resolve'

1. '@rollup/plugin-typescript'
   Returns the typescript plugin that contains settings for generating type decoration files.

1. The common parameter between each packages managed by this monorepo
   Please update `src/config.ts`. There is all rollup configuration include automatically generated.

1. The package specific parameter
   Please set the parameters for `createRollupConfig()` in `rollup.config.ts` in the package that needs to be changed.

1. `emitPackageJsonPlugin`
   Generates package.json with the type corresponding to each of esm/cjs.

1. `warnToErrorPlugin`
   Marks warnings generated during Bundle as errors. This plugin exists because the Production Build must occur without warnings.

1. `injectDependencyPlugin`
   When building with ESM, this plugin realize the process of inserting the source code of a dependent library into a specific part of a function.

   |  parameter  | overview                                                                                           |
   | :---------: | -------------------------------------------------------------------------------------------------- |
   | packageName | Package name of the injected library                                                               |
   | targetFile  | Name for the bundle file that is injected library                                                  |
   | importName  | Variable name assigned to the imported library                                                     |
   |     re      | Regular expression to identify substitutions for bundles of injected library                       |
   |   replace   | A function that generates replaced code for a replacement target specified by a regular expression |
