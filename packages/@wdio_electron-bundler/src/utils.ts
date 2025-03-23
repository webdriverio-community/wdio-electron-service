import { existsSync } from 'node:fs';
import { basename, dirname, join, posix, relative } from 'node:path';
import { readPackageUpSync, type NormalizedReadResult } from 'read-package-up';

import debug from './log';
import { PluginContext, rollup } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';

const normalizeToPosix = (path: string) => {
  // Handle both forward and backslashes
  const normalized = path.replace(/\\/g, '/');
  return posix.normalize(normalized);
};

const findEntryPoint = (name: string, rootDir: string, srcDir: string) => {
  debug(`Attempting to find entry point: ${name}`);
  // Normalize name to handle Windows paths
  const normalizedName = normalizeToPosix(name);

  const fileCandidates = [
    `${normalizedName}.ts`,
    posix.join(normalizedName, 'index.ts'),
    `${normalizedName}.mts`,
    posix.join(normalizedName, 'index.mts'),
    `${normalizedName}.cts`,
    posix.join(normalizedName, 'index.cts'),
  ];

  for (const candidate of fileCandidates) {
    // Use normalized paths for consistency
    const srcPath = posix.join(srcDir, candidate);
    // Convert to system-specific path for existsSync
    const checkPath = join(rootDir, srcPath);
    debug(`Checking path: ${checkPath}`);
    if (existsSync(checkPath)) {
      return normalizeToPosix(srcPath);
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
  const normalizedSrcDir = normalizeToPosix(srcDir);

  const config = Object.keys(exportsValue).reduce((acc: Record<string, string>, key) => {
    debug(`Resolving the entry point: ${key}`);
    const name = basename(key) === '.' ? 'index' : relative('.', key);
    const normalizedName = normalizeToPosix(name);
    acc[normalizedName] = findEntryPoint(normalizedName, rootDir, normalizedSrcDir);
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

export const getOutDirs = (pkg: NormalizedReadResult) => {
  const requiredFields = ['main', 'module'] as const;
  debug(`Attempting to resolve output parameters`);
  debug(`Checking required fields of package.json: ${requiredFields.join(', ')}`);
  requiredFields.forEach((field) => {
    if (!pkg.packageJson[field]) {
      throw new Error(getFieldMissingErrorMessage(field, pkg.path));
    }
  });
  debug(`All required fields are set`);

  const esm = dirname(pkg.packageJson.module!);
  const cjs = dirname(pkg.packageJson.main!);

  return { esm, cjs };
};

async function bundlePackage(this: PluginContext, packageName: string) {
  const entryPoint = await this.resolve(packageName);
  if (!entryPoint) {
    this.error(`${packageName} is not resolved.`);
  }
  // Create a Rollup bundle
  const bundle = await rollup({
    input: entryPoint.id,
    plugins: [nodeResolve()],
  });

  // Generate the bundled code
  const { output } = await bundle.generate({
    format: 'esm',
    name: packageName,
  });

  // Extract the bundled code as a string
  const bundledCode = output[0].code;

  // Return the bundled code
  return bundledCode;
}

export type InjectDependencyPluginOptions = {
  packageName: string;
  targetFile: string;
  importName: string;
  bundleRegExp: RegExp;
  bundleReplace: (importName: string) => string;
};

export async function injectDependency(
  this: PluginContext,
  injectPrams: InjectDependencyPluginOptions,
  templateContent: string,
): Promise<string> {
  try {
    const bundledContents = await bundlePackage.call(this, injectPrams.packageName);

    // Prepare the bundled contents for injection
    const injectedContents = bundledContents.replace(
      injectPrams.bundleRegExp,
      injectPrams.bundleReplace(injectPrams.importName),
    );

    if (injectedContents === bundledContents) {
      throw new Error(`Failed to generate injected contents`);
    }

    // Replace instances of the dynamic import in the template with the bundled contents
    const renderedContent = templateContent.replace(
      `const ${injectPrams.importName} = await import('${injectPrams.packageName}');`,
      injectedContents,
    );
    if (renderedContent === templateContent) {
      throw new Error(`Failed to inject contents of "${injectPrams.packageName}"`);
    }

    this.info(`Successfully bundled and injected "${injectPrams.packageName}" into ${injectPrams.targetFile}`);
    return renderedContent;
  } catch (error) {
    this.error(`Dependency injection failed: ${(error as Error).message}`);
  }
}
