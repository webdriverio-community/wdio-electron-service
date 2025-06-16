# Accessing Electron APIs

This service provides access to the main process of Electron.
You can do this simply using `browser.electron.execute` method at test suites.

## Importing main and preload scripts provided by this service

If you are using an older version of the service, you will have imported the following scripts in your apps before testing.

- `wdio-electron-service/main` (in the main script)
- `wdio-electron-service/preload` (in the preload script)

You can now remove these imports because the IPC bridge is now deprecated.

The `wdio-electron-service/main` and `wdio-electron-service/preload` scripts will be completely removed in `wdio-electron-service@v9`.

## Execute Scripts

Arbitrary scripts can be executed within the context of your Electron application main process using `browser.electron.execute(...)`. This allows Electron APIs to be accessed in a fluid way, in case you wish to manipulate your application at runtime or trigger certain events.

For example, a message modal can be triggered from a test via:

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

...which results in the application displaying the following alert:

![Execute Demo](../../.github/assets/execute-demo.png 'Execute Demo')

**Note:** The first argument of the function will be always the default export of the `electron` package that contains the [Electron API](https://www.electronjs.org/docs/latest/api/app).
