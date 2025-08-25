// biome-ignore-all lint/suspicious/noTsIgnore: Allowing ts-ignore for runtime imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function readConfig(configFile: string, projectDir: string) {
  const configFilePath = path.join(projectDir, configFile);
  await fs.access(configFilePath, fs.constants.R_OK);

  const ext = path.parse(configFile).ext;
  const extRegex = {
    js: /\.(c|m)?(j|t)s$/,
    json: /\.json(5)?$/,
    toml: /\.toml$/,
    yaml: /\.y(a)?ml$/,
  };

  let result: unknown;

  if (extRegex.js.test(ext)) {
    const configFilePathUrl = pathToFileURL(configFilePath).toString();
    let imported: Record<string, unknown> | undefined;

    // Handle TypeScript files with improved logic
    if (ext.includes('ts')) {
      imported = await handleTypeScriptFile(configFilePath, configFilePathUrl, ext);
    }

    // Fallback to native dynamic import for JavaScript files or failed TypeScript imports
    if (!imported) {
      imported = (await import(configFilePathUrl)) as Record<string, unknown>;
    }

    // Handle different export patterns
    let readResult = imported.default;
    if (!readResult && typeof imported === 'object') {
      // For CJS files that use module.exports, the entire export might be the config
      // Check if this looks like a CommonJS export by seeing if there's no default
      // but there are other properties that could be the config
      const keys = Object.keys(imported);
      if (keys.length > 0 && !keys.includes('default')) {
        readResult = imported;
      }
    }

    if (typeof readResult === 'function') {
      result = readResult();
    } else {
      result = readResult;
    }
    result = await Promise.resolve(result);
  } else {
    const data = await fs.readFile(configFilePath, 'utf8');
    if (extRegex.json.test(ext)) {
      const json5 = await import('json5');
      // JSON5 exports parse as default in ESM, but as a named export in CJS
      // https://github.com/json5/json5/issues/240
      const parseJson = json5.parse || json5.default.parse;
      result = parseJson(data);
    } else if (extRegex.toml.test(ext)) {
      result = (await import('smol-toml')).parse(data);
    } else if (extRegex.yaml.test(ext)) {
      result = (await import('yaml')).parse(data);
    }
  }
  return { result, configFile };
}

/**
 * Handle TypeScript file imports with appropriate strategies based on file type
 */
async function handleTypeScriptFile(
  configFilePath: string,
  configFilePathUrl: string,
  ext: string,
): Promise<Record<string, unknown> | undefined> {
  // For .ts and .mts files, try tsx first
  if (ext === '.ts' || ext === '.mts') {
    try {
      // @ts-ignore - tsx/esm/api is a runtime import
      const tsxApi = (await import('tsx/esm/api')) as unknown as {
        tsImport: (url: string, parentURL: string) => Promise<Record<string, unknown>>;
      };
      return await tsxApi.tsImport(configFilePathUrl, import.meta.url);
    } catch (_error) {
      // If tsx fails, return undefined to trigger fallback to native import
      return undefined;
    }
  }

  // For .cts files, try to strip types and convert to JS
  if (ext === '.cts') {
    try {
      return await handleCTSFile(configFilePath);
    } catch (_error) {
      // If CTS handling fails, return undefined to trigger fallback
      return undefined;
    }
  }

  return undefined;
}

/**
 * Handle CommonJS TypeScript (.cts) files by stripping types with esbuild
 */
async function handleCTSFile(configFilePath: string): Promise<Record<string, unknown>> {
  // @ts-ignore - esbuild is a runtime import
  const esbuild = await import('esbuild');
  const { readFileSync, writeFileSync, unlinkSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');

  const sourceCode = readFileSync(configFilePath, 'utf8');
  const tempJsFile = path.join(tmpdir(), `temp-${Date.now()}.js`);

  try {
    // Use esbuild to transpile CTS to JS
    const result = await esbuild.transform(sourceCode, {
      loader: 'ts',
      target: 'node18',
      format: 'cjs',
      sourcefile: configFilePath,
    });

    // Write the transpiled JS to a temp file
    writeFileSync(tempJsFile, result.code);

    // Import the temp JS file
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const imported = require(tempJsFile);

    return imported;
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempJsFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}
