// Electron Forge does not support pnpm, so this script is used to create a yarn version of the wdio-electron-service package
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import shell from 'shelljs';
import type { PackageJson } from 'read-package-up';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// read package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'packages', 'wdio-electron-service', 'package.json'), {
    encoding: 'utf-8',
  }),
) as PackageJson;

// navigate to root directory
shell.cd(path.join(__dirname, '..'));

// retrieve and delete corepack setting
const packageManager = shell.exec('pnpm pkg get packageManager').stdout.trim();
shell.exec('pnpm pkg delete packageManager');

// navigate to packages directory
shell.cd(path.join(__dirname, '..', 'packages'));

// define path for the file links for deps
const bundlerPath = path.join(__dirname, '..', 'packages', '@wdio_electron-bundler');
const typesPath = path.join(__dirname, '..', 'packages', '@wdio_electron-types');
const utilsPath = path.join(__dirname, '..', 'packages', '@wdio_electron-utils');
const cdpPath = path.join(__dirname, '..', 'packages', '@wdio_electron-cdp-bridge');

// create a copy of wdio-electron-service for yarn
shell.exec('pnpx shx cp -r wdio-electron-service wdio-electron-service-yarn');

// navigate to package directory (@wdio_electron-cdp-bridge)
shell.cd(path.join(__dirname, '..', 'packages', '@wdio_electron-cdp-bridge'));

// replace workspace links with file links for deps
shell.exec(
  [
    `pnpm pkg set`,
    `devDependencies.@wdio/electron-bundler=file:${bundlerPath}`,
    `dependencies.@wdio/electron-utils=file:${utilsPath}`,
  ].join(' '),
);

// navigate to new yarn package directory (wdio-electron-service-yarn)
shell.cd(path.join(__dirname, '..', 'packages', 'wdio-electron-service-yarn'));

// delete node_modules
shell.exec('pnpx shx rm -rf node_modules');

// replace workspace links with file links for deps
shell.exec(
  [
    `pnpm pkg set`,
    `devDependencies.@wdio/electron-bundler=file:${bundlerPath}`,
    `dependencies.@wdio/electron-types=file:${typesPath}`,
    `dependencies.@wdio/electron-utils=file:${utilsPath}`,
    `dependencies.@wdio/cdp-bridge=file:${cdpPath}`,
  ].join(' '),
);

// install, build, and pack the package
shell.exec('yarn');
shell.exec('yarn build');
shell.exec('yarn pack');

// navigate to the packages directory
shell.cd(path.join(__dirname, '..', 'packages'));

// copy the tarball to the forge example dirs
const tarball = `wdio-electron-service-v${packageJson.version}.tgz`;
shell.exec(`pnpx shx cp ./wdio-electron-service-yarn/${tarball} ../apps/forge-esm/${tarball}`);
shell.exec(`pnpx shx cp ./wdio-electron-service-yarn/${tarball} ../apps/forge-cjs/${tarball}`);

// navigate to package directory (@wdio_electron-cdp-bridge)
shell.cd(path.join(__dirname, '..', 'packages', '@wdio_electron-cdp-bridge'));

// revert to workspace links
shell.exec(
  [
    `pnpm pkg set`,
    `'devDependencies.@wdio/electron-bundler=workspace:*'`,
    `'dependencies.@wdio/electron-utils=workspace:*'`,
  ].join(' '),
);

// delete the yarn package directory
shell.exec('pnpx shx rm -rf wdio-electron-service-yarn');

// navigate to root directory
shell.cd(path.join(__dirname, '..'));

// add corepack setting back
shell.exec(`pnpm pkg set packageManager=${packageManager}`);
