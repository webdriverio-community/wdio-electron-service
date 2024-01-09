# WDIO Electron Service

**WebdriverIO service for testing Electron applications**

Enables cross-platform E2E testing of Electron apps via the extensive WebdriverIO ecosystem.

Spiritual successor to [Spectron](https://github.com/electron-userland/spectron) ([RIP](https://github.com/electron-userland/spectron/issues/1045)).

### Features

Using the service makes testing Electron applications much easier:

- 🚗 auto-setup of required Chromedriver
- 📦 automatic path detection of your bundled Electron application - supports [Electron Forge](https://www.electronforge.io/) and [Electron Builder](https://www.electron.build/)
- 🧩 access Electron APIs within your tests
- 🕵️ mocking of Electron APIs via a Vitest-like API

## Installation

```bash
npm install --dev wdio-electron-service
```

Or use your package manager of choice - pnpm, yarn, etc.

You will need to install `WebdriverIO`, instructions can be found [here.](https://webdriver.io/docs/gettingstarted)

## Quick Start

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

This will spin up an instance of your app in the same way that WDIO handles browsers such as Chrome or Firefox. The service works with WDIO (parallel) multiremote if you need to run additional instances simultaneously, e.g. multiple instances of your app or different combinations of your app and a Web browser.

If you use [Electron Forge](https://www.electronforge.io/) or [Electron Builder](https://www.electron.build/) to package your app then the service will automatically attempt to find the path to your bundled Electron application. You can provide a custom path to the binary via custom service capabilities, e.g.:

```ts
capabilities: [{
  browserName: 'electron',
  'wdio:electronServiceOptions': {
    appBinaryPath: './path/to/bundled/electron/app.exe',
    appArgs: ['foo', 'bar=baz'],
  },
}],
```

## Documentation

**[Configuration](./docs/configuration.md)** \
**[Electron APIs](./docs/electron-apis.md)** \
**[Common Issues](./docs/common-issues.md)**

## Example Integrations

Check out our [Electron boilerplate](https://github.com/webdriverio/electron-boilerplate) project that showcases how to integrate WebdriverIO in an example application. You can also have a look at the [Example App](./example/app/) and [E2Es](./example/e2e/) in this repository.

## Support

If you are having issues running WDIO with the service you should check the documented [Common Issues](./docs/common-issues.md) in the first instance, then open a discussion in the [main WDIO forum](https://github.com/webdriverio/webdriverio/discussions).

The Electron service discussion forum is much less active than the WDIO one, but if the issue you are experiencing is specific to Electron or using the service then you can open a discussion [here](https://github.com/webdriverio-community/wdio-electron-service/discussions).
