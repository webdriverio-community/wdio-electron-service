import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import type { Options } from '@wdio/types';
import type { PackageJson } from 'read-package-up';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), { encoding: 'utf-8' }),
) as PackageJson;

globalThis.packageJson = packageJson;
process.env.TEST = 'true';

export const config: Options.Testrunner = {
  services: ['electron'],
  capabilities: [
    {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        appEntryPoint: path.join(__dirname, 'dist', 'main.bundle.js'),
        // appEntryPoint: path.join(__dirname, 'test-main.js'),
        appArgs: ['foo', 'bar=baz'],
      },
      // 'wdio:chromedriverOptions': {
      //   binary: '/Users/sam/Downloads/chromedriver-v19', // your path to the chrome driver.
      // },
    } as WebdriverIO.Capabilities,
  ],
  waitforTimeout: 5000,
  connectionRetryCount: 10,
  connectionRetryTimeout: 30000,
  logLevel: 'debug',
  runner: 'local',
  outputDir: 'wdio-logs',
  specs: ['./e2e/*.spec.ts'],
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      files: true,
      project: path.join(__dirname, 'tsconfig.json'),
    },
  },
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
};
