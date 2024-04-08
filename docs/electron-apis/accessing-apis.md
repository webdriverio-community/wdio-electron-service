# Accessing Electron APIs

If you wish to access the Electron APIs then you will need to import (or require) the preload and main scripts in your app.

Somewhere near the top of your preload script, load `wdio-electron-service/preload` conditionally, e.g.:

_`preload/index.ts`_

```ts
if (process.env.TEST === 'true') {
  import('wdio-electron-service/preload');
}
```

And somewhere near the top of your main index file (app entry point), load `wdio-electron-service/main` conditionally, e.g.:

_`main/index.ts`_

```ts
if (process.env.TEST === 'true') {
  import('wdio-electron-service/main');
}
```

**_For security reasons it is encouraged to ensure electron main process access is only available when the app is being tested._**

This is the reason for the above dynamic imports wrapped in conditionals. You will need to specify the TEST environment variable at the top of your WDIO config file:

_`wdio.conf.ts`_

```ts
// ...
process.env.TEST = 'true';
// ...
```

An alternative approach is to use a separate test index file for both your preload and main entry points, e.g.

_`main/index.test.ts`_

```ts
import('wdio-electron-service/main');
import('./index.js');
```

_`preload/index.test.ts`_

```ts
import('wdio-electron-service/preload');
import('./index.js');
```

You can then switch the test and production entry points of the application depending on the presence of the TEST environment variable.

e.g. for a Vite-based application:

_`vite.config.ts`_

```ts
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const isTest = process.env.TEST === 'true';

  return {
    main: {
      // ...
      entry: { main: isTest ? 'src/main/index.test.ts' : 'src/main/index.ts' },
      // ...
    },
    preload: {
      // ...
      entry: { preload: isTest ? 'src/preload/index.test.ts' : 'src/preload/index.ts' },
      // ...
    },
  };
});
```

### Additional steps for non-bundled preload scripts

If you are not bundling your preload script you will be unable to import 3rd-party packages (node_modules) in your `preload.js`. In this case you have to ensure sandboxing is disabled in your `BrowserWindow` config.

It is not recommended to disable sandbox mode in production; to control this behaviour you can set the `NODE_ENV` environment variable when executing WDIO:

_`package.json`_

```json
// ...
"scripts": {
  // ...
  "wdio": "TEST=true wdio run wdio.conf.js",
  // ...
}
// ...
```

In your BrowserWindow configuration, set the sandbox option depending on the TEST variable:

_`main/index.ts`_

```ts
const isTest = process.env.TEST === 'true';

new BrowserWindow({
  webPreferences: {
    sandbox: !isTest
    preload: path.join(__dirname, 'preload.js'),
  }
  // ...
});
```

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
