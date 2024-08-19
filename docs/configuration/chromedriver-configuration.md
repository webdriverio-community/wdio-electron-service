# Chromedriver Configuration

`wdio-electron-service` needs Chromedriver to work. The Chromedriver version needs to be appropriate for the version of Electron that your app was built with, you can either let the service handle this (default) or manage it yourself.

## Service Managed

If you are not specifying a Chromedriver binary then the service will download and use the appropriate version for your app's Electron version. The Electron version of your app is determined by the version of `electron` or `electron-nightly` in your `package.json`, however you may want to override this behaviour - for instance, if the app you are testing is in a different repo from the tests. You can specify the Electron version manually by setting the `browserVersion` capability, as shown in the example configuration below:

_`wdio.conf.ts`_

```ts
export const config = {
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

## User Managed

In order to manage Chromedriver yourself you can install it directly or via some other means like [`electron-chromedriver`](https://github.com/electron/chromedriver), in this case you will need to tell WebdriverIO where your Chromedriver binary is through its custom [`wdio:chromedriverOptions`](https://webdriver.io/docs/capabilities#webdriverio-capabilities-to-manage-browser-driver-options) capability.

For example, in order to use WDIO with an Electron v19 app, you will have to download Chromedriver `102.0.5005.61` from https://chromedriver.chromium.org/downloads. You should then specify the binary path in the WDIO config as follows:

_`wdio.conf.ts`_

```ts
export const config = {
  // ...
  services: ['electron'],
  capabilities: [
    {
      'browserName': 'electron',
      'wdio:chromedriverOptions': {
        binary: '/Users/wdio/Downloads/chromedriver', // path to Chromedriver you just downloaded
      },
    },
  ],
  // ...
};
```
