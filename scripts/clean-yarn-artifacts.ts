// This script is used to remove artifacts of the hacky shenanigans employed to get Electron Forge working with pnpm.
import url from 'node:url';
import path from 'node:path';

import shell from 'shelljs';

// read dirname
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

for (const app of ['forge-esm', 'forge-cjs']) {
  // navigate to directory of target app
  shell.cd(path.join(__dirname, '..', 'apps', app));

  // reset the dependencies to the workspace links
  shell.exec('pnpm pkg set dependencies.wdio-electron-service=workspace:*');

  // delete tgz file
  shell.rm('*.tgz');

  // remove any yarn artifacts
  shell.exec('pnpm clean');
}

// delete the yarn package directory
shell.cd(path.join(__dirname, '..', 'packages'));
shell.exec('pnpx shx rm -rf wdio-electron-service-yarn');
