# Service Configuration

The service can be configured by setting `wdio:electronServiceOptions` either on the service level or capability level, in which capability level configurations take precedence, e.g. the following WebdriverIO configuration:

_`wdio.conf.ts`_

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

...would result in the following configuration object:

```json
{
  "appBinaryPath": "/foo/bar/myOtherApp",
  "appArgs": ["foo", "bar"]
}
```

## Service Options

The service supports the following configuration options:

### `appArgs`:

An array of string arguments to be passed through to the app on execution of the test run. Electron [command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches) and some [Chromium switches](https://peter.sh/experiments/chromium-command-line-switches) can be used here.

Type: `string[]`

### `appBinaryPath`:

The path to the Electron binary of the app for testing. In most cases the service will determine the path to your app automatically [(check here)](#automatic-detection-of-app-binary), but if this fails for some reason, e.g. your app is in a different repository from your tests, then it is recommended to set this value manually.

If you manually set the path to the Electron binary, the path will be in different formats depending on the build tool you are using, how that tool is configured, and which OS you are building the app on.

Here are some examples of binary paths using default build configurations for a hypothetical app called `myApp` which is built in the `workspace/myApp` directory:

#### MacOS (Arm)

```ts
'/workspace/myApp/dist/mac-arm64/myApp.app/Contents/MacOS/myApp'; // Electron Builder
'/workspace/myApp/out/myApp-darwin-arm64/myApp.app/Contents/MacOS/myApp'; // Electron Forge
```

#### MacOS (Intel)

```ts
'/workspace/myApp/dist/mac-x64/myApp.app/Contents/MacOS/myApp'; // Electron Builder
'/workspace/myApp/out/myApp-darwin-x64/myApp.app/Contents/MacOS/myApp'; // Electron Forge
```

#### MacOS (Universal)

```ts
'/workspace/myApp/dist/mac-universal/myApp.app/Contents/MacOS/myApp'; // Electron Builder
'/workspace/myApp/out/myApp-darwin-universal/myApp.app/Contents/MacOS/myApp'; // Electron Forge
```

#### Linux

```ts
'/workspace/myApp/dist/linux-unpacked/myApp'; // Electron Builder
'/workspace/myApp/out/myApp-linux-x64/myApp'; // Electron Forge
```

#### Windows

```ts
'C:\\workspace\\myApp\\dist\\win-unpacked\\myApp.exe'; // Electron Builder
'C:\\workspace\\myApp\\out\\myApp-win32-x64\\myApp.exe'; // Electron Forge
```

Note:

- The above examples are just to illustrate the format of your app binary path - the actual binary path of your app depends on your configuration.
- Electron Forge uses a standardised output directory which can be represented as `out/{appName}-{OS}-{arch}`

Type: `string`

### `appEntryPoint`:

The path to the unpackaged entry point of the app for testing, e.g. your `main.js`. You will need Electron installed to use this feature. The `appEntryPoint` value overrides `appBinaryPath` if both are set.

Type: `string`

### `clearMocks`:

Calls .mockClear() on all mocked APIs before each test. This will clear mock history, but not reset its implementation.

Type: `boolean`
Default: `false`

### `resetMocks`:

Calls .mockReset() on all mocked APIs before each test. This will clear mock history and reset its implementation to an empty function (will return undefined).

Type: `boolean`
Default: `false`

### `restoreMocks`:

Calls .mockRestore() on all mocked APIs before each test. This will restore the original API function, the mock will be removed.

Type: `boolean`
Default: `false`

### `cdpBridgeTimeout`:

Timeout in milliseconds for any request using CdpBridge to the node debugger.

Type: `number`
Default: `10000` (10 seconds)

### `cdpBridgeWaitInterval`:

Interval in milliseconds to wait between attempts to connect to the node debugger.

Type: `number`
Default: `100`

### `cdpBridgeRetryCount`:

Number of attempts to connect to the node debugger before giving up.

Type: `number`
Default: `3`

### `apparmorAutoInstall`:

Control automatic installation of AppArmor profiles on Linux if needed. This helps resolve Electron startup issues on Ubuntu 24.04+ and other AppArmor-enabled Linux distributions where unprivileged user namespace restrictions prevent Electron from starting.

- `false` (default): Never install; warn and continue without AppArmor profile
- `true`: Install only if running as root (no sudo)
- `'sudo'`: Install if root or via non-interactive sudo (`sudo -n`) if available

Type: `boolean | 'sudo'`

Default: `false`

**Note:** This feature requires appropriate system permissions. When enabled, the service will attempt to create and load a custom AppArmor profile for your Electron binary if the system has AppArmor restrictions that would prevent Electron from starting.

## Automatic detection of App binary

The service will automatically determine the path to the Electron binary of your app based on the configuration of supported build tools.

If you want to manually set this value, you can specify the [`appBinaryPath`](#appbinarypath) option.

### Supported config locations:

##### Electron Builder

- `package.json` (config values are read from `build`)
- `electron-builder.{json,json5,yaml,yml,toml,js,ts,mjs,cjs,mts,cts}`
- `electron-builder.config.{json,json5,yaml,yml,toml,js,ts,mjs,cjs,mts,cts}`

##### Electron Forge

- `package.json` (config values are read from `config.forge`)
- `forge.config.js`
- `custom.config.js` (e.g. when `"config": { "forge": "./custom-config.js" }` is specified in package.json)
