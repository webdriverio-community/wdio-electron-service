import type { Capabilities } from '@wdio/types';
import { describe, expect, it } from 'vitest';
import {
  getChromedriverOptions,
  getChromeOptions,
  getConvertedElectronCapabilities,
  getElectronCapabilities,
} from '../src/capabilities.js';

type RequestedCapabilities =
  | Capabilities.RequestedStandaloneCapabilities
  | Capabilities.W3CCapabilities
  | Capabilities.RequestedMultiremoteCapabilities;

describe('Capabilities Utilities', () => {
  describe('getChromeOptions()', () => {
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

    it('should deduplicate arguments when the same flag exists in both existing and app args', () => {
      const options = {
        appArgs: ['--no-sandbox', 'foo=bar'],
        appBinaryPath: '/path/to/apps',
      };
      const cap = {
        'goog:chromeOptions': {
          windowTypes: ['app'],
          args: ['--no-sandbox', '--disable-web-security'],
        },
      };
      expect(getChromeOptions(options, cap)).toStrictEqual({
        args: ['--no-sandbox', '--disable-web-security', 'foo=bar'],
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

  describe('getChromedriverOptions()', () => {
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

  describe('getElectronCapabilities()', () => {
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
});

function removeProperty(obj: unknown, keyToRemove: string): unknown {
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([key]) => key !== keyToRemove)
        .map(([key, value]) => [key, removeProperty(value, keyToRemove)]),
    );
  }
  return obj;
}

describe('getConvertedElectronCapabilities', () => {
  const expectedCap = {
    browserName: 'chrome',
    'wdio:chromedriverOptions': {
      binary: '/path/to/chromdriver',
    },
    'wdio:electronServiceOptions': {},
  };
  describe.each<[string, RequestedCapabilities, Array<typeof expectedCap>]>([
    ['Standard capabilities', expectedCap as Capabilities.RequestedStandaloneCapabilities, [expectedCap]],
    [
      'W3C specific capabilities',
      {
        alwaysMatch: expectedCap,
      } as Capabilities.W3CCapabilities,
      [expectedCap],
    ],
    [
      'Multiremote capabilities',
      {
        instanceA: {
          capabilities: expectedCap,
        },
        instanceB: {
          capabilities: {
            alwaysMatch: expectedCap,
          },
        },
      } as Capabilities.RequestedMultiremoteCapabilities,
      [expectedCap, expectedCap],
    ],
  ])('%s', (_title, inputCap, expectedCaps) => {
    it('should return capabilities when input electron capabilities', () => {
      const caps = getConvertedElectronCapabilities(inputCap);
      expect(caps).toStrictEqual(expectedCaps);
    });

    it('should not return capabilities when not input electron capabilities', () => {
      removeProperty(inputCap, 'wdio:electronServiceOptions');
      const caps = getElectronCapabilities(inputCap);
      expect(caps).toStrictEqual([]);
    });
  });
});
