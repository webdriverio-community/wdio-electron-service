## Mocking Electron APIs

You can mock Electron API functionality by calling the mock function with the API name and function name. e.g. in a spec file:

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

You can also pass a mockReturnValue, or set it after defining your mock:

```ts
const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog', 'I opened a dialog!');
```

```ts
const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
await showOpenDialog.mockReturnValue('I opened a dialog!');
```

Which results in the following:

```ts
const result = await browser.electron.execute(async (electron) => await electron.dialog.showOpenDialog());
expect(result).toBe('I opened a dialog!');
```

You can mock all functions from an API using `mockAll`, the mocks are returned as an object:

```ts
const dialog = await browser.electron.mockAll('dialog');
await dialog.showOpenDialog.mockReturnValue('I opened a dialog!');
await dialog.showMessageBox.mockReturnValue('I opened a message box!');
```

Mocks can be removed by calling `removeMocks`, or directly by calling `unMock` on the mock itself:

```ts
// removes all mocked functions
await browser.electron.removeMocks();
// removes all mocked functions from the dialog API
await browser.electron.removeMocks('dialog');
// removes the showOpenDialog mock from the dialog API
const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
await showOpenDialog.unMock();
```
