# Accessing Electron APIs

The service provides access to Electron APIs from the main process using the Chrome DevTools Protocol (CDP). You can access these APIs by using the `browser.electron.execute` method in your test suites.

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

## How It Works

The service uses the Chrome DevTools Protocol (CDP) to communicate with your Electron application's main process. This provides a reliable and efficient way to:

- Execute JavaScript code in the main process context
- Access all Electron APIs
- Mock Electron APIs for testing
- Handle multiple windows and processes

No additional setup or imports are required in your Electron application - the service automatically connects to your app when it starts.
