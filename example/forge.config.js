import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
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

export default config;
