import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs/promises';

import debug from 'debug';
import extractZip from 'extract-zip';
import findVersions from 'find-versions';
import logger, { type Logger } from '@wdio/logger';
import { downloadArtifact as downloadElectronAssets } from '@electron/get';
import { fullVersions as chromiumVersions } from 'electron-to-chromium';
import type { Capabilities } from '@wdio/types';

import type { ElectronServiceOptions } from './types';

const d = debug('wdio-electron-service');
const l = logger('electron-service');

type PackageJson = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export const log: Logger = {
  ...l,
  debug: (...args) => {
    d(args);
    l.debug(...args);
  },
};

function getMacExecutableName(appName: string) {
  // https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/macPackager.ts#L390
  if (appName.endsWith(' Helper')) {
    return appName.replace(' Helper', '');
  }

  return appName;
}

function getBinaryPath(distPath: string, appName: string) {
  const SupportedPlatform = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
  };
  const { platform, arch } = process;

  if (!Object.values(SupportedPlatform).includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const pathMap = {
    darwin: `${arch === 'arm64' ? 'mac-arm64' : 'mac'}/${appName}.app/Contents/MacOS/${getMacExecutableName(appName)}`,
    linux: `linux-unpacked/${appName}`,
    win32: `win-unpacked/${appName}.exe`,
  };

  const electronPath = pathMap[platform as keyof typeof SupportedPlatform];

  return `${distPath}/${electronPath}`;
}

export function getChromeOptions(options: ElectronServiceOptions, cap: Capabilities.Capabilities) {
  const existingOptions = cap['goog:chromeOptions'] || {}
  return {
    binary: options.binaryPath || getBinaryPath(options.appPath as string, options.appName as string),
    windowTypes: ['app', 'webview'],
    ...existingOptions
  }
}

export function getChromedriverOptions(cap: Capabilities.Capabilities) {
  const existingOptions = cap['wdio:chromedriverOptions'] || {}
  return existingOptions
}

const isElectron = (cap: unknown) => (
  (cap as Capabilities.DesiredCapabilities)?.browserName?.toLowerCase() === 'electron'
)

export const parseVersion = (version?: string) => {
  if (!version) {
    return undefined;
  }
  return findVersions(version)[0];
}

export const getChromiumVersion = async (electronVersion?: string) => {
  // get https://raw.githubusercontent.com/Kilian/electron-to-chromium/master/full-versions.json

  // if fail use installed version
  return chromiumVersions[electronVersion as keyof typeof chromiumVersions];
}

export function downloadAssets(version: string) {
  const conf = {
    version,
    artifactName: 'chromedriver',
    force: process.env.force_no_cache === 'true',
    cacheRoot: process.env.electron_config_cache,
    platform: process.env.npm_config_platform,
    arch: process.env.npm_config_arch,
  };
  log.debug('chromedriver download config: ', conf);
  return downloadElectronAssets(conf);
}

export async function attemptAssetsDownload(version = '') {
  log.debug(`downloading Chromedriver for Electron v${version}...`);
  try {
    const targetFolder = path.join(__dirname, '..', 'bin');
    const zipPath = await downloadAssets(version);
    log.debug('assets downloaded to ', zipPath);
    await extractZip(zipPath, { dir: targetFolder });
    log.debug('assets extracted');
    const platform = process.env.npm_config_platform || process.platform;
    if (platform !== 'win32') {
      log.debug('setting file permissions...');
      await fs.chmod(path.join(targetFolder, 'chromedriver'), 0o755);
      log.debug('permissions set');
    }
  } catch (err) {
    // check if there is a semver minor version for fallback
    const parts = version.split('.');
    const baseVersion = `${parts[0]}.${parts[1]}.0`;

    if (baseVersion === version) {
      log.error(`error downloading Chromedriver for Electron v${version}`);
      log.error(err);
      throw err;
    }

    log.warn(`error downloading Chromedriver for Electron v${version}`);
    log.debug('falling back to minor version...');
    await attemptAssetsDownload(baseVersion);
  }
}

/**
 * get capability independant of which type of capabilities is set
 */
export function getElectronCapabilities (caps: Capabilities.RemoteCapability) {
  /**
   * standard capabilities, e.g.:
   * ```
   * {
   *   browserName: 'chrome'
   * }
   * ```
   */
  const standardCaps = caps as Capabilities.Capabilities
  if (typeof standardCaps.browserName === 'string' && isElectron(standardCaps)) {
    return [caps as Capabilities.Capabilities]
  }
  /**
   * W3C specific capabilities, e.g.:
   * ```
   * {
   *   alwaysMatch: {
   *     browserName: 'chrome'
   *   }
   * }
   * ```
   */
  const w3cCaps = (caps as Capabilities.W3CCapabilities).alwaysMatch
  if (typeof w3cCaps.browserName === 'string' && isElectron(w3cCaps)) {
    return [w3cCaps]
  }
  /**
   * multiremote capabilities, e.g.:
   * ```
   * {
   *   instanceA: {
   *     capabilities: {
   *        browserName: 'chrome'
   *     }
   *   },
   *   instanceB: {
   *     capabilities: {
   *        browserName: 'chrome'
   *     }
   *   }
   * }
   * ```
   */
  return Object.values(caps as Capabilities.MultiRemoteCapabilities).map((options) => (
    (options.capabilities as Capabilities.W3CCapabilities).alwaysMatch ||
    options.capabilities as Capabilities.Capabilities
  )).filter((caps) => isElectron(caps))
}