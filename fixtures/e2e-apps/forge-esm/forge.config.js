import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
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

export default config;
