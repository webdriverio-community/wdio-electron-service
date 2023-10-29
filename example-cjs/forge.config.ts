import path from 'node:path';

import MakerSquirrel from '@electron-forge/maker-squirrel';
import MakerDMG from '@electron-forge/maker-dmg';
import MakerZIP from '@electron-forge/maker-zip';
import type { ForgeConfig } from '@electron-forge/shared-types';

const icon = path.join(__dirname, 'src', 'assets', 'icon', 'webdriverio');

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon,
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({ icon }, ['darwin']),
    new MakerSquirrel(
      {
        name: 'WDIO Electron Service CJS Example',
        owners: 'WebdriverIO',
        authors: 'WebdriverIO',
        copyright: 'WebdriverIO',
      },
      ['win32'],
    ),
  ],
  plugins: [],
};

export default config;
