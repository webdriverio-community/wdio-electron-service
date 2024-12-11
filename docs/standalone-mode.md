# Standalone Mode

You can also use the service without the WDIO testrunner, e.g. in a normal Node.js script.

The `startWdioSession` method accepts `ElectronServiceCapabilities`, which are the capabilities specified in a regular [WDIO configuration](./configuration/service-configuration.md).

The method creates a new WDIO session using your configuration and returns the WebdriverIO browser object:

```TS
import { startWdioSession } from 'wdio-electron-service';

const browser = await startWdioSession([{
  'browserName': 'electron', // you need to specify browserName
  'browserVersion': '33.2.1',
  'wdio:electronServiceOptions': {
    appBinaryPath: '/path/to/binary',
  },
  'goog:chromeOptions': {
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--headless'],
  },
  'wdio:chromedriverOptions': {
    binary: '/path/to/chromedriver',
  },
}]);

const appName = await browser.electron.execute((electron) => electron.app.getName());
```

`rootDir` can be specified in the second (optional) `ElectronServiceGlobalOptions` parameter, which also accepts mocking preferences for the session:

```TS
const browser = await startWdioSession([
  { ... },
  {
    rootDir: '/path/to/dir',
    clearMocks: false,
    resetMocks: false,
    restoreMocks: true,
  }
]);
```
