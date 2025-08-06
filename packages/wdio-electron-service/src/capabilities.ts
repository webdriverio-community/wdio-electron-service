import type { ElectronServiceOptions } from '@wdio/electron-types';
import type { Capabilities } from '@wdio/types';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';

export function getChromeOptions(options: ElectronServiceOptions, cap: WebdriverIO.Capabilities) {
  const existingOptions = cap['goog:chromeOptions'] || {};
  const combinedArgs = [...(existingOptions.args || []), ...(options.appArgs || [])];
  return {
    binary: options.appBinaryPath,
    windowTypes: ['app', 'webview'],
    ...existingOptions,
    args: [...new Set(combinedArgs)],
  };
}

export function getChromedriverOptions(cap: WebdriverIO.Capabilities) {
  const existingOptions = cap['wdio:chromedriverOptions'] || {};
  return existingOptions;
}

const isElectron = (cap: unknown) => (cap as WebdriverIO.Capabilities)?.browserName?.toLowerCase() === 'electron';

const isConvertedElectron = (cap: unknown) => {
  return CUSTOM_CAPABILITY_NAME in ((cap || {}) as WebdriverIO.Capabilities);
};

export function getElectronCapabilities(caps: Capabilities.RequestedStandaloneCapabilities) {
  return getCapabilities(caps, isElectron);
}

export function getConvertedElectronCapabilities(caps: Capabilities.RequestedStandaloneCapabilities) {
  return getCapabilities(caps, isConvertedElectron);
}

/**
 * Get capability independent of which type of capabilities is set
 */
function getCapabilities(caps: Capabilities.RequestedStandaloneCapabilities, filter: (cap: unknown) => boolean) {
  /**
   * Standard capabilities, e.g.:
   * ```
   * {
   *   browserName: 'chrome'
   * }
   * ```
   */
  const standardCaps = caps as WebdriverIO.Capabilities;
  if (typeof standardCaps.browserName === 'string' && filter(standardCaps)) {
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
  if (w3cCaps && typeof w3cCaps.browserName === 'string' && filter(w3cCaps)) {
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
    .filter((caps) => filter(caps));
}
