import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import log from '../log.js';
import { APP_NAME_DETECTION_ERROR } from '../constants.js';

import type { NormalizedReadResult } from 'read-package-up';
import type { BuilderConfig, BuilderBuildInfo } from '@wdio/electron-types';

export async function getConfig(pkg: NormalizedReadResult): Promise<BuilderBuildInfo | undefined> {
  const rootDir = path.dirname(pkg.path);
  let builderConfig: BuilderConfig = pkg.packageJson.build;
  if (!builderConfig) {
    // if builder config is not found in the package.json, attempt to read `electron-builder.{yaml, yml, json, json5, toml}`
    // see also https://www.electron.build/configuration.html
    try {
      log.info('Locating builder config file...');
      const config = await readBuilderConfig(getBuilderConfigCandidates(), rootDir);

      if (!config) {
        throw new Error();
      }

      log.info(`Detected config file: ${config.configFile}`);
      builderConfig = config.result as BuilderConfig;
    } catch (_e) {
      log.warn('Builder config file not found or invalid.');
      return undefined;
    }
  }
  return builderBuildInfo(builderConfig, pkg);
}

async function readBuilderConfig(fileCandidate: string[], projectDir: string) {
  for (const configFile of fileCandidate) {
    try {
      log.debug(`Attempting to read config file: ${configFile}...`);
      return await readConfig(configFile, projectDir);
    } catch (_e) {
      log.debug('unsuccessful');
    }
  }
  return undefined;
}
function getBuilderConfigCandidates(configFileName = 'electron-builder') {
  const exts = ['.yml', '.yaml', '.json', '.json5', '.toml', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
  return exts.reduce(
    (acc: string[], ext: string) => acc.concat([`${configFileName}${ext}`, `${configFileName}.config${ext}`]),
    [],
  );
}

async function readConfig(configFile: string, projectDir: string) {
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
    const { tsImport } = await import('tsx/esm/api');
    const configFilePathUrl = pathToFileURL(configFilePath).toString();
    const readResult = (await tsImport(configFilePathUrl, __filename)).default;

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

function builderBuildInfo(builderConfig: BuilderConfig, pkg: NormalizedReadResult): BuilderBuildInfo {
  log.info(`Builder configuration detected: \n${JSON.stringify(builderConfig)}`);
  const appName: string = pkg.packageJson.productName || builderConfig?.productName || pkg.packageJson.name;

  if (!appName) {
    throw new Error(APP_NAME_DETECTION_ERROR);
  }

  return {
    appName,
    config: builderConfig,
    isForge: false,
    isBuilder: true,
  };
}
