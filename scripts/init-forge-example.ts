import shell from 'shelljs';
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import type { PackageJson } from 'read-package-up';

// read version from main package
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'packages', 'wdio-electron-service', 'package.json'), {
    encoding: 'utf-8',
  }),
) as PackageJson;

// navigate to example directory
shell.cd(path.join(__dirname, '..', 'examples', process.argv[2] || 'forge-esm'));

// remove dependencies installed with pnpm
shell.exec('pnpm clean');

// install dependencies with npm
shell.exec('npm install');
shell.exec(
  `npm install --no-save ../../packages/wdio-electron-service/wdio-electron-service-${packageJson.version}.tgz`,
);
