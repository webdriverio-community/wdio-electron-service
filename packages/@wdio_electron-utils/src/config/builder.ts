import path from 'node:path';
import type { BuilderBuildInfo, BuilderConfig } from '@wdio/electron-types';
import type { NormalizedReadResult } from 'read-package-up';
import { APP_NAME_DETECTION_ERROR } from '../constants.js';
import { createLogger } from '../log.js';
import { readConfig } from './read.js';

const log = createLogger('config');

export async function getConfig(pkg: NormalizedReadResult): Promise<BuilderBuildInfo | undefined> {
  const rootDir = path.dirname(pkg.path);
  let builderConfig: BuilderConfig = pkg.packageJson.build;
  if (!builderConfig) {
    // if builder config is not found in the package.json, attempt to read `electron-builder.{yaml, yml, json, json5, toml}`
    // see also https://www.electron.build/configuration.html
    try {
      log.debug('Locating builder config file...');
      const config = await readBuilderConfig(getBuilderConfigCandidates(), rootDir);

      if (!config) {
        throw new Error();
      }

      log.debug(`Detected builder config file: ${config.configFile}`);
      builderConfig = config.result as BuilderConfig;
    } catch (_e) {
      log.debug('Builder config file not found or invalid.');
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

function builderBuildInfo(builderConfig: BuilderConfig, pkg: NormalizedReadResult): BuilderBuildInfo {
  log.debug(`Builder configuration detected: \n${JSON.stringify(builderConfig)}`);
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
