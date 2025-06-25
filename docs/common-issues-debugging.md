## Common Issues & Debugging

These are some common issues which others have encountered whilst using the service.

If you need extra insight into what the service is doing you can set the environment var `DEBUG=wdio-electron-service` to enable debug logging, e.g.

```bash
$ DEBUG=wdio-electron-service wdio run ./wdio.conf.ts
```

This is utilising the [`debug`](https://github.com/debug-js/debug) logging package.

### DevToolsActivePort file doesn't exist

This is a Chromium error which may appear when using Docker or CI. Most of the "fixes" discussed online are based around passing different combinations of args to Chromium - you can set these via [`appArgs`](./configuration/service-configuration.md#appargs-string), though in most cases using xvfb has proven to be more effective; the service itself uses xvfb when running E2Es on Linux CI.

See this [discussion](https://github.com/webdriverio-community/wdio-electron-service/discussions/60) for more details.

### All versions of Electron fail to open on Ubuntu 24.04+

See [this issue](https://github.com/electron/electron/issues/41066) for more details. The solution is to set the `appArgs` capability to include `--no-sandbox`.

Since it is useful for this and other issues, the service automatically adds `--no-sandbox` to the `appArgs` whenever a custom `appArgs` is not provided. If you need to override this, you can do so by setting the `appArgs` capability to an empty array.

Another workaround is to run `sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` before running your tests.
This command requires root privileges; if necessary, run it as the root user or use the `sudo` command.
