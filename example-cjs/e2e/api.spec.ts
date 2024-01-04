import { Mock } from '@vitest/spy';
import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

const { name: pkgAppName, version: pkgAppVersion } = globalThis.packageJson;

describe('mock', () => {
  it('should mock an electron API function', async () => {
    const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
    await browser.electron.execute(async (electron) => {
      await electron.dialog.showOpenDialog({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      });
      return (electron.dialog.showOpenDialog as Mock).mock.calls;
    });

    expect(showOpenDialog).toHaveBeenCalledTimes(1);
    expect(showOpenDialog).toHaveBeenCalledWith({
      title: 'my dialog',
      properties: ['openFile', 'openDirectory'],
    });
  });

  it('should mock a synchronous electron API function', async () => {
    const showOpenDialogSync = await browser.electron.mock('dialog', 'showOpenDialogSync');
    await browser.electron.execute((electron) =>
      electron.dialog.showOpenDialogSync({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      }),
    );

    expect(showOpenDialogSync).toHaveBeenCalledTimes(1);
    expect(showOpenDialogSync).toHaveBeenCalledWith({
      title: 'my dialog',
      properties: ['openFile', 'openDirectory'],
    });
  });

  describe('mockImplementation', () => {
    it('should use the specified implementation for an existing mock', async () => {
      const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
      let callsCount = 0;
      await showOpenDialog.mockImplementation(() => callsCount++);
      await browser.electron.execute(
        async (electron) =>
          await electron.dialog.showOpenDialog({
            title: 'my dialog',
            properties: ['openFile', 'openDirectory'],
          }),
      );

      expect(showOpenDialog).toHaveBeenCalledTimes(1);
      expect(showOpenDialog).toHaveBeenCalledWith({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      });
      expect(callsCount).toBe(1);
    });
  });

  describe('mockImplementationOnce', () => {
    it('should use the specified implementation for an existing mock once', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');
      let callsCount = 0;

      await mockGetName.mockImplementationOnce(() => callsCount++);

      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(null);

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(pkgAppName);

      expect(mockGetName).toHaveBeenCalledTimes(1);
      expect(callsCount).toBe(1);
    });
  });

  describe('mockReturnValue', () => {
    it('should return the expected value from the mock API', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');
      await mockGetName.mockReturnValue('This is a mock');

      const electronName = await browser.electron.execute((electron) => electron.app.getName());

      expect(electronName).toBe('This is a mock');
    });
  });

  describe('mockReturnValueOnce', () => {
    it('should return the expected value from the mock API once', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');

      await mockGetName.mockReturnValueOnce('This is a mock');

      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('This is a mock');

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(pkgAppName);
    });
  });

  describe('mockRestore', () => {
    it('should restore an existing mock', async () => {
      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(pkgAppName);

      const mockGetName = await browser.electron.mock('app', 'getName');
      await mockGetName.mockReturnValue('mocked name');

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('mocked name');

      await mockGetName.mockRestore();

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(pkgAppName);
    });
  });

  describe('mockClear', () => {
    it('should clear an existing mock', async () => {
      const mockShowOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
      await mockShowOpenDialog.mockReturnValue('mocked name');

      await browser.electron.execute((electron) => electron.dialog.showOpenDialog({}));
      await browser.electron.execute((electron) =>
        electron.dialog.showOpenDialog({
          title: 'my dialog',
        }),
      );
      await browser.electron.execute((electron) =>
        electron.dialog.showOpenDialog({
          title: 'another dialog',
        }),
      );

      expect(mockShowOpenDialog.mock.calls).toStrictEqual([
        [{}],
        [
          {
            title: 'my dialog',
          },
        ],
        [
          {
            title: 'another dialog',
          },
        ],
      ]);

      expect(mockShowOpenDialog.mock.instances).toStrictEqual([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(mockShowOpenDialog.mock.invocationCallOrder).toStrictEqual([
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      ]);
      expect(mockShowOpenDialog.mock.lastCall).toStrictEqual([
        {
          title: 'another dialog',
        },
      ]);
      expect(mockShowOpenDialog.mock.results).toStrictEqual([
        { type: 'return', value: undefined },
        { type: 'return', value: undefined },
        { type: 'return', value: undefined },
      ]);

      await mockShowOpenDialog.mockClear();

      expect(mockShowOpenDialog.mock.calls).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.instances).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.invocationCallOrder).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.lastCall).toBeUndefined();
      expect(mockShowOpenDialog.mock.results).toStrictEqual([]);
    });
  });

  describe('mockReset', () => {
    it('should clear an existing mock', async () => {
      const mockShowOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
      await mockShowOpenDialog.mockReturnValue('mocked name');

      await browser.electron.execute((electron) => electron.dialog.showOpenDialog({}));
      await browser.electron.execute((electron) =>
        electron.dialog.showOpenDialog({
          title: 'my dialog',
        }),
      );
      await browser.electron.execute((electron) =>
        electron.dialog.showOpenDialog({
          title: 'another dialog',
        }),
      );

      expect(mockShowOpenDialog.mock.calls).toStrictEqual([
        [{}],
        [
          {
            title: 'my dialog',
          },
        ],
        [
          {
            title: 'another dialog',
          },
        ],
      ]);

      expect(mockShowOpenDialog.mock.instances).toStrictEqual([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(mockShowOpenDialog.mock.invocationCallOrder).toStrictEqual([
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      ]);
      expect(mockShowOpenDialog.mock.lastCall).toStrictEqual([
        {
          title: 'another dialog',
        },
      ]);
      expect(mockShowOpenDialog.mock.results).toStrictEqual([
        { type: 'return', value: undefined },
        { type: 'return', value: undefined },
        { type: 'return', value: undefined },
      ]);

      await mockShowOpenDialog.mockReset();

      expect(mockShowOpenDialog.mock.calls).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.instances).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.invocationCallOrder).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.lastCall).toBeUndefined();
      expect(mockShowOpenDialog.mock.results).toStrictEqual([]);
    });

    it('should reset an existing mock', async () => {
      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(pkgAppName);

      const mockGetName = await browser.electron.mock('app', 'getName');
      await mockGetName.mockReturnValue('mocked name');

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('mocked name');

      await mockGetName.mockReset();

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(null);
    });
  });

  describe('mockAll', () => {
    it('should mock all functions on an API', async () => {
      const mockedDialog = await browser.electron.mockAll('dialog');
      await browser.electron.execute(
        async (electron) =>
          await electron.dialog.showOpenDialog({
            title: 'my dialog',
          }),
      );
      await browser.electron.execute((electron) =>
        electron.dialog.showOpenDialogSync({
          title: 'my dialog',
        }),
      );

      expect(mockedDialog.showOpenDialog).toHaveBeenCalledTimes(1);
      expect(mockedDialog.showOpenDialog).toHaveBeenCalledWith({
        title: 'my dialog',
      });
      expect(mockedDialog.showOpenDialogSync).toHaveBeenCalledTimes(1);
      expect(mockedDialog.showOpenDialogSync).toHaveBeenCalledWith({
        title: 'my dialog',
      });
    });
  });
});

