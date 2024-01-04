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

If you are not specifying a Chromedriver binary then the service will download and use the appropriate version for your app's Electron version. The Electron version of your app is determined by the version of `electron` or `electron-nightly` in your `package.json`, however you may want to override this behaviour - for instance, if the app you are testing is in a different repo from the tests. You can specify the Electron version manually by setting the `browserVersion` capability, as shown in the example configuration below.

## Configuration

To use the service you need to add `electron` to your services array and set an Electron capability, e.g.:

```js
// wdio.conf.js
export const config = {
  outputDir: 'logs',
  // ...
  services: ['electron'],
  capabilities: [
    {
      browserName: 'electron',
    },
  ],
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

For security reasons it is encouraged to use dynamic imports wrapped in conditionals to ensure electron main process access is only available when the app is being tested.

### Execute Electron Scripts

You can execute arbitrary scripts within the context of your Electron application main process using `browser.electron.execute(...)`. This allows you to access the Electron APIs in a fluid way, in case you wish to manipulate your application at runtime or trigger certain events.

For example, you can trigger an message modal from your test via:

```ts
await browser.electron.execute(
  (electron, param1, param2, param3) => {
    const appWindow = electron.BrowserWindow.getFocusedWindow();
    electron.dialog.showMessageBox(appWindow, {
      message: 'Hello World!',
      detail: `${param1} + ${param2} + ${param3} = ${param1 + param2 + param3}`,
    });
  },
  1,
  2,
  3,
);
```

which will make the application trigger the following alert:

![Execute Demo](./.github/assets/execute-demo.png 'Execute Demo')

**Note:** The first argument of the function will be always the default export of the `electron` package that contains the [Electron API](https://www.electronjs.org/docs/latest/api/app).

### Mocking Electron APIs

You can mock Electron API functionality by calling the mock function with the API name and function name. e.g. in a spec file:

```ts
const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
await browser.electron.execute(
  async (electron) =>
    await electron.dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
    }),
);

const mockedShowOpenDialog = await showOpenDialog.update();
expect(mockedShowOpenDialog).toHaveBeenCalledTimes(1);
expect(mockedShowOpenDialog).toHaveBeenCalledWith({
  properties: ['openFile', 'openDirectory'],
});
```

Make sure to call `update()` on the mock before using it with `expect`.

You can also pass a mockReturnValue, or set it after defining your mock:

```ts
const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog', 'I opened a dialog!');
```

```ts
const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
await showOpenDialog.mockReturnValue('I opened a dialog!');
```

Which results in the following:

```ts
const result = await browser.electron.execute(async (electron) => await electron.dialog.showOpenDialog());
expect(result).toBe('I opened a dialog!');
```

You can mock all functions from an API using `mockAll`, the mocks are returned as an object:

```ts
const dialog = await browser.electron.mockAll('dialog');
await dialog.showOpenDialog.mockReturnValue('I opened a dialog!');
await dialog.showMessageBox.mockReturnValue('I opened a message box!');
```

Mocks can be removed by calling `removeMocks`, or directly by calling `unMock` on the mock itself:

```ts
// removes all mocked functions
await browser.electron.removeMocks();
// removes all mocked functions from the dialog API
await browser.electron.removeMocks('dialog');
// removes the showOpenDialog mock from the dialog API
const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
await showOpenDialog.unMock();
```

## Example

Check out our [Electron boilerplate](https://github.com/webdriverio/electron-boilerplate) project that showcases how to integrate WebdriverIO in an example application. You can also have a look at the [Example App](./example/app/) and [E2Es](./example/e2e/) in this repository.

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

The path to the Electron binary of the app for testing. In most cases the service will determine the path to your app automatically, but if this fails for some reason, e.g. your app is in a different repository from your tests, then it is recommended to set this value manually.

Type: `string`

### `appArgs`:

An array of string arguments to be passed through to the app on execution of the test run. Electron [command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches) and some [Chromium switches](https://peter.sh/experiments/chromium-command-line-switches) can be used here.

Type: `string[]`

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
