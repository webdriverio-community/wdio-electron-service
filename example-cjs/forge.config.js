const path = require('node:path');

const icon = path.join(__dirname, 'src', 'assets', 'icon', 'webdriverio');

const config = {
  packagerConfig: {
    ignore: /e2e/,
    asar: true,
    icon,
  },
  rebuildConfig: {},
  makers: [],
  plugins: [],
};

module.exports = config;
