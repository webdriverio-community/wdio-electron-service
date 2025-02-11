import { describe, it, expect } from 'vitest';
import { getChromeOptions, getChromedriverOptions, getElectronCapabilities } from '../src/capabilities.js';

import type { Capabilities } from '@wdio/types';

type RequestedCapabilities =
  | Capabilities.RequestedStandaloneCapabilities
  | Capabilities.W3CCapabilities
  | Capabilities.RequestedMultiremoteCapabilities;

describe('getChromeOptions', () => {
  it('should combine app arguments with chrome options and override the binary path', () => {
    const options = {
      appArgs: ['foo=bar'],
      appBinaryPath: '/path/to/apps',
    };
    const cap = {
      'wdio:chromedriverOptions': {
        binary: '/path/to/chromdriver',
      },
      'goog:chromeOptions': {
        windowTypes: ['app'],
        args: ['--no-sandbox'],
      },
    };
    expect(getChromeOptions(options, cap)).toStrictEqual({
      args: ['--no-sandbox', 'foo=bar'],
      binary: '/path/to/apps',
      windowTypes: ['app'],
    });
  });

  it('should return default values when app arguments are not provided', () => {
    const options = {
      appBinaryPath: '/path/to/apps',
    };
    const cap = {
      'wdio:chromedriverOptions': {
        binary: '/path/to/chromdriver',
      },
    };
    expect(getChromeOptions(options, cap)).toStrictEqual({
      args: [],
      binary: '/path/to/apps',
      windowTypes: ['app', 'webview'],
    });
  });
});

describe('getChromedriverOptions', () => {
  it('should return the configured wdio:chromedriverOptions', () => {
    const expectedOption = {
      binary: '/path/to/chromdriver',
    };
    expect(
      getChromedriverOptions({
        'wdio:chromedriverOptions': expectedOption,
      }),
    ).toStrictEqual(expectedOption);
  });

  it('should return an empty object when wdio:chromedriverOptions is absent', () => {
    expect(
      getChromedriverOptions({
        'goog:chromeOptions': {
          args: ['--no-sandbox'],
        },
      }),
    ).toStrictEqual({});
  });
});

describe('getElectronCapabilities', () => {
  const expectedCap = {
    browserName: 'electron',
  };
  describe.each<[string, (browserName: string) => RequestedCapabilities, Array<typeof expectedCap>]>([
    [
      'Standard capabilities',
      (browserName: string): Capabilities.RequestedStandaloneCapabilities => ({
        browserName,
      }),
      [expectedCap],
    ],
    [
      'W3C specific capabilities',
      (browserName: string): Capabilities.W3CCapabilities => ({
        alwaysMatch: { browserName },
        firstMatch: [{}],
      }),
      [expectedCap],
    ],
    [
      'Multiremote capabilities',
      (browserName: string): Capabilities.RequestedMultiremoteCapabilities => ({
        instanceA: {
          capabilities: {
            browserName,
          },
        },
        instanceB: {
          capabilities: {
            alwaysMatch: {
              browserName,
            },
            firstMatch: [{}],
          },
        },
      }),
      [expectedCap, expectedCap],
    ],
  ])('%s', (_title, generateCap, expectedCaps) => {
    it('should return electron capabilities when browserName is "electron"', () => {
      const cap = generateCap('electron');
      const caps = getElectronCapabilities(cap);
      expect(caps).toStrictEqual(expectedCaps);
    });

    it('should return an empty array when browserName is not "electron"', () => {
      const cap = generateCap('chrome');
      const caps = getElectronCapabilities(cap);
      expect(caps).toStrictEqual([]);
    });
  });
});
