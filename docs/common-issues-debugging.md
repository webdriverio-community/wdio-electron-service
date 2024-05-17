## Common Issues & Debugging

These are some common issues which others have encountered whilst using the service.

If you need extra insight into what the service is doing you can set the environment var `DEBUG=wdio-electron-service` to enable debug logging. This is utilising the [`debug`](https://github.com/debug-js/debug) logging package.

### Error: ContextBridge not available for invocation of "app" API

When using Electron Forge or Electron Packager with Asar, it is possible that the `wdio-electron-service` module is not included in your generated app.asar.
You can solve this, by either running the packager with the `prune: false` option or the `--no-prune` flag, or by moving "wdio-electron-service" from `devDependencies` to `dependencies`.
It is recommend to do the former, for instance by passing an environment variable to the packager:

#### Electron Packager

```bash
$ npx electron-packager --no-prune
```

#### Electron Forge

_`package.json`_

```json
{
  // ...
  "scripts": {
    // ...
    "package": "TEST=true electron-forge package"
    // ...
  }
  // ...
}
```

_`forge.config.js`_

```ts
module.exports = {
  // ...
  packagerConfig: {
    asar: true,
    prune: process.env.TEST !== 'true',
  },
  // ...
};
```

### DevToolsActivePort file doesn't exist

This is a Chromium error which may appear when using Docker or CI. Most of the "fixes" discussed online are based around passing different combinations of args to Chromium - you can set these via [`appArgs`](./configuration/service-configuration.md#appargs-string), though in most cases using xvfb has proven to be more effective; the service itself uses a [github action](https://github.com/coactions/setup-xvfb) to achieve this when running E2Es on CI.

See this [discussion](https://github.com/webdriverio-community/wdio-electron-service/discussions/60) for more details.
