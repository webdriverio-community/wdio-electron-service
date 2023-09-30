import path from 'node:path';
import fs from 'node:fs';

// TODO: fix CJS import of utils
// import { getBinaryPath } from 'wdio-electron-service/utils';

function getBinaryPath(appPath: string, appName: string, distDirName = 'dist') {
  const SupportedPlatform = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
  };
  const { platform, arch } = process;

  if (!Object.values(SupportedPlatform).includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const pathMap = {
    darwin: path.join(arch === 'arm64' ? 'mac-arm64' : 'mac', `${appName}.app`, 'Contents', 'MacOS', appName),
    linux: path.join('linux-unpacked', appName),
    win32: path.join('win-unpacked', `${appName}.exe`),
  };

  const electronPath = pathMap[platform as keyof typeof SupportedPlatform];

  return path.join(appPath, distDirName, electronPath);
}

const packageJson = JSON.parse(fs.readFileSync('./package.json').toString());
const {
  build: { productName },
} = packageJson;

process.env.TEST = 'true';

exports.config = {
  services: ['electron'],
  capabilities: [
    {
      'browserName': 'electron',
      'browserVersion': '26.2.2',
      'wdio:electronServiceOptions': {
        appBinaryPath: getBinaryPath(__dirname, productName),
        appArgs: ['foo', 'bar=baz'],
      },
    },
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
      esm: false,
      project: path.join(__dirname, 'tsconfig.json'),
    },
  },
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
};
