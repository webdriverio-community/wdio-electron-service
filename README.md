# WDIO Electron Service

**WebdriverIO service for testing Electron applications**

Enables cross-platform E2E testing of electron apps via the extensive WebdriverIO ecosystem. Adds electron-specific browser capabilities and handles chromedriver execution.

Spiritual successor to [Spectron](https://github.com/electron-userland/spectron) ([RIP](https://github.com/electron-userland/spectron/issues/1045)).

## Installation

```bash
npm install --dev wdio-electron-service
```

Or use your package manager of choice - pnpm, yarn, etc.

You will need to install `WebdriverIO`, instructions can be found [here.](https://webdriver.io/docs/gettingstarted)

### Chromedriver

`wdio-electron-service` needs Chromedriver to work. The Chromedriver version needs to be appropriate for the version of Electron that your app was built with, as of v4 you can specify the electron version that you are using and the service will download and use the appropriate version of chromedriver for your app.

If you prefer to manage Chromedriver yourself you can install it directly or via some other means like [`electron-chromedriver`](https://github.com/electron/chromedriver), in this case you will need to tell WebdriverIO where your Chromedriver binary is through its custom [`wdio:chromedriverOptions`](https://webdriver.io/docs/capabilities#webdriverio-capabilities-to-manage-browser-driver-options) capability.

## Example Configuration

To use the service you need to add `electron` to your services array, followed by a configuration object:

```js
// wdio.conf.js
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const packageJson = JSON.parse(await fs.readFile('./package.json'));
const {
  build: { productName },
} = packageJson;

export const config = {
  outputDir: 'logs',
  // ...
  services: ['electron'],
  capabilities: [{
    browserName: 'electron',
    'wdio:electronServiceOptions': {
      appPath: path.join(__dirname, 'dist'),
      appName: productName,
      appArgs: ['foo', 'bar=baz'],
      electronVersion: '23.1.0',
    }
  }],
  // ...
};
```

__Note:__ this code example illustrates a config that runs within an ESM environment.

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

The version of electron that the app to be tested was built with. The service uses this value to download the appropriate version of chromedriver.

### `appArgs`: _`string[]`_

An array of string arguments to be passed through to the app on execution of the test run. Electron [command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches) and some [Chromium switches](https://peter.sh/experiments/chromium-command-line-switches) can be used here.

### `customApiBrowserCommand`: _`string`_

#### default `api`

The browser command used to access the custom electron API.

## Chromedriver configuration

You can make updates to the Chromedriver configuration through WebdriverIOs custom [`wdio:chromedriverOptions`](https://webdriver.io/docs/capabilities#webdriverio-capabilities-to-manage-browser-driver-options) capability.

## Support

If you are having issues running WDIO you should open a discussion in the [main WDIO forum](https://github.com/webdriverio/webdriverio/discussions) in the first instance.

The electron service discussion forum is much less active than the WDIO one, but if the issue you are experiencing is specific to electron or using the service then you can open a discussion [here](https://github.com/webdriverio-community/wdio-electron-service/discussions).

## Common Issues

### DevToolsActivePort file doesn't exist

This is a Chromium error which may appear when using Docker or CI. Most of the "fixes" discussed online are based around passing different combinations of args to Chromium - you can set these via [`appArgs`](#appargs-string), though in most cases using xvfb has proven to be more effective; the service itself uses a [github action](https://github.com/coactions/setup-xvfb) to achieve this when running E2Es on CI.

See this [discussion](https://github.com/webdriverio-community/wdio-electron-service/discussions/60) for more details.
