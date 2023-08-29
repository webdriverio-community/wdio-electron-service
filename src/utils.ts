import fs from 'fs';
import { join } from 'path';
import logger, { Logger } from '@wdio/logger';
import debug from 'debug';
import findVersions from 'find-versions';
import { getDirname } from 'cross-dirname';
import { fullVersions as chromiumVersions } from 'electron-to-chromium';
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

const isMultiremote = (cap: unknown) =>
  cap &&
  typeof cap === 'object' &&
  !Array.isArray(cap) &&
  Object.keys(cap).length > 0 &&
  Object.values(cap).every((cap) => typeof cap === 'object');
const isElectron = (cap: unknown) =>
  (cap as Capabilities.DesiredCapabilities)?.browserName?.toLowerCase() === 'electron';
const parseVersion = (version?: string) => {
  if (!version) {
    return undefined;
  }
  return findVersions(version)[0];
};

export const mapCapabilities = (
  capabilities: Capabilities.RemoteCapabilities,
  options: ElectronServiceOptions,
  chromiumVersion?: string,
) => {
  log.debug('mapping capabilities', options);

  if (Array.isArray(capabilities)) {
    capabilities.forEach((cap) => {
      if (isMultiremote(cap)) {
        // multiremote (parallel)
        Object.values(capabilities).forEach((cap: { capabilities: Capabilities.Capabilities }) => {
          if (isElectron(cap.capabilities)) {
            cap.capabilities.browserName = 'chrome';
            cap.capabilities.browserVersion = chromiumVersion || cap.capabilities.browserVersion;
            cap.capabilities['goog:chromeOptions'] = getChromeOptions(options, cap.capabilities);
            if (!chromiumVersion) {
              cap.capabilities['wdio:chromedriverOptions'] = getChromedriverOptions(options, cap.capabilities);
            }
          }
        });
      } else if (isElectron(cap)) {
        // regular capabilities
        const c = cap as Capabilities.DesiredCapabilities;
        c.browserName = 'chrome';
        c.browserVersion = chromiumVersion || c.browserVersion;
        c['goog:chromeOptions'] = getChromeOptions(options, c);
        if (!chromiumVersion) {
          c['wdio:chromedriverOptions'] = getChromedriverOptions(options, c);
        }
      }
    });
  } else if (isMultiremote(capabilities)) {
    // multiremote (non-parallel)
    Object.values(capabilities).forEach((cap) => {
      if (isElectron(cap.capabilities)) {
        const c = cap.capabilities as Capabilities.DesiredCapabilities;
        c.browserName = 'chrome';
        c.browserVersion = chromiumVersion || c.browserVersion;
        c['goog:chromeOptions'] = getChromeOptions(options, c);
        if (!chromiumVersion) {
          c['wdio:chromedriverOptions'] = getChromedriverOptions(options, c);
        }
      }
    });
  }

  log.debug('capabilities mapped', capabilities);

  return capabilities;
};

export const getChromiumVersion = async (electronVersion?: string) => {
  // get https://raw.githubusercontent.com/Kilian/electron-to-chromium/master/full-versions.json

  // if fail use installed version
  return chromiumVersions[electronVersion as keyof typeof chromiumVersions];
};

export const getElectronVersion = async (capabilities: Capabilities.RemoteCapabilities) => {
  // check capabilities
  if (Array.isArray(capabilities)) {
    type RemoteCapabilities = (typeof capabilities)[number];
    const electronCap = (capabilities as RemoteCapabilities[]).find((cap) => {
      if (isMultiremote(cap)) {
        // multiremote (parallel)
        return isElectron((cap as Capabilities.MultiRemoteCapabilities).capabilities);
      }

      // regular capabilities
      return isElectron(cap);
    });

    return electronCap ? (electronCap as Capabilities.DesiredCapabilities).browserVersion : undefined;
  } else if (isMultiremote(capabilities)) {
    // multiremote (non-parallel)
    const electronCap = Object.values(capabilities).find((cap) => isElectron(cap.capabilities));
    return electronCap ? (electronCap.capabilities as Capabilities.DesiredCapabilities).browserVersion : undefined;
  }

  // check local package.json for electron
  const dirname = getDirname();
  const packageJson = JSON.parse(fs.readFileSync(join(dirname, 'package.json'), { encoding: 'utf-8' })) as Partial<{
    dependencies?: { [name: string]: string };
    devDependencies?: { [name: string]: string };
  }>;
  const { dependencies, devDependencies } = packageJson;
  const localElectronVersion = parseVersion(dependencies?.electron || devDependencies?.electron);

  return localElectronVersion || undefined;
};
