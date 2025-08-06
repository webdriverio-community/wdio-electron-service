import { existsSync } from 'node:fs';
import { basename, dirname, join, posix, relative } from 'node:path';
import nodeResolve from '@rollup/plugin-node-resolve';
import { type NormalizedReadResult, readPackageUpSync } from 'read-package-up';
import { type PluginContext, rollup } from 'rollup';

const normalizeToPosix = (path: string) => {
  // Handle both forward and backslashes
  const normalized = path.replace(/\\/g, '/');
  return posix.normalize(normalized);
};

const findEntryPoint = (name: string, rootDir: string, srcDir: string) => {
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
  const exportsValue = pkg.packageJson.exports;
  if (!exportsValue) {
    throw new Error(getFieldMissingErrorMessage('exports', pkg.path));
  }

  const rootDir = dirname(pkg.path);
  const normalizedSrcDir = normalizeToPosix(srcDir);

  const config = Object.keys(exportsValue).reduce((acc: Record<string, string>, key) => {
    const name = basename(key) === '.' ? 'index' : relative('.', key);
    const normalizedName = normalizeToPosix(name);
    acc[normalizedName] = findEntryPoint(normalizedName, rootDir, normalizedSrcDir);
    return acc;
  }, {});

  return config;
};

export const getPackageJson = (cwd: string) => {
  const pkg = readPackageUpSync({ cwd });
  if (!pkg || !pkg.packageJson) {
    throw new Error(`Failed to load the package.json`);
  }
  return pkg;
};

export const getOutDirs = (pkg: NormalizedReadResult) => {
  const requiredFields = ['main', 'module'] as const;
  requiredFields.forEach((field) => {
    if (!pkg.packageJson[field]) {
      throw new Error(getFieldMissingErrorMessage(field, pkg.path));
    }
  });

  const esm = dirname(pkg.packageJson.module as string);
  const cjs = dirname(pkg.packageJson.main as string);

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
      this.warn(`No replacements made for bundleRegExp in ${injectPrams.packageName}. Using bundled contents as-is.`);
      // Don't throw error, just use the bundled contents as-is
    }

    // Replace instances of the dynamic import in the template with the bundled contents
    const searchPattern = `const ${injectPrams.importName} = await import('${injectPrams.packageName}');`;
    const renderedContent = templateContent.replace(searchPattern, injectedContents);

    if (renderedContent === templateContent) {
      console.log(`[DEBUG] Failed to find pattern: "${searchPattern}"`);
      console.log(`[DEBUG] Template content around line 44:`, templateContent.split('\n').slice(40, 50).join('\n'));
      throw new Error(`Failed to inject contents of "${injectPrams.packageName}"`);
    }

    console.log(`[DEBUG] Successfully replaced pattern in ${injectPrams.targetFile}`);
    console.log(`[DEBUG] Injected content preview:`, `${injectedContents.substring(0, 200)}...`);

    // Check for import/export statements in the injected content
    const hasImport = injectedContents.includes('import ');
    const hasExport = injectedContents.includes('export ');
    console.log(`[DEBUG] Contains import statements: ${hasImport}`);
    console.log(`[DEBUG] Contains export statements: ${hasExport}`);

    if (hasExport && injectPrams.packageName === '@vitest/spy') {
      // Show the export statements for debugging
      const lines = injectedContents.split('\n');
      const exportLines = lines.filter((line) => line.includes('export')).slice(0, 5);
      console.log(`[DEBUG] Export statements found:`, exportLines);
    }

    this.info(`Successfully bundled and injected "${injectPrams.packageName}" into ${injectPrams.targetFile}`);
    return renderedContent;
  } catch (error) {
    this.error(`Dependency injection failed: ${(error as Error).message}`);
  }
}
