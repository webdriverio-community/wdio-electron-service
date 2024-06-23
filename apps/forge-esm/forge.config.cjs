// This config file can be converted back to ESM once we are able to upgrade Forge to the latest version
// Forge v7.0.0 is required to support ESM, but 7.x is currently broken on Windows:
// https://github.com/electron/forge/issues/3448

const path = require('node:path');
//import url from 'node:url';

// const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const icon = path.join(__dirname, 'src', 'assets', 'icon', 'webdriverio');

const config = {
  packagerConfig: {
    ignore: /node_modules/,
    asar: true,
    icon,
  },
  rebuildConfig: {},
  makers: [],
  plugins: [],
};

module.exports = config;
