import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { allOfficialArchsForPlatformAndVersion } from '@electron/packager';
import findVersions from 'find-versions';
import type { NormalizedReadResult } from 'read-package-up';

import log from './log.js';
import { APP_NAME_DETECTION_ERROR, BUILD_TOOL_DETECTION_ERROR } from './constants.js';
import type {
  AppBuildInfo,
  BuilderArch,
  BuilderConfig,
  ForgeConfig,
  ForgeArch,
  ForgeBuildInfo,
  BuilderBuildInfo,
} from '@wdio/electron-types';

const SupportedPlatform = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'win32',
};

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

async function getConfig(fileCandidate: string[], projectDir: string) {
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

const getBuilderConfigCandidates = (configFileName = 'electron-builder') => {
  const exts = ['.yml', '.yaml', '.json', '.json5', '.toml', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
  return exts.reduce(
    (acc: string[], ext: string) => acc.concat([`${configFileName}${ext}`, `${configFileName}.config${ext}`]),
    [],
  );
};

/**
 * Determine the path to the Electron application binary
 * @param packageJsonPath path to the nearest package.json
 * @param appBuildInfo build information about the Electron application
 * @param electronVersion version of Electron to use
 * @param p   process object (used for testing purposes)
 * @returns   path to the Electron app binary
 */
export async function getBinaryPath(
  packageJsonPath: string,
  appBuildInfo: AppBuildInfo,
  electronVersion?: string,
  p = process,
) {
  if (!Object.values(SupportedPlatform).includes(p.platform)) {
    throw new Error(`Unsupported platform: ${p.platform}`);
  }

  let outDirs: string[];

  if (appBuildInfo.isForge) {
    // Forge case
    const archs = allOfficialArchsForPlatformAndVersion(
      p.platform as keyof typeof SupportedPlatform,
      electronVersion,
    ) as ForgeArch[];

    const forgeOutDir = (appBuildInfo.config as ForgeConfig)?.outDir || 'out';
    outDirs = archs.map((arch) =>
      path.join(path.dirname(packageJsonPath), forgeOutDir, `${appBuildInfo.appName}-${p.platform}-${arch}`),
    );
  } else {
    // electron-builder case
    const builderOutDirName = (appBuildInfo.config as BuilderConfig)?.directories?.output || 'dist';
    const builderOutDirMap = (arch: BuilderArch) => ({
      darwin: path.join(builderOutDirName, arch === 'x64' ? 'mac' : `mac-${arch}`),
      linux: path.join(builderOutDirName, 'linux-unpacked'),
      win32: path.join(builderOutDirName, 'win-unpacked'),
    });

    if (p.platform === 'darwin') {
      // macOS output dir depends on the arch used
      // - we check all of the possible dirs
      const archs: BuilderArch[] = ['arm64', 'armv7l', 'ia32', 'universal', 'x64'];
      outDirs = archs.map((arch) =>
        path.join(path.dirname(packageJsonPath), builderOutDirMap(arch)[p.platform as keyof typeof SupportedPlatform]),
      );
    } else {
      // other platforms have a single output dir which is not dependent on the arch
      outDirs = [
        path.join(path.dirname(packageJsonPath), builderOutDirMap('x64')[p.platform as keyof typeof SupportedPlatform]),
      ];
    }
  }

  const executableName =
    (appBuildInfo.isForge && appBuildInfo.config.packagerConfig?.executableName) || appBuildInfo.appName;
  const binaryPathMap = {
    darwin: () => path.join(`${appBuildInfo.appName}.app`, 'Contents', 'MacOS', executableName),
    linux: () => executableName,
    win32: () => `${executableName}.exe`,
  };
  const electronBinaryPath = binaryPathMap[p.platform as keyof typeof SupportedPlatform]();

  const binaryPaths = outDirs.map((outDir) => path.join(outDir, electronBinaryPath));

  // for each path, check if it exists and is executable
  const binaryPathsAccessResults = await Promise.all(
    binaryPaths.map(async (binaryPath) => {
      try {
        log.debug(`Checking binary path: ${binaryPath}...`);
        await fs.access(binaryPath, fs.constants.X_OK);
        log.debug(`'${binaryPath}' is executable.`);
        return true;
      } catch (e) {
        log.debug(`'${binaryPath}' is not executable.`, (e as Error).message);
        return false;
      }
    }),
  );

  // get the list of executable paths
  const executableBinaryPaths = binaryPaths.filter((_binaryPath, index) => binaryPathsAccessResults[index]);

  // no executable binary case
  if (executableBinaryPaths.length === 0) {
    throw new Error(`No executable binary found, checked: \n${binaryPaths.join(', \n')}`);
  }

  // multiple executable binaries case
  if (executableBinaryPaths.length > 1) {
    log.info(`Detected multiple app binaries, using the first one: \n${executableBinaryPaths.join(', \n')}`);
  }

  return executableBinaryPaths[0];
}

const forgeBuildInfo = (forgeConfig: ForgeConfig, pkg: NormalizedReadResult): ForgeBuildInfo => {
  log.info(`Forge configuration detected: \n${JSON.stringify(forgeConfig)}`);
  const appName: string = pkg.packageJson.productName || forgeConfig?.packagerConfig?.name || pkg.packageJson.name;

  if (!appName) {
    throw new Error(APP_NAME_DETECTION_ERROR);
  }

  return {
    appName,
    config: forgeConfig,
    isForge: true,
    isBuilder: false,
  };
};

const builderBuildInfo = (builderConfig: BuilderConfig, pkg: NormalizedReadResult): BuilderBuildInfo => {
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
};

/**
 * Determine build information about the Electron application
 * @param pkg normalized package.json
 * @returns   promise resolving to the app build information
 */
export async function getAppBuildInfo(pkg: NormalizedReadResult): Promise<AppBuildInfo> {
  const forgeDependencyDetected = Object.keys(pkg.packageJson.devDependencies || {}).includes('@electron-forge/cli');
  const builderDependencyDetected = Object.keys(pkg.packageJson.devDependencies || {}).includes('electron-builder');
  const forgePackageJsonConfig = pkg.packageJson.config?.forge;
  const forgeCustomConfigFile = typeof forgePackageJsonConfig === 'string';
  const forgeConfigFile = forgeCustomConfigFile ? forgePackageJsonConfig : 'forge.config.js';
  const rootDir = path.dirname(pkg.path);
  let forgeConfig = forgePackageJsonConfig as ForgeConfig;
  let builderConfig: BuilderConfig = pkg.packageJson.build;

  if (forgeDependencyDetected && (!forgePackageJsonConfig || forgeCustomConfigFile)) {
    // if no forge config or a linked file is found in the package.json, attempt to read Forge JS-based config
    let forgeConfigPath;

    try {
      forgeConfigPath = path.join(rootDir, forgeConfigFile);
      log.info(`Reading Forge config file: ${forgeConfigPath}...`);
      forgeConfig = ((await import(pathToFileURL(forgeConfigPath).toString())) as { default: ForgeConfig }).default;
    } catch (_e) {
      log.warn('Forge config file not found or invalid.');

      // only throw if there is no builder config
      if (!builderConfig) {
        throw new Error(`Forge was detected but no configuration was found at '${forgeConfigPath}'.`);
      }
    }
  }

  if (builderDependencyDetected && !builderConfig) {
    // if builder config is not found in the package.json, attempt to read `electron-builder.{yaml, yml, json, json5, toml}`
    // see also https://www.electron.build/configuration.html
    try {
      log.info('Locating builder config file...');
      const config = await getConfig(getBuilderConfigCandidates(), rootDir);

      if (!config) {
        throw new Error();
      }

      log.info(`Detected config file: ${config.configFile}`);
      builderConfig = config.result as BuilderConfig;
    } catch (_e) {
      log.warn('Builder config file not found or invalid.');

      // only throw if there is no forge config
      if (!forgeConfig) {
        throw new Error(
          'Electron-builder was detected but no configuration was found, make sure your config file is named correctly, e.g. `electron-builder.config.json`.',
        );
      }
    }
  }

  const isForge = Boolean(forgeConfig);
  const isBuilder = Boolean(builderConfig);

  if (isForge && isBuilder) {
    log.warn(
      'Detected both Forge and Builder configurations, the Forge configuration will be used to determine build information',
    );
    log.warn('You can override this by specifying the `appBinaryPath` option in your capabilities.');
  }

  if (isForge) {
    log.info('Using Forge configuration to get app build information...');
    return forgeBuildInfo(forgeConfig, pkg);
  }

  if (isBuilder) {
    log.info('Using Builder configuration to get app build information...');
    return builderBuildInfo(builderConfig, pkg);
  }

  throw new Error(BUILD_TOOL_DETECTION_ERROR);
}

type PnpmWorkspace = { catalog?: { [key: string]: string }; catalogs?: { [key: string]: { [key: string]: string } } };

export async function findPnpmCatalogVersions(
  pkgElectronVersion?: string,
  pkgElectronNightlyVersion?: string,
  projectDir?: string,
) {
  if (!projectDir) {
    return undefined;
  }

  // Determine catalog names
  const electronCatalogName = pkgElectronVersion?.split('catalog:')[1]?.trim();
  const electronNightlyCatalogName = pkgElectronNightlyVersion?.split('catalog:')[1]?.trim();

  try {
    // Traverse up the directory tree to find pnpm-workspace.yaml
    let currentDir = projectDir;
    let workspaceYamlPath;
    let yamlContent;

    while (currentDir !== path.parse(currentDir).root) {
      workspaceYamlPath = path.join(currentDir, 'pnpm-workspace.yaml');
      try {
        yamlContent = await fs.readFile(workspaceYamlPath, 'utf8');
        log.debug(`Found pnpm-workspace.yaml at ${workspaceYamlPath}`);
        break;
      } catch (_e) {
        // Move up one directory
        currentDir = path.dirname(currentDir);
      }
    }

    if (!yamlContent) {
      return undefined;
    }

    const pnpmWorkspace = (await import('yaml')).parse(yamlContent) as PnpmWorkspace;

    // Check for electron with named catalog
    if (electronCatalogName && pnpmWorkspace.catalogs?.[electronCatalogName]) {
      return pnpmWorkspace.catalogs[electronCatalogName];
    }

    // Check for electron with default catalog
    if (pkgElectronVersion === 'catalog:' && pnpmWorkspace.catalog?.electron) {
      return pnpmWorkspace.catalog.electron;
    }

    // Check for electron-nightly with named catalog
    if (electronNightlyCatalogName && pnpmWorkspace.catalogs?.[electronNightlyCatalogName]) {
      return pnpmWorkspace.catalogs[electronNightlyCatalogName]['electron-nightly'];
    }

    // Check for electron-nightly with default catalog
    if (pkgElectronNightlyVersion === 'catalog:' && pnpmWorkspace.catalog?.['electron-nightly']) {
      return pnpmWorkspace.catalog['electron-nightly'];
    }

    return undefined;
  } catch (error) {
    // Gracefully handle other errors
    log.debug(`Error finding pnpm workspace: ${(error as Error).message}`);
    return undefined;
  }
}

export async function getElectronVersion(pkg: NormalizedReadResult) {
  const { dependencies, devDependencies } = pkg.packageJson;
  const pkgElectronVersion = dependencies?.electron || devDependencies?.electron;
  const pkgElectronNightlyVersion = dependencies?.['electron-nightly'] || devDependencies?.['electron-nightly'];

  if (pkgElectronVersion?.startsWith('catalog') || pkgElectronNightlyVersion?.startsWith('catalog')) {
    // Extract the directory path from the package.json file path
    const projectDir = path.dirname(pkg.path);
    return await findPnpmCatalogVersions(pkgElectronVersion, pkgElectronNightlyVersion, projectDir);
  }

  const electronVersion = pkgElectronVersion || pkgElectronNightlyVersion;

  return electronVersion ? findVersions(electronVersion, { loose: true })[0] : undefined;
}
