import fetch from 'node-fetch';
import { compareVersions } from 'compare-versions';
import { fullVersions } from 'electron-to-chromium';
import findVersions from 'find-versions';

import log from './log.js';

const electronChromiumVersionMap: { [k: string]: string } = {};

type ElectronRelease = {
  chrome: string;
  version: string;
};

export const parseVersion = (version?: string) => {
  if (!version) {
    return undefined;
  }
  return findVersions(version)[0];
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
    return fullVersions[electronVersion as keyof typeof fullVersions];
  }
};
