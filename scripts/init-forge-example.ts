// Electron Forge does not support pnpm, so this script is used to initialise a forge example app with yarn
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import shell from 'shelljs';
import type { PackageJson } from 'read-package-up';

// read version from main package
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'packages', 'wdio-electron-service', 'package.json'), {
    encoding: 'utf-8',
  }),
) as PackageJson;

// navigate to main package directory
shell.cd(path.join(__dirname, '..', 'packages', 'wdio-electron-service'));

// rename node_modules
shell.exec('mv node_modules node_modules_pnpm');

// set the dependencies to the local packages instead of workspace links
shell.exec('pnpm pkg set dependencies.@repo/types=file:../types dependencies.@repo/utils=file:../utils');

// pack the package
shell.exec('yarn');
shell.exec('yarn pack');

// navigate to root directory
shell.cd(path.join(__dirname, '..'));

// retrieve and delete corepack setting
const packageManager = shell.exec('pnpm pkg get packageManager').stdout.trim();
shell.exec('pnpm pkg delete packageManager');

// navigate to directory of target app
shell.cd(path.join(__dirname, '..', 'apps', process.argv[2] || 'forge-esm'));

// remove any dependencies installed with pnpm
shell.exec('pnpm clean');

// install repo dependencies with yarn
shell.exec('yarn');
shell.exec('yarn add file:../../packages/types file:../../packages/utils');
shell.exec(`yarn add file:../../packages/wdio-electron-service/wdio-electron-service-v${packageJson.version}.tgz`);

// navigate to root directory
shell.cd(path.join(__dirname, '..'));

// add corepack setting back
shell.exec(`pnpm pkg set packageManager=${packageManager}`);
