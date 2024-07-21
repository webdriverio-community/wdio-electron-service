// Running E2Es on Windows CI requires Electron 29.x to ensure the tests pass.
// This script updates the repo so that Electron 29.x is installed where required.
import url from 'node:url';
import path from 'node:path';

import shell from 'shelljs';

const electronVersion = '^29.4.5';

// read dirname
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

for (const app of ['forge-esm', 'forge-cjs', 'builder-esm', 'builder-cjs']) {
  // navigate to directory of target app
  shell.cd(path.join(__dirname, '..', 'apps', app));

  // set the version of Electron
  shell.exec(`pnpm pkg set devDependencies.electron=${electronVersion}`);
}

// navigate to e2e directory
shell.cd(path.join(__dirname, '..', 'packages', 'e2e'));

// set the version of Electron
shell.exec(`pnpm pkg set dependencies.electron=${electronVersion}`);
