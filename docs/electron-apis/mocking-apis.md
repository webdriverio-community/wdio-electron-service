# Mocking Electron APIs

The service allows for mocking of Electron API functionality via a [Vitest](https://vitest.dev/)-like interface.

## Browser Utility Methods

### `mock`

Mocks Electron API functionality when provided with an API name and function name. A [mock object](#mock-object-api) is returned.

e.g. in a spec file:

```ts
const mockedShowOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
await browser.electron.execute(
  async (electron) =>
    await electron.dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
    }),
);

expect(mockedShowOpenDialog).toHaveBeenCalledTimes(1);
expect(mockedShowOpenDialog).toHaveBeenCalledWith({
  properties: ['openFile', 'openDirectory'],
});
```

### `mockAll`

Mocks all functions on an Electron API simultaneously, the mocks are returned as an object:

```ts
const { showOpenDialog, showMessageBox } = await browser.electron.mockAll('dialog');
await showOpenDialog.mockReturnValue('I opened a dialog!');
await showMessageBox.mockReturnValue('I opened a message box!');
```

### `clearAllMocks`

Calls [`mockClear`](#mockclear) on each active mock. Passing an apiName string will clear mocks of that specific API.

### `resetAllMocks`

Calls [`mockReset`](#mockreset) on each active mock. Passing an apiName string will reset mocks of that specific API.

### `restoreAllMocks`

Calls [`mockRestore`](#mockrestore) on each active mock. Passing an apiName string will restore mocks of that specific API.

## Mock Object

Each mock object has the following methods available:

### `mockImplementation`

Accepts a function that will be used as an implementation of the mock.

```js
const mockGetName = await browser.electron.mock('app', 'getName');
let callsCount = 0;
await mockGetName.mockImplementation(() => {
  // callsCount is not accessible in the electron context so we need to guard it
  if (typeof callsCount !== 'undefined') {
    callsCount++;
  }
  return 'mocked value';
});

const result = await browser.electron.execute(async (electron) => await electron.app.getName());
expect(callsCount).toBe(1);
expect(result).toBe('mocked value');
```

### `mockImplementationOnce`

Accepts a function that will be used as mock's implementation during the next call. If chained, every consecutive call will produce differenesults.

When the mocked function runs out of implementations, it will invoke the default implementation set with [`mockImplementation`](#mockimplementation).

```js
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockImplementationOnce(() => 'first mock');
await mockGetName.mockImplementationOnce(() => 'second mock');

let name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('first mock');
name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('second mock');
name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBeNull();
```

### `mockReturnValue`

Accepts a value that will be returned whenever the mock function is called.

```js
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockReturnValue('mocked name');

const name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('mocked name');
```

### `mockReturnValueOnce`

Accepts a value that will be returned during the next function call. If chained, every consecutive call will return the specified value.

When there are no more `mockReturnValueOnce` values to use, the mock will fall back to the previously defined implementation if there is one.

```js
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockReturnValueOnce('first mock');
await mockGetName.mockReturnValueOnce('second mock');

let name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('first mock');
name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('second mock');
name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBeNull();
```

### `mockClear`

Clears the history of the mocked Electron API function. The mock implementation will not be reset.

```js
const mockGetName = await browser.electron.mock('app', 'getName');
await browser.electron.execute((electron) => electron.app.getName());

await mockGetName.mockClear();

await browser.electron.execute((electron) => electron.app.getName());
expect(mockGetName).toHaveBeenCalledTimes(1);
```

### `mockReset`

Resets the mocked Electron API function. The mock history will be cleared and the implementation will be reset to an empty function (returning undefined).

This also resets all "once" implementations.

```js
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockReturnValue('mocked name');
await browser.electron.execute((electron) => electron.app.getName());

await mockGetName.mockReset();

const name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBeUndefined();
expect(mockGetName).toHaveBeenCalledTimes(1);
```

### `mockRestore`

Restores the original implementation to the Electron API function.

```js
const appName = await browser.electron.execute((electron) => electron.app.getName());
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockReturnValue('mocked name');

await mockGetName.mockRestore();

const name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe(appName);
```
