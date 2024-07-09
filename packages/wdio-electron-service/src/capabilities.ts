import type { Capabilities } from '@wdio/types';

import type { ElectronServiceOptions } from '@repo/types';

export function getChromeOptions(options: ElectronServiceOptions, cap: WebdriverIO.Capabilities) {
  const existingOptions = cap['goog:chromeOptions'] || {};
  return {
    binary: options.appBinaryPath,
    windowTypes: ['app', 'webview'],
    ...existingOptions,
    args: [...(existingOptions.args || []), ...(options.appArgs || [])],
  };
}

export function getChromedriverOptions(cap: WebdriverIO.Capabilities) {
  const existingOptions = cap['wdio:chromedriverOptions'] || {};
  return existingOptions;
}

const isElectron = (cap: unknown) => (cap as WebdriverIO.Capabilities)?.browserName?.toLowerCase() === 'electron';

/**
 * Get capability independent of which type of capabilities is set
 */
export function getElectronCapabilities(caps: Capabilities.RequestedStandaloneCapabilities) {
  /**
   * Standard capabilities, e.g.:
   * ```
   * {
   *   browserName: 'chrome'
   * }
   * ```
   */
  const standardCaps = caps as WebdriverIO.Capabilities;
  if (typeof standardCaps.browserName === 'string' && isElectron(standardCaps)) {
    return [caps];
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
   * Multiremote capabilities, e.g.:
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
  return Object.values(caps as Capabilities.WithRequestedMultiremoteCapabilities['capabilities'])
    .map(
      (options) =>
        (options.capabilities as Capabilities.W3CCapabilities)?.alwaysMatch ||
        (options.capabilities as WebdriverIO.Capabilities),
    )
    .filter((caps) => isElectron(caps));
}
