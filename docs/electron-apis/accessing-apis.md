# Accessing Electron APIs

If you wish to access the Electron APIs then you will need to import (or require) the preload and main scripts in your app. To import 3rd-party packages (node_modules) in your `preload.js`, you have to disable sandboxing in your `BrowserWindow` config.

It is not recommended to disable sandbox mode in production; to control this behaviour you can set the `NODE_ENV` environment variable when executing WDIO:

```json
"wdio": "NODE_ENV=test wdio run wdio.conf.js"
```

In your BrowserWindow configuration, set the sandbox option depending on the NODE_ENV variable:

```ts
const isTest = process.env.NODE_ENV === 'test';

new BrowserWindow({
  webPreferences: {
    sandbox: !isTest
    preload: path.join(__dirname, 'preload.js'),
  }
  // ...
});
```

Then somewhere near the top of your `preload.js`, load `wdio-electron-service/preload` conditionally, e.g.:

```ts
if (process.env.NODE_ENV === 'test') {
  import('wdio-electron-service/preload');
}
```

And somewhere near the top of your main index file (app entry point), load `wdio-electron-service/main` conditionally, e.g.:

```ts
if (process.env.NODE_ENV === 'test') {
  import('wdio-electron-service/main');
}
```

For security reasons it is encouraged to use dynamic imports wrapped in conditionals to ensure electron main process access is only available when the app is being tested.

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
