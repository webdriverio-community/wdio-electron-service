# WDIO Electron Service

**WebdriverIO service for testing Electron applications**

Enables cross-platform E2E testing of Electron apps via the extensive WebdriverIO ecosystem. Adds Electron-specific browser capabilities and handles chromedriver execution.

Spiritual successor to [Spectron](https://github.com/electron-userland/spectron) ([RIP](https://github.com/electron-userland/spectron/issues/1045)).

### Features

Using this service makes testing Electron applications much easier as it takes care of the following:

- 🚗 auto-setup of required Chromedriver
- 📦 finds path to your bundled Electron application (if [Electron Forge](https://www.electronforge.io/) or [Electron Builder](https://www.electron.build/) is used)
- 🧩 enables ability to access Electron APIs within your tests
- 🕵️ allows to mock Electron APIs

## Installation

```bash
npm install --dev wdio-electron-service
```

Or use your package manager of choice - pnpm, yarn, etc.

You will need to install `WebdriverIO`, instructions can be found [here.](https://webdriver.io/docs/gettingstarted)

### Chromedriver

`wdio-electron-service` needs Chromedriver to work. The Chromedriver version needs to be appropriate for the version of Electron that your app was built with, you can either manage this yourself or let the service handle it.

#### User Managed

If you prefer to manage Chromedriver yourself you can install it directly or via some other means like [`electron-chromedriver`](https://github.com/electron/chromedriver), in this case you will need to tell WebdriverIO where your Chromedriver binary is through its custom [`wdio:chromedriverOptions`](https://webdriver.io/docs/capabilities#webdriverio-capabilities-to-manage-browser-driver-options) capability.

#### Service Managed

If you are not specifying a Chromedriver binary then the service will download and use the appropriate version for your app's Electron version. The Electron version of your app is determined by the version of `electron` or `electron-nighly` in your `package.json`, however you may want to override this behaviour - for instance, if the app you are testing is in a different repo from the tests. You can specify the Electron version manually by setting the `browserVersion` capability, as shown in the example configuration below.

## Configuration

To use the service you need to add `electron` to your services array and set an Electron capability, e.g.:

```js
// wdio.conf.js
import url from 'node:url';
import path from 'node:path';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
export const config = {
  outputDir: 'logs',
  // ...
  services: ['electron'],
  capabilities: [{
      browserName: 'electron'
  }],
  // ...
};
```

The service will attempt to find the path to your bundled Electron application if you use [Electron Forge](https://www.electronforge.io/) or [Electron Builder](https://www.electron.build/) as bundler. You can provide a custom path to the binary via custom service capabilities, e.g.:

```ts
capabilities: [{
  browserName: 'electron',
  'wdio:electronServiceOptions': {
    appBinaryPath: './path/to/bundled/electron/app.exe',
    appArgs: ['foo', 'bar=baz'],
  },
}],
```

### APIs

If you wish to use the Electron APIs then you will need to import (or require) the preload and main scripts in your app. To import 3rd-party packages (node_modules) in your `preload.js`, you have to disable sandboxing in your `BrowserWindow` config.

It is not recommended to disable sandbox mode in production; to control this behaviour you can set the `NODE_ENV` environment variable when executing WDIO:

```json
"wdio": "NODE_ENV=test wdio run wdio.conf.js "
```

In your BrowserWindow configuration, set the sandbox option depending on the NODE_ENV variable:

```ts
const isTest = process.env.NODE_ENV === 'test';

new BrowserWindow({
  webPreferences: {
      sandbox: !isTest
      preload: path.join(__dirname, 'preload.js'),
  }
  // ...
});
```

Then somewhere near the top of your `preload.js`, load `wdio-electron-service/preload` conditionally, e.g.:

```ts
if (process.env.NODE_ENV === 'test') {
  import('wdio-electron-service/preload');
}
```

And somewhere near the top of your main index file (app entry point), load `wdio-electron-service/main` conditionally, e.g.:

```ts
if (process.env.NODE_ENV === 'test') {
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

You can mock Electron API functionality by calling the mock function with the API name, function name and mock return value. e.g. in a spec file:

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

## Example

Check out our [Electron boilerplate](https://github.com/webdriverio/electron-boilerplate/actions/runs/6490587562/job/17626575914) project that showcases how to intergate WebdriverIO in an example application. You can also have a look at the [Example App](./example/app/) and [E2Es](./example/e2e/) in this repository.

## Service Options

Configurations required to connect WebdriverIO with your Electron application can be applied by setting `wdio:electronServiceOptions` either on the service level or capability level, in which capability level configurations take precedence, e.g. the following WebdriverIO configuration:

```ts
export const config = {
  // ...
  services: [
    [
      'electron',
      {
        appBinaryPath: '/foo/bar/myApp'
      },
    ],
  ],
  capabilities: [
    {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        appBinaryPath: '/foo/bar/myOtherApp'
        appArgs: ['foo', 'bar'],
      },
    },
  ],
  // ...
};
```

This results in the following configuration object used for given capability:

```js
{
  appBinaryPath: '/foo/bar/myOtherApp',
  appArgs: ['foo', 'bar']
}
```

This service supports the following configuration options:

### `appBinaryPath`:

The path to the Electron binary of the app for testing. If you were using the `appPath` / `appName` approach from previous versions of the service for an app utilising `electron-builder`, you should use the [`getBinaryPath`](./src/utils.ts) util to generate the appropriate `appBinaryPath` value, as shown in the [example configuration](#example-configuration) above.

Type: `string`

### `appArgs`:

An array of string arguments to be passed through to the app on execution of the test run. Electron [command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches) and some [Chromium switches](https://peter.sh/experiments/chromium-command-line-switches) can be used here.

Type: `string[]`

### `customApiBrowserCommand`

The browser command used to access the custom electron API.

Type: `string`  
Default: `'api'`

## Chromedriver configuration

You can make updates to the Chromedriver configuration through the WebdriverIO custom [`wdio:chromedriverOptions`](https://webdriver.io/docs/capabilities#webdriverio-capabilities-to-manage-browser-driver-options) capability.

## Support

If you are having issues running WDIO you should open a discussion in the [main WDIO forum](https://github.com/webdriverio/webdriverio/discussions) in the first instance.

The Electron service discussion forum is much less active than the WDIO one, but if the issue you are experiencing is specific to Electron or using the service then you can open a discussion [here](https://github.com/webdriverio-community/wdio-electron-service/discussions).

## Common Issues

### Error: ContextBridge not available for invocation of "app" API

When using Electron Forge or Electron Packager with Asar, it is possible that the `wdio-electron-service` module is not included in your generated app.asar.
You can solve this, by either running the packager with the `prune: false` option or the `--no-prune` flag, or by moving "wdio-electron-service" from `devDependencies` to `dependencies`.
It is recommend to do the former, for instance by passing an environment variable to the packager:

#### Electron Packager

```bash
$ npx electron-packager --no-prune
```

#### Electron Forge

```json
"package": "NODE_ENV=test electron-forge package"
```

```ts
// forge.config.js
module.exports = {
  packagerConfig: {
    asar: true,
    prune: process.env.NODE_ENV !== 'test',
  },
  // ...
};
```

### DevToolsActivePort file doesn't exist

This is a Chromium error which may appear when using Docker or CI. Most of the "fixes" discussed online are based around passing different combinations of args to Chromium - you can set these via [`appArgs`](#appargs-string), though in most cases using xvfb has proven to be more effective; the service itself uses a [github action](https://github.com/coactions/setup-xvfb) to achieve this when running E2Es on CI.

See this [discussion](https://github.com/webdriverio-community/wdio-electron-service/discussions/60) for more details.
