# WDIO Electron Service

<a href="https://www.npmjs.com/package/wdio-electron-service" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/wdio-electron-service" /></a>
<a href="https://www.npmjs.com/package/wdio-electron-service/v/lts" alt="NPM LTS Version">
  <img src="https://img.shields.io/npm/v/wdio-electron-service/lts" /></a>
<a href="https://www.npmjs.com/package/wdio-electron-service" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/wdio-electron-service" /></a>

<br />

**WebdriverIO service for testing Electron applications**

Enables cross-platform E2E testing of Electron apps via the extensive WebdriverIO ecosystem.

Spiritual successor to [Spectron](https://github.com/electron-userland/spectron) ([RIP](https://github.com/electron-userland/spectron/issues/1045)).

### Features

Makes testing Electron applications much easier via:

- 🚗 auto-setup of required Chromedriver (for Electron v26 and above)
- 📦 automatic path detection of your Electron application
  - supports [Electron Forge](https://www.electronforge.io/), [Electron Builder](https://www.electron.build/) and unpackaged apps
- 🧩 access Electron APIs within your tests
- 🕵️ mocking of Electron APIs via a Vitest-like API
- 🖥️ headless testing support
  - automatic Xvfb integration for Linux environments (requires WebdriverIO 9.19.1+)

## Installation

You will need to install `WebdriverIO`, instructions can be found [here](https://webdriver.io/docs/gettingstarted).

**Note:** WebdriverIO 9.19.1+ is required for automatic Xvfb support via the `autoXvfb` configuration option. For legacy WDIO versions, you'll need to use external tools like `xvfb-maybe` or manually set up Xvfb for headless testing on Linux. See the [Common Issues & Debugging](./docs/common-issues-debugging.md) section for more details on Xvfb setup.

## Quick Start

The recommended way to get up and running quickly is to use the [WDIO configuration wizard](https://webdriver.io/docs/gettingstarted#initiate-a-webdriverio-setup).

### Manual Quick Start

To get started without using the configuration wizard, you will need to install the service and `@wdio/cli`:

```bash
npm install --dev @wdio/cli wdio-electron-service
```

Or use your package manager of choice - pnpm, yarn, etc.

Next, create your WDIO configuration file. If you need some inspiration for this, there is a working configuration in the [example directory](./example/wdio.conf.ts) of this repository, as well as the [WDIO configuration reference page](https://webdriver.io/docs/configuration).

You will need to add `electron` to your services array and set an Electron capability, e.g.:

_`wdio.conf.ts`_

```ts
export const config = {
  // ...
  services: ["electron"],
  capabilities: [
    {
      browserName: "electron",
    },
  ],
  // ...
};
```

Finally, [run some tests](https://webdriver.io/docs/gettingstarted#run-test) using your configuration file.

This will spin up an instance of your app in the same way that WDIO handles browsers such as Chrome or Firefox. The service works with [WDIO (parallel) multiremote](https://webdriver.io/docs/multiremote) if you need to run additional instances simultaneously, e.g. multiple instances of your app or different combinations of your app and a Web browser.

If you use [Electron Forge](https://www.electronforge.io/) or [Electron Builder](https://www.electron.build/) to package your app then the service will automatically attempt to find the path to your bundled Electron application. You can provide a custom path to the binary via custom service capabilities, e.g.:

_`wdio.conf.ts`_

```ts
export const config = {
  // ...
  capabilities: [
    {
      browserName: "electron",
      "wdio:electronServiceOptions": {
        appBinaryPath: "./path/to/built/electron/app.exe",
        appArgs: ["foo", "bar=baz"],
      },
    },
  ],
  // ...
};
```

See the [configuration doc](./docs/configuration/service-configuration.md#appbinarypath) for how to find your `appBinaryPath` value for the different operating systems supported by Electron.

Alternatively, you can point the service at an unpackaged app by providing the path to the `main.js` script. Electron will need to be installed in your `node_modules`. It is recommended to bundle unpackaged apps using a bundler such as Rollup, Parcel, Webpack, etc.

_`wdio.conf.ts`_

```ts
export const config = {
  // ...
  capabilities: [
    {
      browserName: "electron",
      "wdio:electronServiceOptions": {
        appEntryPoint: "./path/to/bundled/electron/main.bundle.js",
        appArgs: ["foo", "bar=baz"],
      },
    },
  ],
  // ...
};
```

## Chromedriver Configuration

**If your app uses a version of Electron which is lower than v26 then you will need to [manually configure Chromedriver](./docs/configuration/chromedriver-configuration.md#user-managed).**

This is because WDIO uses Chrome for Testing to download Chromedriver, which only provides Chromedriver versions of v115 or newer.

## Documentation

**[Service Configuration](./docs/configuration/service-configuration.md)** \
**[Chromedriver Configuration](./docs/configuration/chromedriver-configuration.md)** \
**[Accessing Electron APIs](./docs/electron-apis/accessing-apis.md)** \
**[Mocking Electron APIs](./docs/electron-apis/mocking-apis.md)** \
**[Window Management](./docs/window-management.md)** \
**[Standalone Mode](./docs/standalone-mode.md)** \
**[Development](./docs/development.md)** \
**[Common Issues & Debugging](./docs/common-issues-debugging.md)** \
**[Migration: v8 → v9](./docs/migration/v8-to-v9.md)**

## Development

Read the [development doc](./docs/development.md) if you are interested in contributing.

## Example Integrations

Check out our [Electron boilerplate](https://github.com/webdriverio/electron-boilerplate) project that showcases how to integrate WebdriverIO in an example application. You can also have a look at the [Example Apps](./examples/) and [E2Es](./e2e/) directories in this repository.

## Support

If you are having issues running WDIO with the service you should check the documented [Common Issues](./docs/common-issues-debugging.md) in the first instance, then open a discussion in the [main WDIO forum](https://github.com/webdriverio/webdriverio/discussions).

The Electron service discussion forum is much less active than the WDIO one, but if the issue you are experiencing is specific to Electron or using the service then you can open a discussion [here](https://github.com/webdriverio-community/wdio-electron-service/discussions).
