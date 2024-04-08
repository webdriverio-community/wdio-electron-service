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

### `appBinaryPath`:

The path to the Electron binary of the app for testing. In most cases the service will determine the path to your app automatically, but if this fails for some reason, e.g. your app is in a different repository from your tests, then it is recommended to set this value manually.

Type: `string`

### `appArgs`:

An array of string arguments to be passed through to the app on execution of the test run. Electron [command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches) and some [Chromium switches](https://peter.sh/experiments/chromium-command-line-switches) can be used here.

Type: `string[]`

### `clearMocks`:

Calls .mockClear() on all mocked APIs before each test. This will clear mock history, but not reset its implementation.

Type: `boolean`

### `resetMocks`:

Calls .mockReset() on all mocked APIs before each test. This will clear mock history and reset its implementation to an empty function (will return undefined).

Type: `boolean`

### `restoreMocks`:

Calls .mockRestore() on all mocked APIs before each test. This will restore the original API function, the mock will be removed.

Type: `boolean`
