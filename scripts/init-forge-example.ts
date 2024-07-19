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

// navigate to root directory
shell.cd(path.join(__dirname, '..'));

// delete corepack setting
shell.exec('pnpm pkg delete packageManager');

// navigate to directory of target app
shell.cd(path.join(__dirname, '..', 'apps', process.argv[2] || 'forge-esm'));

// remove any dependencies installed with pnpm
shell.exec('pnpm clean');

// install repo dependencies with yarn
shell.exec('yarn');
shell.exec(
  `yarn add wdio-electron-service@file:../../packages/wdio-electron-service/wdio-electron-service-${packageJson.version}.tgz`,
);
shell.exec('yarn add @repo/types@file:../../packages/types @repo/utils@file:../../packages/utils');
