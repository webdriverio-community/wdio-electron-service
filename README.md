# WDIO Electron Service

**WebdriverIO service for testing Electron applications**

Enables cross-platform E2E testing of electron apps via the extensive WebdriverIO ecosystem. Adds electron-specific browser capabilities and handles chromedriver execution.

Spiritual successor to [Spectron](https://github.com/electron-userland/spectron) (RIP).

## Installation

```bash
npm i -D wdio-electron-service
```

Or use your package manager of choice - yarn, pnpm, etc.

You will need to install `WebdriverIO`, instructions can be found [here.](https://webdriver.io/docs/gettingstarted)

### Chromedriver

`wdio-electron-service` needs chromedriver to work. The chromedriver version needs to be appropriate for the version of electron that your app was built with, so it is recommended to install it via [`electron-chromedriver`](https://github.com/electron/chromedriver) as their versioning directly tracks electron releases. For example:

```bash
npm i -D electron-chromedriver@18
```

The above command installs `electron-chromedriver` v18 which installs the chromedriver version that will work with an app built using electron 18.

Alternatively you can install chromedriver directly or via some other means, in this case you will need to specify the `chromedriverCustomPath` property.

```bash
npm i -D chromedriver@100  # for Electron 18 apps
npm i -D chromedriver@96  # for Electron 16 apps
```

```js
        chromedriver: {
          port: 9519,
          logFileName: 'wdio-chromedriver.log',
          chromedriverCustomPath: require.resolve('chromedriver/bin/chromedriver') // resolves to chromedriver binary
        },
```

## Example Configuration

To use the service you need to add `electron` to your services array, followed by a configuration object:

```js
// wdio.conf.js
const { join } = require('path');
const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('./package.json'));
const {
  build: { productName },
} = packageJson;

const config = {
  outputDir: 'all-logs',
  // ...
  services: [
    [
      'electron',
      {
        appPath: join(__dirname, 'dist'),
        appName: productName,
        appArgs: ['foo', 'bar=baz'],
        chromedriver: {
          port: 9519,
          logFileName: 'wdio-chromedriver.log',
        },
      },
    ],
  ],
  // ...
};

module.exports = { config };
```

### API Configuration

If you wish to use the electron APIs then you will need to import the preload and main scripts. Somewhere near the top of your preload:

```ts
if (isTest) {
  import('wdio-electron-service/preload');
}
```

And somewhere near the top of your main index file (app entry point):

```ts
if (isTest) {
  import('wdio-electron-service/main');
}
```

The APIs should not work outside of WDIO but for security reasons it is encouraged to use dynamic imports wrapped in conditionals to ensure the APIs are only exposed when the app is being tested.

After importing the scripts the APIs should now be available in tests. Currently available APIs: [`app`](https://www.electronjs.org/docs/latest/api/app), [`mainProcess`](https://www.electronjs.org/docs/latest/api/process), [`browserWindow`](https://www.electronjs.org/docs/latest/api/browser-window).

```ts
const appName = await browser.electronApp('getName');
```

### Custom Electron API

You can also implement a custom API if you wish. To do this you will need to define a handler in your main process:

```ts
import { ipcMain } from 'electron';

ipcMain.handle('wdio-electron', () => {
  // access some Electron or Node things on the main process
  return 'such api';
});
```

The custom API can then be called in a spec file:

```ts
const someValue = await browser.electronAPI('wow'); // default
const someValue = await browser.myCustomAPI('wow'); // configured using `customApiBrowserCommand`
```

### Example

See [wdio-electron-service-example](https://github.com/goosewobbler/wdio-electron-service-example) for an example of "real-world" usage in testing a minimal electron app.

## Configuration

### `appPath`: _`string`_

The path to the built app for testing. In a typical electron project this will be where `electron-builder` is configured to output, e.g. `dist` by default. Required to be used with `appName` as both are needed in order to generate a path to the electron binary.

### `appName`: _`string`_

The name of the built app for testing. Required to be used with `appPath` as both are needed in order to generate a path to the Electron binary.

It needs to match the name of the install directory used by `electron-builder`; this value is derived from your `electron-builder` configuration and will be either the `name` property (from `package.json`) or the `productName` property (from `electron-builder` config). You can find more information regarding this in the `electron-builder` [documentation](https://www.electron.build/configuration/configuration#configuration).

### `binaryPath`: _`string`_

The path to the electron binary of the app for testing. The path generated by using `appPath` and `appName` is tied to `electron-builder` output, if you are implementing something custom then you can use this.

### `appArgs`: _`string[]`_

An array of string arguments to be passed through to the app on execution of the test run.

### `customApiBrowserCommand`: _`string`_

#### default `electronAPI`

The browser command used to access the custom electron API.

## Chromedriver configuration

This service wraps the [`wdio-chromedriver-service`](https://github.com/webdriverio-community/wdio-chromedriver-service), you can configure the following options which will be passed through to that service:

### `chromedriver.port`: _`number`_

#### default `9515`

The port on which chromedriver should run.

### `chromedriver.path`: _`string`_

#### default `/`

The path on which chromedriver should run.

### `chromedriver.protocol`: _`string`_

#### default `http`

The protocol chromedriver should use.

### `chromedriver.hostname`: _`string`_

#### default `localhost`

The hostname chromedriver should use.

### `chromedriver.outputDir`: _`string`_

#### default defined by [`config.outputDir`](https://webdriver.io/docs/options/#outputdir)

The path where the output log of the chromedriver server should be stored. If not specified, the WDIO `outputDir` config property is used and chromedriver logs are written to the same directory as the WDIO logs.

### `chromedriver.logFileName`: _`string`_

#### default `wdio-chromedriver.log`

The name of the output log file to be written in the `outputDir`.

### `chromedriver.chromedriverCustomPath`: _`string`_

#### default `require.resolve('electron-chromedriver')`

The path of the chromedriver binary to be executed. If not specified, the service will look for the `electron-chromedriver` module.
