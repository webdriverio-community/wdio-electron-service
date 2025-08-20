const path = require('node:path');

const icon = path.join(__dirname, 'src', 'assets', 'icon', 'webdriverio');

const config = {
  packagerConfig: {
    ignore: /node_modules/,
    asar: true,
    icon,
    osxSign: false,
  },
  rebuildConfig: {},
  makers: [],
  plugins: [],
};

module.exports = config;
