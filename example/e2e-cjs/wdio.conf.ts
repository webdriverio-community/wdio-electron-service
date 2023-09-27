import path from 'node:path';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('../app/package.json').toString());
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
        appPath: path.join(__dirname, '..', 'app', 'dist'),
        appName: productName,
        appArgs: ['foo', 'bar=baz'],
      },
    },
  ],
  waitforTimeout: 5000,
  connectionRetryCount: 10,
  connectionRetryTimeout: 30000,
  logLevel: 'debug',
  runner: 'local',
  // outputDir: 'wdio-logs',
  specs: ['./test/*.spec.ts'],
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: path.join(__dirname, 'tsconfig.json'),
    },
  },
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
};

console.log(exports.config);
