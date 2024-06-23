// This config file can be converted back to ESM once we can upgrade Forge to the latest version
// We are currently using Forge 6.x until the following issue is resolved (affecting Forge 7.x on Windows):
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
