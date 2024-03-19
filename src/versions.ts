import fetch from 'node-fetch';
import { compareVersions } from 'compare-versions';
import { fullVersions } from 'electron-to-chromium';

import log from './log.js';

const electronChromiumVersionMap: { [K: string]: string } = {};

type ElectronRelease = {
  chrome: string;
  version: string;
};

export const fetchElectronReleases = async () => {
  // get the electron releases list and sort them
  const body = await fetch('https://electronjs.org/headers/index.json');
  const allElectronVersions = (await body.json()) as ElectronRelease[];
  return allElectronVersions.sort(({ version: a }, { version: b }) => compareVersions(a, b));
};

export const getChromiumVersion = async (electronReleases: ElectronRelease[], electronVersion?: string) => {
  log.debug('Updating Electron - Chromium version map...');
  try {
    // construct the version map
    electronReleases.forEach(({ chrome, version }) => {
      electronChromiumVersionMap[version as keyof typeof electronChromiumVersionMap] = chrome;
    });

    return electronChromiumVersionMap[electronVersion as keyof typeof electronChromiumVersionMap];
  } catch (e) {
    // fall back to the locally installed electron-to-chromium version map
    log.debug('Map update failed: ', e);
    return fullVersions[electronVersion as keyof typeof fullVersions];
  }
};

export const isSupportedElectron = async (electronReleases: ElectronRelease[], electronVersion?: string) => {
  const electronMajorVersion = electronVersion?.split('.')[0] || '';
  const electronMajorReleases = electronReleases.reverse().filter((release) => release.version.endsWith('.0.0'));
  const releaseIndex = electronMajorReleases.findIndex((majorRelease) =>
    majorRelease.version?.startsWith(electronMajorVersion),
  );

  // Electron versions > 2 behind the latest major version are not supported
  // TODO: do we need the -1 check?
  if (releaseIndex > 2 || releaseIndex === -1) {
    return false;
  }

  return true;
};
