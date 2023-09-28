import debug from 'debug';
import logger, { type Logger } from '@wdio/logger';
import type { Capabilities } from '@wdio/types';

import type { ElectronServiceOptions } from './types';

const d = debug('wdio-electron-service');
const l = logger('electron-service');

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
  const existingOptions = cap['goog:chromeOptions'] || {};
  return {
    binary: options.binaryPath || getBinaryPath(options.appPath as string, options.appName as string),
    windowTypes: ['app', 'webview'],
    ...existingOptions,
    args: [...(existingOptions.args || []), ...(options.appArgs || [])],
  };
}

export function getChromedriverOptions(cap: Capabilities.Capabilities) {
  const existingOptions = cap['wdio:chromedriverOptions'] || {};
  return existingOptions;
}

const isElectron = (cap: unknown) =>
  (cap as Capabilities.DesiredCapabilities)?.browserName?.toLowerCase() === 'electron';

/**
 * get capability independent of which type of capabilities is set
 */
export function getElectronCapabilities(caps: Capabilities.RemoteCapability) {
  /**
   * standard capabilities, e.g.:
   * ```
   * {
   *   browserName: 'chrome'
   * }
   * ```
   */
  const standardCaps = caps as Capabilities.Capabilities;
  if (typeof standardCaps.browserName === 'string' && isElectron(standardCaps)) {
    return [caps as Capabilities.Capabilities];
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
  const w3cCaps = (caps as Capabilities.W3CCapabilities).alwaysMatch;
  if (w3cCaps && typeof w3cCaps.browserName === 'string' && isElectron(w3cCaps)) {
    return [w3cCaps];
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
  return Object.values(caps as Capabilities.MultiRemoteCapabilities)
    .map(
      (options) =>
        (options.capabilities as Capabilities.W3CCapabilities).alwaysMatch ||
        (options.capabilities as Capabilities.Capabilities),
    )
    .filter((caps) => isElectron(caps));
}
