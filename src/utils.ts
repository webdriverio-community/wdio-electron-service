import logger, { Logger } from '@wdio/logger';
import debug from 'debug';
import { Capabilities } from '@wdio/types';

import type { ElectronServiceOptions } from './types';
import { DesiredCapabilities } from '@wdio/types/build/Capabilities';

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

function getChromeOptions(options: ElectronServiceOptions, cap: Capabilities.Capabilities) {
  const existingOptions = cap['goog:chromeOptions'] || {};
  return {
    binary: options.binaryPath || getBinaryPath(options.appPath as string, options.appName as string),
    args: options.appArgs,
    windowTypes: ['app', 'webview'],
    ...existingOptions,
  };
}

function getChromedriverOptions(options: ElectronServiceOptions, cap: Capabilities.Capabilities) {
  const existingOptions = cap['wdio:chromedriverOptions'] || {};
  return {
    binary: options.chromedriverCustomPath,
    ...existingOptions,
  };
}

export const mapCapabilities = (capabilities: Capabilities.RemoteCapabilities, options: ElectronServiceOptions) => {
  const isMultiremote = (cap: unknown) =>
    cap &&
    typeof cap === 'object' &&
    !Array.isArray(cap) &&
    Object.keys(cap).length > 0 &&
    Object.values(cap).every((cap) => typeof cap === 'object');
  const isElectron = (cap: unknown) => (cap as DesiredCapabilities)?.browserName?.toLowerCase() === 'electron';
  // const chromeOptions = {
  //     binary: options.binaryPath || getBinaryPath(options.appPath as string, options.appName as string),
  //     args: options.appArgs,
  //     windowTypes: ['app', 'webview'],
  //   };
  // const chromedriverOptions = {
  //     binary: options.chromedriverCustomPath
  //   }

  log.debug('mapping capabilities', options);

  if (Array.isArray(capabilities)) {
    capabilities.forEach((cap) => {
      if (isMultiremote(cap)) {
        // parallel multiremote
        Object.values(capabilities).forEach((cap: { capabilities: Capabilities.Capabilities }) => {
          if (isElectron(cap.capabilities)) {
            cap.capabilities.browserName = 'chrome';
            cap.capabilities['goog:chromeOptions'] = getChromeOptions(options, cap.capabilities);
            cap.capabilities['wdio:chromedriverOptions'] = getChromedriverOptions(options, cap.capabilities);
          }
        });
      } else if (isElectron(cap)) {
        // regular capabilities
        (cap as DesiredCapabilities).browserName = 'chrome';
        (cap as DesiredCapabilities)['goog:chromeOptions'] = getChromeOptions(options, cap as DesiredCapabilities);
        (cap as DesiredCapabilities)['wdio:chromedriverOptions'] = getChromedriverOptions(
          options,
          cap as DesiredCapabilities,
        );
      }
    });
  } else if (isMultiremote(capabilities)) {
    // multiremote (non-parallel)
    Object.values(capabilities).forEach((cap) => {
      if (isElectron(cap.capabilities)) {
        (cap.capabilities as DesiredCapabilities).browserName = 'chrome';
        (cap.capabilities as DesiredCapabilities)['goog:chromeOptions'] = getChromeOptions(
          options,
          cap.capabilities as DesiredCapabilities,
        );
        (cap.capabilities as DesiredCapabilities)['wdio:chromedriverOptions'] = getChromedriverOptions(
          options,
          cap.capabilities as DesiredCapabilities,
        );
      }
    });
  }

  log.debug('capabilities mapped', capabilities);

  return capabilities;
};
