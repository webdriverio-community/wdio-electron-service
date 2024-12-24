import { existsSync } from 'node:fs';
import { basename, dirname, join, posix, relative, sep } from 'node:path';
import { readPackageUpSync, type NormalizedReadResult } from 'read-package-up';

import debug from './log';
import { type RollupWdioElectronServiceOptions } from '.';

const findEntryPoint = (name: string, rootDir: string, srcDir: string) => {
  debug(`Attempting to find entry point: ${name}`);
  const fileCandidates = [
    `${name}.ts`,
    join(name, `index.ts`),
    `${name}.mts`,
    join(name, `index.mts`),
    `${name}.cts`,
    join(name, `index.cts`),
  ];
  for (const candidate of fileCandidates) {
    const srcPath = join(srcDir, candidate);
    const checkPath = join(rootDir, srcPath);
    debug(`Checking path: ${checkPath}`);
    if (existsSync(checkPath)) {
      const posixPath = normalizeToPosix(srcPath);
      debug(`Found entry point: ${posixPath}`);
      return posixPath;
    }
  }
  throw new Error(`entry point is not found: ${name}`);
};

export const getFieldMissingErrorMessage = (field: string, path: string) => {
  return `"${field}" field which is required is not set: ${path}`;
};

const normalizeToPosix = (path: string) => posix.join(...path.split(sep));

export const getInputConfig = (pkg: NormalizedReadResult, srcDir: string) => {
  debug(`Resolving entry points using exports field`);
  const exportsValue = pkg.packageJson.exports;
  if (!exportsValue) {
    throw new Error(getFieldMissingErrorMessage('exports', pkg.path));
  }

  const rootDir = dirname(pkg.path);
  const config = Object.keys(exportsValue).reduce((acc: Record<string, string>, key) => {
    debug(`Resolving the entry point: ${key}`);
    const name = basename(key) === '.' ? 'index' : relative('.', key);
    acc[normalizeToPosix(name)] = findEntryPoint(name, rootDir, srcDir);
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

export const resolveConfig = (options: RollupWdioElectronServiceOptions) => {
  const defaultOptions = {
    typescriptOptions: {},
    externalOptions: {},
  };

  return Object.assign({}, defaultOptions, options) as Required<RollupWdioElectronServiceOptions>;
};
