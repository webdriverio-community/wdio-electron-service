## Configuration

The service can be configured by setting `wdio:electronServiceOptions` either on the service level or capability level, in which capability level configurations take precedence, e.g. the following WebdriverIO configuration:

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

The above would result in the following configuration object:

```js
{
  appBinaryPath: '/foo/bar/myOtherApp',
  appArgs: ['foo', 'bar']
}
```

### Service Options

The service supports the following configuration options:

#### `appBinaryPath`:

The path to the Electron binary of the app for testing. In most cases the service will determine the path to your app automatically, but if this fails for some reason, e.g. your app is in a different repository from your tests, then it is recommended to set this value manually.

Type: `string`

#### `appArgs`:

An array of string arguments to be passed through to the app on execution of the test run. Electron [command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches) and some [Chromium switches](https://peter.sh/experiments/chromium-command-line-switches) can be used here.

Type: `string[]`

### Chromedriver

`wdio-electron-service` needs Chromedriver to work. The Chromedriver version needs to be appropriate for the version of Electron that your app was built with, you can either let the service handle this (default) or manage it yourself.

#### Service Managed

If you are not specifying a Chromedriver binary then the service will download and use the appropriate version for your app's Electron version. The Electron version of your app is determined by the version of `electron` or `electron-nightly` in your `package.json`, however you may want to override this behaviour - for instance, if the app you are testing is in a different repo from the tests. You can specify the Electron version manually by setting the `browserVersion` capability, as shown in the example configuration below:

```js
// wdio.conf.js
export const config = {
  outputDir: 'logs',
  // ...
  services: ['electron'],
  capabilities: [
    {
      browserName: 'electron',
      browserVersion: '28.0.0',
    },
  ],
  // ...
};
```

#### User Managed

If you prefer to manage Chromedriver yourself you can install it directly or via some other means like [`electron-chromedriver`](https://github.com/electron/chromedriver), in this case you will need to tell WebdriverIO where your Chromedriver binary is through its custom [`wdio:chromedriverOptions`](https://webdriver.io/docs/capabilities#webdriverio-capabilities-to-manage-browser-driver-options) capability.
