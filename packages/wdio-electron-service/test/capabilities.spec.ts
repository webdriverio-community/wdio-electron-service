/* eslint-disable @typescript-eslint/ban-ts-comment */
import { describe, it, expect } from 'vitest';
import { getChromeOptions, getChromedriverOptions, getElectronCapabilities } from '../src/capabilities.js';

describe('getChromeOptions', () => {
  it('should return the combination value of the input parameters', () => {
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

  it('should return default values when no input parameters are set', () => {
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
  it('should return the set value of wdio:chromedriverOptions', () => {
    const expectedOption = {
      binary: '/path/to/chromdriver',
    };
    expect(
      getChromedriverOptions({
        'wdio:chromedriverOptions': expectedOption,
      }),
    ).toStrictEqual(expectedOption);
  });

  it('should return the empty object when wdio:chromedriverOptions is not set', () => {
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
  describe.each([
    [
      'Standard capabilities',
      (browserName: string) => ({
        browserName,
      }),
      [expectedCap],
    ],
    [
      'W3C specific capabilities',
      (browserName: string) => ({
        alwaysMatch: {
          browserName,
        },
      }),
      [expectedCap],
    ],
    [
      'Multiremote capabilities',
      (browserName: string) => ({
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
          },
        },
      }),
      [expectedCap, expectedCap],
    ],
  ])('%s', (_title, generateCap, expectedCaps) => {
    it('should return capabilities when input electron capabilities', () => {
      const cap = generateCap('electron');
      //@ts-expect-error
      const caps = getElectronCapabilities(cap);
      expect(caps).toStrictEqual(expectedCaps);
    });

    it('should not return capabilities when not input electron capabilities', () => {
      const cap = generateCap('chrome');
      //@ts-expect-error
      const caps = getElectronCapabilities(cap);
      expect(caps).toStrictEqual([]);
    });
  });
});
