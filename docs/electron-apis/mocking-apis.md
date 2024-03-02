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

Calls [`mockClear`](#mockclear) on each active mock:

```js
const mockSetName = await browser.electron.mock('app', 'setName');
const mockWriteText = await browser.electron.mock('clipboard', 'writeText');

await browser.electron.execute((electron) => electron.app.setName('new app name'));
await browser.electron.execute((electron) => electron.clipboard.writeText('text to be written'));

await browser.electron.clearAllMocks();

expect(mockSetName.mock.calls).toStrictEqual([]);
expect(mockWriteText.mock.calls).toStrictEqual([]);
```

Passing an apiName string will clear mocks of that specific API:

```js
const mockSetName = await browser.electron.mock('app', 'setName');
const mockWriteText = await browser.electron.mock('clipboard', 'writeText');

await browser.electron.execute((electron) => electron.app.setName('new app name'));
await browser.electron.execute((electron) => electron.clipboard.writeText('text to be written'));

await browser.electron.clearAllMocks('app');

expect(mockSetName.mock.calls).toStrictEqual([]);
expect(mockWriteText.mock.calls).toStrictEqual([['text to be written']]);
```

### `resetAllMocks`

Calls [`mockReset`](#mockreset) on each active mock:

```js
const mockGetName = await browser.electron.mock('app', 'getName');
const mockReadText = await browser.electron.mock('clipboard', 'readText');
await mockGetName.mockReturnValue('mocked appName');
await mockReadText.mockReturnValue('mocked clipboardText');

await browser.electron.resetAllMocks();

const appName = await browser.electron.execute((electron) => electron.app.getName());
const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
expect(appName).toBeUndefined();
expect(clipboardText).toBeUndefined();
```

Passing an apiName string will reset mocks of that specific API:

```js
const mockGetName = await browser.electron.mock('app', 'getName');
const mockReadText = await browser.electron.mock('clipboard', 'readText');
await mockGetName.mockReturnValue('mocked appName');
await mockReadText.mockReturnValue('mocked clipboardText');

await browser.electron.resetAllMocks('app');

const appName = await browser.electron.execute((electron) => electron.app.getName());
const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
expect(appName).toBeUndefined();
expect(clipboardText).toBe('mocked clipboardText');
```

### `restoreAllMocks`

Calls [`mockRestore`](#mockrestore) on each active mock:

```js
const mockGetName = await browser.electron.mock('app', 'getName');
const mockReadText = await browser.electron.mock('clipboard', 'readText');
await mockGetName.mockReturnValue('mocked appName');
await mockReadText.mockReturnValue('mocked clipboardText');

await browser.electron.restoreAllMocks();

const appName = await browser.electron.execute((electron) => electron.app.getName());
const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
expect(appName).toBe('my real app name');
expect(clipboardText).toBe('some real clipboard text');
```

Passing an apiName string will restore mocks of that specific API:

```js
const mockGetName = await browser.electron.mock('app', 'getName');
const mockReadText = await browser.electron.mock('clipboard', 'readText');
await mockGetName.mockReturnValue('mocked appName');
await mockReadText.mockReturnValue('mocked clipboardText');

await browser.electron.restoreAllMocks('app');

const appName = await browser.electron.execute((electron) => electron.app.getName());
const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
expect(appName).toBe('my real app name');
expect(clipboardText).toBe('mocked clipboardText');
```

### `isMockFunction`

Checks that a given parameter is an Electron mock function. If you are using TypeScript, it will also narrow down its type.

```js
const mockGetName = await browser.electron.mock('app', 'getName');

expect(browser.electron.isMockFunction(mockGetName)).toBe(true);
```

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

Accepts a function that will be used as mock's implementation during the next call. If chained, every consecutive call will produce different results.

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

### `mockResolvedValue`

Accepts a value that will be resolved whenever the mock function is called.

```js
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
await mockGetFileIcon.mockResolvedValue('This is a mock');

const fileIcon = await browser.electron.execute(async (electron) => await electron.app.getFileIcon('/path/to/icon'));

expect(fileIcon).toBe('This is a mock');
```

### `mockResolvedValueOnce`

Accepts a value that will be resolved during the next function call. If chained, every consecutive call will resolve the specified value.

When there are no more `mockResolvedValueOnce` values to use, the mock will fall back to the previously defined implementation if there is one.

```js
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');

await mockGetFileIcon.mockResolvedValue('default mocked icon');
await mockGetFileIcon.mockResolvedValueOnce('first mocked icon');
await mockGetFileIcon.mockResolvedValueOnce('second mocked icon');

let fileIcon = await browser.electron.execute(async (electron) => await electron.app.getFileIcon('/path/to/icon'));
expect(fileIcon).toBe('first mocked icon');
fileIcon = await browser.electron.execute(async (electron) => await electron.app.getFileIcon('/path/to/icon'));
expect(fileIcon).toBe('second mocked icon');
fileIcon = await browser.electron.execute(async (electron) => await electron.app.getFileIcon('/path/to/icon'));
expect(fileIcon).toBe('default mocked icon');
```

### `mockRejectedValue`

Accepts a value that will be rejected whenever the mock function is called.

```js
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
await mockGetFileIcon.mockRejectedValue('This is a mock error');

const fileIconError = await browser.electron.execute(async (electron) => {
  try {
    await electron.app.getFileIcon('/path/to/icon');
  } catch (e) {
    return e;
  }
});

expect(fileIconError).toBe('This is a mock error');
```

### `mockRejectedValueOnce`

Accepts a value that will be rejected during the next function call. If chained, every consecutive call will reject the specified value.

When there are no more `mockRejectedValueOnce` values to use, the mock will fall back to the previously defined implementation if there is one.

```js
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');

await mockGetFileIcon.mockRejectedValue('default mocked icon error');
await mockGetFileIcon.mockRejectedValueOnce('first mocked icon error');
await mockGetFileIcon.mockRejectedValueOnce('second mocked icon error');

const getFileIcon = async () =>
  await browser.electron.execute(async (electron) => {
    try {
      await electron.app.getFileIcon('/path/to/icon');
    } catch (e) {
      return e;
    }
  });

let fileIcon = await getFileIcon();
expect(fileIcon).toBe('first mocked icon error');
fileIcon = await getFileIcon();
expect(fileIcon).toBe('second mocked icon error');
fileIcon = await getFileIcon();
expect(fileIcon).toBe('default mocked icon error');
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

### `withImplementation`

Overrides the original mock implementation temporarily while the callback is being executed.
The electron object is passed into the callback in the same way as for `execute`.

```js
const mockGetName = await browser.electron.mock('app', 'getName');
const withImplementationResult = await mockGetName.withImplementation(
  () => 'temporary mock name',
  (electron) => electron.app.getName(),
);

expect(withImplementationResult).toBe('temporary mock name');
```

It can also be used with an asynchronous callback:

```js
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
const withImplementationResult = await mockGetFileIcon.withImplementation(
  () => Promise.resolve('temporary mock icon'),
  async (electron) => await electron.app.getFileIcon('/path/to/icon'),
);

expect(withImplementationResult).toBe('temporary mock icon');
```

### `getMockImplementation`

Returns the current mock implementation if there is one.

```js
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockImplementation(() => 'mocked name');
const mockImpl = mockGetName.getMockImplementation();

expect(mockImpl()).toBe('mocked name');
```

### `getMockName`

Returns the assigned name of the mock. Defaults to `electron.<apiName>.<funcName>`.

```js
const mockGetName = await browser.electron.mock('app', 'getName');

expect(mockGetName.getMockName()).toBe('electron.app.getName');
```

### `mockName`

Assigns a name to the mock. The name can be retrieved via [`getMockName`](#getmockname).

```js
const mockGetName = await browser.electron.mock('app', 'getName');

mockGetName.mockName('test mock');

expect(mockGetName.getMockName()).toBe('test mock');
```

### `mockReturnThis`

Useful if you need to return the `this` context from the method without invoking implementation. This is a shorthand for:

```js
await spy.mockImplementation(function () {
  return this;
});
```

...which enables API functions to be chained:

```js
const mockGetName = await browser.electron.mock('app', 'getName');
const mockGetVersion = await browser.electron.mock('app', 'getVersion');
await mockGetName.mockReturnThis();
await browser.electron.execute((electron) => electron.app.getName().getVersion());

expect(mockGetVersion).toHaveBeenCalled();
```

### `mock.calls`

This is an array containing all arguments for each call. Each item of the array is the arguments of that call.

```js
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');

await browser.electron.execute((electron) => electron.app.getFileIcon('/path/to/icon'));
await browser.electron.execute((electron) => electron.app.getFileIcon('/path/to/another/icon', { size: 'small' }));

expect(mockGetFileIcon.mock.calls).toStrictEqual([
  ['/path/to/icon'], // first call
  ['/path/to/another/icon', { size: 'small' }], // second call
]);
```

### `mock.lastCall`

This contains the arguments of the last call. If the mock wasn't called, it will return `undefined`.

```js
const mockSetName = await browser.electron.mock('app', 'setName');

await browser.electron.execute((electron) => electron.app.setName('test'));
expect(mockSetName.mock.lastCall).toStrictEqual(['test']);
await browser.electron.execute((electron) => electron.app.setName('test 2'));
expect(mockSetName.mock.lastCall).toStrictEqual(['test 2']);
await browser.electron.execute((electron) => electron.app.setName('test 3'));
expect(mockSetName.mock.lastCall).toStrictEqual(['test 3']);
```

### `mock.results`

This is an array containing all values that were returned from the mock. Each item of the array is an object with the properties type and value. Available types are:

    'return' - the mock returned without throwing.
    'throw' - the mock threw a value.

The value property contains the returned value or the thrown error. If the mock returned a promise, the value will be the resolved value, not the Promise itself, unless it was never resolved.

```js
const mockGetName = await browser.electron.mock('app', 'getName');

await mockGetName.mockImplementationOnce(() => 'result');
await mockGetName.mockImplementation(() => {
  throw new Error('thrown error');
});

await expect(browser.electron.execute((electron) => electron.app.getName())).resolves.toBe('result');
await expect(browser.electron.execute((electron) => electron.app.getName())).rejects.toThrow('thrown error');

expect(mockGetName.mock.results).toStrictEqual([
  {
    type: 'return',
    value: 'result',
  },
  {
    type: 'throw',
    value: new Error('thrown error'),
  },
]);
```

### `mock.invocationCallOrder`

The order of mock invocation. This returns an array of numbers that are shared between all defined mocks. Will return an empty array if the mock was never invoked.

```js
const mockGetName = await browser.electron.mock('app', 'getName');
const mockGetVersion = await browser.electron.mock('app', 'getVersion');

await browser.electron.execute((electron) => electron.app.getName());
await browser.electron.execute((electron) => electron.app.getVersion());
await browser.electron.execute((electron) => electron.app.getName());

expect(mockGetName.mock.invocationCallOrder).toStrictEqual([1, 3]);
expect(mockGetVersion.mock.invocationCallOrder).toStrictEqual([2]);
```
