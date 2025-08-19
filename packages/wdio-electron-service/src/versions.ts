import { createLogger } from '@wdio/electron-utils';

const log = createLogger('service');

import { compareVersions } from 'compare-versions';
import { fullVersions } from 'electron-to-chromium';

const electronChromiumVersionMap: { [K: string]: string } = {};

type ElectronRelease = {
  chrome: string;
  version: string;
};

export const getChromiumVersion = async (electronVersion?: string) => {
  log.debug('Updating Electron - Chromium version map...');
  try {
    // get the electron releases list and construct the version map
    const body = await fetch('https://electronjs.org/headers/index.json');
    const allElectronVersions = (await body.json()) as ElectronRelease[];
    allElectronVersions
      .sort(({ version: a }, { version: b }) => compareVersions(a, b))
      .forEach(({ chrome, version }) => {
        electronChromiumVersionMap[version as keyof typeof electronChromiumVersionMap] = chrome;
      });

    return electronChromiumVersionMap[electronVersion as keyof typeof electronChromiumVersionMap];
  } catch (e) {
    // fall back to the locally installed electron-to-chromium version map
    log.debug('Map update failed: ', e);
    log.debug('Falling back to locally installed map...');
    return fullVersions[electronVersion as keyof typeof fullVersions];
  }
};
