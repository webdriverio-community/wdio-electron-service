import { existsSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { readPackageUpSync, type NormalizedReadResult } from 'read-package-up';
import { type PartialCompilerOptions } from '@rollup/plugin-typescript';

import debug from './log';
import { type RollupWdioElectronServiceOptions } from '.';

const findEntryPoint = (name: string, rootDir: string, srcDir: string) => {
  debug(`Attempting to find entry point: ${name}`);
  const fileCandidates = [
    `${name}.ts`,
    `${name}/index.ts`,
    `${name}.mts`,
    `${name}/index.mts`,
    `${name}.cts`,
    `${name}/index.cts`,
  ];
  for (const candidate of fileCandidates) {
    const srcPath = join(srcDir, candidate);
    const checkPath = join(rootDir, srcPath);
    debug(`Checking path: ${checkPath}`);
    if (existsSync(checkPath)) {
      debug(`Found entry point: ${srcPath}`);
      return srcPath;
    }
  }
  throw new Error(`entry point is not found: ${name}`);
};

export const getFieldMissingErrorMessage = (field: string, path: string) => {
  return `"${field}" field which is required is not set: ${path}`;
};

export const getInputConfig = (pkg: NormalizedReadResult, srcDir: string) => {
  debug(`Resolving entry points using exports field`);
  const exportsValue = pkg.packageJson.exports;
  if (!exportsValue) {
    throw new Error(getFieldMissingErrorMessage('exports', pkg.path));
  }

  const rootDir = dirname(pkg.path);
  const config = Object.keys(exportsValue).reduce((acc: Record<string, string>, key) => {
    debug(`Resolving entry points using exports field value: ${key}`);
    const name = basename(key) === '.' ? 'index' : relative('./', key);
    acc[name] = findEntryPoint(name, rootDir, srcDir);
    return acc;
  }, {});

  debug(`Resolved all entry points`);
  return config;
};

export const getPackageJson = (cwd: string) => {
  debug(`Attempting to load the package.json from ${cwd}`);
  const pkg = readPackageUpSync({ cwd });
  if (!pkg || !pkg.packageJson) {
    throw new Error(`Failed to load the package.json`);
  }
  debug(`Loaded the package.json from ${pkg.path}`);
  return pkg;
};

export const getOutputParams = (pkg: NormalizedReadResult) => {
  const requiredFields = ['name', 'main', 'module'] as const;

  debug(`Attempting to resolve output parameters`);
  debug(`Checking required fields of package.json: ${requiredFields.join(', ')}`);
  requiredFields.forEach((field) => {
    if (!pkg.packageJson[field]) {
      throw new Error(getFieldMissingErrorMessage(field, pkg.path));
    }
  });
  debug(`All required fields are set`);

  const params = {
    name: pkg.packageJson.name!,
    cjsDir: dirname(pkg.packageJson.main!),
    esmDir: dirname(pkg.packageJson.module!),
  };

  debug(`Resolved output parameters: ${JSON.stringify(params)}`);
  return params;
};

export const resolveCompilerOptions = (
  defaultOptions: PartialCompilerOptions,
  inputOptions: PartialCompilerOptions,
) => {
  const config = Object.assign({}, inputOptions, defaultOptions);

  debug(`Generated typescript compiler options: ${JSON.stringify(config, null, 2)}`);
  return config;
};

type ResolvedRollupWdioElectronServiceOptions = Required<RollupWdioElectronServiceOptions>;

export const getConfigPrams = (options: ResolvedRollupWdioElectronServiceOptions) => {
  const pkg = getPackageJson(options.rootDir);

  const inputConfig = getInputConfig(pkg, options.srcDir);
  const outputParams = getOutputParams(pkg);

  return {
    inputConfig,
    outputParams,
  };
};

export const resolveConfig = (options: RollupWdioElectronServiceOptions) => {
  const defaultOptions: ResolvedRollupWdioElectronServiceOptions = {
    rootDir: process.cwd(),
    srcDir: 'src',
    rollupOptions: {},
    compilerOptions: {},
    externalOptions: {},
  };

  return Object.assign({}, defaultOptions, options) as ResolvedRollupWdioElectronServiceOptions;
};
