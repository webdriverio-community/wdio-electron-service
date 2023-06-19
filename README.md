# WDIO Electron Service

**WebdriverIO service for testing Electron applications**

Enables cross-platform E2E testing of electron apps via the extensive WebdriverIO ecosystem. Adds electron-specific browser capabilities and handles chromedriver execution.

Spiritual successor to [Spectron](https://github.com/electron-userland/spectron) (RIP).

## Installation

```bash
npm i -D wdio-electron-service
```

Or use your package manager of choice - pnpm, yarn, etc.

You will need to install `WebdriverIO`, instructions can be found [here.](https://webdriver.io/docs/gettingstarted)

### Chromedriver

`wdio-electron-service` needs chromedriver to work. The chromedriver version needs to be appropriate for the version of electron that your app was built with, as of v4 you can specify the electron version that you are using and the service will download and use the appropriate version of chromedriver for your app.

#### Custom Configuration

If you prefer to manage chromedriver yourself you can install it directly or via some other means like [`electron-chromedriver`](https://github.com/electron/chromedriver), in this case you will need to tell the service where your chromedriver binary is. You can do this by specifying the `chromedriverCustomPath` property.

```bash
npm i -D chromedriver@100  # for Electron 18 apps
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
import { join } from 'path';
import fs from 'fs';
import { getDirname } from 'cross-dirname';

const dirname = getDirname();
const packageJson = JSON.parse(fs.readFileSync('./package.json'));
const {
  build: { productName },
} = packageJson;

export const config = {
  outputDir: 'all-logs',
  // ...
  services: [
    [
      'electron',
      {
        appPath: join(dirname, 'dist'),
        appName: productName,
        appArgs: ['foo', 'bar=baz'],
        chromedriver: {
          port: 9519,
          logFileName: 'wdio-chromedriver.log',
        },
        electronVersion: '23.1.0',
      },
    ],
  ],
  // ...
};
```

### API Configuration

If you wish to use the electron APIs then you will need to import (or require) the preload and main scripts in your app. Somewhere near the top of your preload:

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

After importing the scripts the APIs should now be available in tests.

Currently available APIs: [`app`](https://www.electronjs.org/docs/latest/api/app), [`browserWindow`](https://www.electronjs.org/docs/latest/api/browser-window), [`dialog`](https://www.electronjs.org/docs/latest/api/dialog), [`mainProcess`](https://www.electronjs.org/docs/latest/api/process).

The service re-exports the WDIO browser object with the `.electron` namespace for API usage in your tests:

```ts
import { browser } from 'wdio-electron-service';

// in a test
const appName = await browser.electron.app('getName');
```

### Mocking Electron APIs

You can mock electron API functionality by calling the mock function with the API name, function name and mock return value. e.g. in a spec file:

```ts
await browser.electron.mock('dialog', 'showOpenDialog', 'dialog opened!');
const result = await browser.electron.dialog('showOpenDialog');
console.log(result); // 'dialog opened!'
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
const someValue = await browser.electron.api('wow'); // default
const someValue = await browser.electron.myCustomAPI('wow'); // configured using `customApiBrowserCommand`
```

### Example

See the [Example App](./example/app/) and [E2Es](./example/e2e/) for an example of "real-world" usage in testing a minimal electron app.

## Configuration

### `appPath`: _`string`_

The path to the built app for testing. In a typical electron project this will be where `electron-builder` is configured to output, e.g. `dist` by default. Required to be used with `appName` as both are needed in order to generate a path to the electron binary.

### `appName`: _`string`_

The name of the built app for testing. Required to be used with `appPath` as both are needed in order to generate a path to the Electron binary.

It needs to match the name of the install directory used by `electron-builder`; this value is derived from your `electron-builder` configuration and will be either the `name` property (from `package.json`) or the `productName` property (from `electron-builder` config). You can find more information regarding this in the `electron-builder` [documentation](https://www.electron.build/configuration/configuration#configuration).

### `binaryPath`: _`string`_

The path to the electron binary of the app for testing. The path generated by using `appPath` and `appName` is tied to `electron-builder` output, if you are implementing something custom then you can use this.

### `electronVersion`: _`string`_

The version of electron that the app to be tested was built with. The service uses this value to download the appropriate version of chromedriver. It is not required if you are specifying a [`chromedriverCustomPath`](#chromedriverchromedrivercustompath-string).

### `appArgs`: _`string[]`_

An array of string arguments to be passed through to the app on execution of the test run.

### `customApiBrowserCommand`: _`string`_

#### default `api`

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

### `chromedriver.pollTimeOut`: _`number`_

#### default `10000`

The startup timeout of ChromeDriver in ms, it checks if the port is open before starting ChromeDriver and then checks again if it is closed after starting.

### `chromedriver.outputDir`: _`string`_

#### default defined by [`config.outputDir`](https://webdriver.io/docs/options/#outputdir)

The path where the output log of the chromedriver server should be stored. If not specified, the WDIO `outputDir` config property is used and chromedriver logs are written to the same directory as the WDIO logs.

### `chromedriver.logFileName`: _`string`_

#### default `wdio-chromedriver.log`

The name of the output log file to be written in the `outputDir`.

### `chromedriver.chromedriverCustomPath`: _`string`_

The path of the chromedriver binary to be executed. If not specified, the service will install the appropriate version of Chromedriver for the specified [`electronVersion`](#electronversion-string).