describe('resetAllMocks', () => {
  it('should clear existing mocks', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.execute((electron) => electron.app.getName());
    await browser.electron.execute((electron) => electron.clipboard.readText());

    await browser.electron.resetAllMocks();

    expect(mockGetName.mock.calls).toStrictEqual([]);
    expect(mockGetName.mock.instances).toStrictEqual([]);
    expect(mockGetName.mock.invocationCallOrder).toStrictEqual([]);
    expect(mockGetName.mock.lastCall).toBeUndefined();
    expect(mockGetName.mock.results).toStrictEqual([]);

    expect(mockReadText.mock.calls).toStrictEqual([]);
    expect(mockReadText.mock.instances).toStrictEqual([]);
    expect(mockReadText.mock.invocationCallOrder).toStrictEqual([]);
    expect(mockReadText.mock.lastCall).toBeUndefined();
    expect(mockReadText.mock.results).toStrictEqual([]);
  });

  it('should clear existing mocks on an API', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.execute((electron) => electron.app.getName());
    await browser.electron.execute((electron) => electron.clipboard.readText());

    await browser.electron.resetAllMocks('app');

    expect(mockGetName.mock.calls).toStrictEqual([]);
    expect(mockGetName.mock.instances).toStrictEqual([]);
    expect(mockGetName.mock.invocationCallOrder).toStrictEqual([]);
    expect(mockGetName.mock.lastCall).toBeUndefined();
    expect(mockGetName.mock.results).toStrictEqual([]);

    expect(mockReadText.mock.calls).toStrictEqual([[]]);
    expect(mockReadText.mock.instances).toStrictEqual([expect.any(Function)]);
    expect(mockReadText.mock.invocationCallOrder).toStrictEqual([expect.any(Number)]);
    expect(mockReadText.mock.lastCall).toStrictEqual([]);
    expect(mockReadText.mock.results).toStrictEqual([{ type: 'return', value: undefined }]);
  });

  it('should reset existing mocks', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.resetAllMocks();

    const appName = await browser.electron.execute((electron) => electron.app.getName());
    const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
    expect(appName).toBe(null);
    expect(clipboardText).toBe(null);
  });

  it('should reset existing mocks on an API', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.resetAllMocks('app');

    const appName = await browser.electron.execute((electron) => electron.app.getName());
    const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
    expect(appName).toBe(null);
    expect(clipboardText).toBe('mocked clipboardText');
  });
});

describe('execute', () => {
  it('should execute an arbitrary function in the main process', async () => {
    expect(
      await browser.electron.execute(
        (electron, a, b, c) => {
          const version = electron.app.getVersion();
          return [version, a + b + c];
        },
        1,
        2,
        3,
      ),
    ).toEqual([pkgAppVersion, 6]);
  });

  it('should execute a string-based function in the main process', async () => {
    expect(await browser.electron.execute('return 1 + 2 + 3')).toBe(6);
  });
});
