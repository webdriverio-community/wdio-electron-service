// Electron Forge does not support pnpm, so this script is used to create a yarn version of the wdio-electron-service package
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

// navigate to packages directory
shell.cd(path.join(__dirname, '..', 'packages'));

// create a copy of wdio-electron-service for yarn
shell.exec('cp -r wdio-electron-service wdio-electron-service-yarn');

// navigate to new yarn package directory
shell.cd(path.join(__dirname, '..', 'packages', 'wdio-electron-service-yarn'));

// delete node_modules
shell.exec('rm -rf node_modules');

// replace workspace links with file links for deps
shell.exec(
  `pnpm pkg set dependencies.@repo/types=file:${path.join(__dirname, '..', 'packages', 'types')} dependencies.@repo/utils=file:${path.join(__dirname, '..', 'packages', 'utils')}`,
);

// update build scripts for yarn
shell.exec('pnpm pkg set scripts.build="yarn build:esm && yarn build:cjs"');
shell.exec('pnpm pkg set scripts.build:cjs="yarn build:cjs:copy && yarn build:cjs:compile"');

// install, build, and pack the package
shell.exec('yarn');
shell.exec('yarn build');
shell.exec('yarn pack');

// navigate to the packages directory
shell.cd(path.join(__dirname, '..', 'packages'));

// move the tarball to the packages directory
shell.exec(`mv wdio-electron-service/wdio-electron-service-v${packageJson.version}.tgz .`);

// delete the yarn package directory
shell.exec('rm -rf wdio-electron-service-yarn');
