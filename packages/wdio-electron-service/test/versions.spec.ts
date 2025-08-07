import nock from 'nock';
import { describe, expect, it } from 'vitest';

import { getChromiumVersion } from '../src/versions.js';

describe('Version Utilities', () => {
  describe('getChromiumVersion()', () => {
    it('should find the Chromium version for a given Electron version', async () => {
      nock('https://electronjs.org')
        .get('/headers/index.json')
        .reply(200, [
          {
            version: '25.8.3',
            date: '2023-09-27',
            node: '18.15.0',
            v8: '11.4.183.29-electron.0',
            uv: '1.44.2',
            zlib: '1.2.13',
            openssl: '1.1.1',
            modules: '116',
            chrome: '114.0.5735.289',
            files: [
              'darwin-x64',
              'darwin-x64-symbols',
              'linux-ia32',
              'linux-ia32-symbols',
              'linux-x64',
              'linux-x64-symbols',
              'win32-ia32',
              'win32-ia32-symbols',
              'win32-x64',
              'win32-x64-symbols',
            ],
          },
          {
            version: '24.8.4',
            date: '2023-09-27',
            node: '18.14.0',
            v8: '11.2.214.22-electron.0',
            uv: '1.44.2',
            zlib: '1.2.13',
            openssl: '1.1.1',
            modules: '114',
            chrome: '112.0.5615.204',
            files: [
              'darwin-x64',
              'darwin-x64-symbols',
              'linux-ia32',
              'linux-ia32-symbols',
              'linux-x64',
              'linux-x64-symbols',
              'win32-ia32',
              'win32-ia32-symbols',
              'win32-x64',
              'win32-x64-symbols',
            ],
          },
        ]);
      expect(await getChromiumVersion('24.8.4')).toBe('112.0.5615.204');
      expect(await getChromiumVersion('25.8.3')).toBe('114.0.5735.289');
    });

    it('should fall back to the locally installed electron-to-chromium version map', async () => {
      nock('https://electronjs.org').get('/headers/index.json').reply(400, 'Bad Request');
      expect(await getChromiumVersion('24.8.4')).toBe('112.0.5615.204');
      expect(await getChromiumVersion('25.8.3')).toBe('114.0.5735.289');
    });
  });
});
