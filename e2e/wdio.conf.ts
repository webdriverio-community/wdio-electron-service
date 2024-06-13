import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import type { Options } from '@wdio/types';
import type { PackageJson } from 'read-package-up';

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'examples', exampleDir, 'package.json'), { encoding: 'utf-8' }),
) as PackageJson;
const binaryPathMap = {
  'forge-esm': 'out/example-forge-esm-darwin-arm64/example-forge-esm.app/Contents/MacOS/example-forge-esm',
  'forge-cjs': 'out/example-forge-cjs-darwin-arm64/example-forge-cjs.app/Contents/MacOS/example-forge-cjs',
  'builder-esm': 'dist/mac-arm64/example-builder-esm.app/Contents/MacOS/example-builder-esm',
  'builder-cjs': 'dist/mac-arm64/example-builder-cjs.app/Contents/MacOS/example-builder-cjs',
};

globalThis.packageJson = packageJson;
process.env.TEST = 'true';

export const config: Options.Testrunner = {
  services: ['electron'],
  capabilities: [
    {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        appBinaryPath: path.join(__dirname, '..', 'examples', exampleDir, binaryPathMap[exampleDir]),
        appArgs: ['foo', 'bar=baz'],
        restoreMocks: true,
      },
    } as WebdriverIO.Capabilities,
  ],
  waitforTimeout: 5000,
  connectionRetryCount: 10,
  connectionRetryTimeout: 30000,
  logLevel: 'debug',
  runner: 'local',
  outputDir: `wdio-logs-${exampleDir}`,
  specs: [`./*.spec.ts`],
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
