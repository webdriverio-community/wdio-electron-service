import type { Capabilities } from '@wdio/types';

import type { ElectronServiceOptions } from './types';

export function getChromeOptions(options: ElectronServiceOptions, cap: Capabilities.Capabilities) {
  const existingOptions = cap['goog:chromeOptions'] || {};
  return {
    binary: options.appBinaryPath,
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
        (options.capabilities as Capabilities.W3CCapabilities)?.alwaysMatch ||
        (options.capabilities as Capabilities.Capabilities),
    )
    .filter((caps) => isElectron(caps));
}
