## Common Issues & Debugging

These are some common issues which others have encountered whilst using the service.

If you need extra insight into what the service is doing you can enable namespaced debug logging via the `DEBUG` environment variable.

- `DEBUG=wdio-electron-service` is equivalent to `DEBUG=wdio-electron-service:*` (enable all service namespaces)
- You can target specific areas, e.g. `DEBUG=wdio-electron-service:service,mock`

Examples:

```bash
# enable all service logs
DEBUG=wdio-electron-service:* wdio run ./wdio.conf.ts

# enable only core service + mocks
DEBUG=wdio-electron-service:service,mock wdio run ./wdio.conf.ts
```

Logs are also forwarded into WDIO runner logs under your configured `outputDir`.

This is utilising the [`debug`](https://github.com/debug-js/debug) logging package.

### DevToolsActivePort file doesn't exist

This is a Chromium error which may appear when using Docker or CI. Most of the "fixes" discussed online are based around passing different combinations of args to Chromium - you can set these via [`appArgs`](./configuration/service-configuration.md#appargs-string), though in most cases using xvfb has proven to be more effective; the service itself uses xvfb when running E2Es on Linux CI.

See this [WDIO documentation page](https://webdriver.io/docs/headless-and-xvfb) for instructions on how to set up xvfb.

### Failed to create session. session not created: probably user data directory is already in use, please specify a unique value for --user-data-dir argument, or don't use --user-data-dir

This is another obscure Chromium error which, despite the message, is usually not fixed by providing a unique `--user-data-dir` value.  In the Electron context this usually occurs when the Electron app crashes during or shortly after initialization.  WDIO / ChromeDriver attempts to reconnect, starting a new electron instance, which attempts to use the same user-data-dir path.  Whilst there may be other causes, on Linux this is often fixed with xvfb.

See this [WDIO documentation page](https://webdriver.io/docs/headless-and-xvfb) for instructions on how to set up xvfb.

### All versions of Electron fail to open on Ubuntu 24.04+

See [this issue](https://github.com/electron/electron/issues/41066) for more details. The solution is to set the `appArgs` capability to include `--no-sandbox`.

Since it is useful for this and other issues, the service automatically adds `--no-sandbox` to the `appArgs` whenever a custom `appArgs` is not provided. If you need to override this, you can do so by setting the `appArgs` capability to an empty array.

Another workaround is to run `sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` before running your tests.
This command requires root privileges; if necessary, run it as the root user or use the `sudo` command.
