// This script is used to remove artifacts of the npm install for a forge example app
import url from 'node:url';
import path from 'node:path';

import shell from 'shelljs';

// read version from main package
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// navigate to directory of target app
shell.cd(path.join(__dirname, '..', 'apps', process.argv[2] || 'forge-esm'));

// remove any dependencies installed with npm from the package.json
shell.exec('pnpm pkg delete dependencies');

// install the correct workspace dependencies
shell.exec('pnpm install wdio-electron-service@workspace:*');
