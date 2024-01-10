import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';
import type { Mock } from '@vitest/spy';

const { name: pkgAppName, version: pkgAppVersion } = globalThis.packageJson;

describe('mock', () => {
  it('should mock an electron API function', async () => {
    const mockShowOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
    await browser.electron.execute(async (electron) => {
      await electron.dialog.showOpenDialog({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      });
      return (electron.dialog.showOpenDialog as Mock).mock.calls;
    });

    expect(mockShowOpenDialog).toHaveBeenCalledTimes(1);
    expect(mockShowOpenDialog).toHaveBeenCalledWith({
      title: 'my dialog',
      properties: ['openFile', 'openDirectory'],
    });
  });

  it('should mock a synchronous electron API function', async () => {
    const mockShowOpenDialogSync = await browser.electron.mock('dialog', 'showOpenDialogSync');
    await browser.electron.execute((electron) =>
      electron.dialog.showOpenDialogSync({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      }),
    );

    expect(mockShowOpenDialogSync).toHaveBeenCalledTimes(1);
    expect(mockShowOpenDialogSync).toHaveBeenCalledWith({
      title: 'my dialog',
      properties: ['openFile', 'openDirectory'],
    });
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

describe('clearAllMocks', () => {
  it('should clear existing mocks', async () => {
    const mockSetName = await browser.electron.mock('app', 'setName');
    const mockWriteText = await browser.electron.mock('clipboard', 'writeText');

    await browser.electron.execute((electron) => electron.app.setName('new app name'));
    await browser.electron.execute((electron) => electron.clipboard.writeText('text to be written'));

    await browser.electron.clearAllMocks();

    expect(mockSetName.mock.calls).toStrictEqual([]);
    expect(mockSetName.mock.instances).toStrictEqual([]);
    expect(mockSetName.mock.invocationCallOrder).toStrictEqual([]);
    expect(mockSetName.mock.lastCall).toBeUndefined();
    expect(mockSetName.mock.results).toStrictEqual([]);

    expect(mockWriteText.mock.calls).toStrictEqual([]);
    expect(mockWriteText.mock.instances).toStrictEqual([]);
    expect(mockWriteText.mock.invocationCallOrder).toStrictEqual([]);
    expect(mockWriteText.mock.lastCall).toBeUndefined();
    expect(mockWriteText.mock.results).toStrictEqual([]);
  });

  it('should clear existing mocks on an API', async () => {
    const mockSetName = await browser.electron.mock('app', 'setName');
    const mockWriteText = await browser.electron.mock('clipboard', 'writeText');

    await browser.electron.execute((electron) => electron.app.setName('new app name'));
    await browser.electron.execute((electron) => electron.clipboard.writeText('text to be written'));

    await browser.electron.clearAllMocks('app');

    expect(mockSetName.mock.calls).toStrictEqual([]);
    expect(mockSetName.mock.instances).toStrictEqual([]);
    expect(mockSetName.mock.invocationCallOrder).toStrictEqual([]);
    expect(mockSetName.mock.lastCall).toBeUndefined();
    expect(mockSetName.mock.results).toStrictEqual([]);

    expect(mockWriteText.mock.calls).toStrictEqual([['text to be written']]);
    expect(mockWriteText.mock.instances).toStrictEqual([expect.any(Function)]);
    expect(mockWriteText.mock.invocationCallOrder).toStrictEqual([expect.any(Number)]);
    expect(mockWriteText.mock.lastCall).toStrictEqual(['text to be written']);
    expect(mockWriteText.mock.results).toStrictEqual([{ type: 'return', value: undefined }]);
  });

  it('should not reset existing mocks', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.clearAllMocks();

    const appName = await browser.electron.execute((electron) => electron.app.getName());
    const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
    expect(appName).toBe('mocked appName');
    expect(clipboardText).toBe('mocked clipboardText');
  });

  it('should not reset existing mocks on an API', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.clearAllMocks('app');

    const appName = await browser.electron.execute((electron) => electron.app.getName());
    const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
    expect(appName).toBe('mocked appName');
    expect(clipboardText).toBe('mocked clipboardText');
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
    const mockSetName = await browser.electron.mock('app', 'setName');
    const mockWriteText = await browser.electron.mock('clipboard', 'writeText');

    await browser.electron.execute((electron) => electron.app.setName('new app name'));
    await browser.electron.execute((electron) => electron.clipboard.writeText('text to be written'));

    await browser.electron.resetAllMocks('app');

    expect(mockSetName.mock.calls).toStrictEqual([]);
    expect(mockSetName.mock.instances).toStrictEqual([]);
    expect(mockSetName.mock.invocationCallOrder).toStrictEqual([]);
    expect(mockSetName.mock.lastCall).toBeUndefined();
    expect(mockSetName.mock.results).toStrictEqual([]);

    expect(mockWriteText.mock.calls).toStrictEqual([['text to be written']]);
    expect(mockWriteText.mock.instances).toStrictEqual([expect.any(Function)]);
    expect(mockWriteText.mock.invocationCallOrder).toStrictEqual([expect.any(Number)]);
    expect(mockWriteText.mock.lastCall).toStrictEqual(['text to be written']);
    expect(mockWriteText.mock.results).toStrictEqual([{ type: 'return', value: undefined }]);
  });

  it('should reset existing mocks', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.resetAllMocks();

    const appName = await browser.electron.execute((electron) => electron.app.getName());
    const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
    expect(appName).toBeUndefined();
    expect(clipboardText).toBeUndefined();
  });

  it('should reset existing mocks on an API', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.resetAllMocks('app');

    const appName = await browser.electron.execute((electron) => electron.app.getName());
    const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
    expect(appName).toBeUndefined();
    expect(clipboardText).toBe('mocked clipboardText');
  });
});

describe('restoreAllMocks', () => {
  beforeEach(async () => {
    await browser.electron.execute((electron) => {
      electron.clipboard.clear();
      electron.clipboard.writeText('some real clipboard text');
    });
  });

  it('should restore existing mocks', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.restoreAllMocks();

    const appName = await browser.electron.execute((electron) => electron.app.getName());
    const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
    expect(appName).toBe(pkgAppName);
    expect(clipboardText).toBe('some real clipboard text');
  });

  it('should restore existing mocks on an API', async () => {
    const mockGetName = await browser.electron.mock('app', 'getName');
    const mockReadText = await browser.electron.mock('clipboard', 'readText');
    await mockGetName.mockReturnValue('mocked appName');
    await mockReadText.mockReturnValue('mocked clipboardText');

    await browser.electron.restoreAllMocks('app');

    const appName = await browser.electron.execute((electron) => electron.app.getName());
    const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
    expect(appName).toBe(pkgAppName);
    expect(clipboardText).toBe('mocked clipboardText');
  });
});

describe('execute', () => {
  it('should execute an arbitrary function in the electron main process', async () => {
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

  it('should execute a string-based function in the electron main process', async () => {
    expect(await browser.electron.execute('return 1 + 2 + 3')).toEqual(6);
  });
});

describe('mock object functionality', () => {
  describe('mockImplementation', () => {
    it('should use the specified implementation for an existing mock', async () => {
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
    });
  });

  describe('mockImplementationOnce', () => {
    it('should use the specified implementation for an existing mock once', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');

      await mockGetName.mockImplementation(() => 'default mocked name');
      await mockGetName.mockImplementationOnce(() => 'first mocked name');
      await mockGetName.mockImplementationOnce(() => 'second mocked name');
      await mockGetName.mockImplementationOnce(() => 'third mocked name');

      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('first mocked name');
      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('second mocked name');
      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('third mocked name');
      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('default mocked name');
      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('default mocked name');
    });
  });

  describe('mockReturnValue', () => {
    it('should return the specified value from an existing mock', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');
      await mockGetName.mockReturnValue('This is a mock');

      const electronName = await browser.electron.execute((electron) => electron.app.getName());

      expect(electronName).toBe('This is a mock');
    });
  });

  describe('mockReturnValueOnce', () => {
    it('should return the specified value from an existing mock once', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');

      await mockGetName.mockReturnValue('default mocked name');
      await mockGetName.mockReturnValueOnce('first mocked name');
      await mockGetName.mockReturnValueOnce('second mocked name');
      await mockGetName.mockReturnValueOnce('third mocked name');

      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('first mocked name');
      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('second mocked name');
      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('third mocked name');
      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('default mocked name');
      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('default mocked name');
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

      await mockShowOpenDialog.mockClear();

      expect(mockShowOpenDialog.mock.calls).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.instances).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.invocationCallOrder).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.lastCall).toBeUndefined();
      expect(mockShowOpenDialog.mock.results).toStrictEqual([]);
    });
  });

  describe('mockReset', () => {
    it('should reset the implementation of an existing mock', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');
      await mockGetName.mockReturnValue('mocked name');

      await mockGetName.mockReset();

      const name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBeUndefined();
    });

    it('should reset mockReturnValueOnce implementations of an existing mock', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');
      await mockGetName.mockReturnValueOnce('first mocked name');
      await mockGetName.mockReturnValueOnce('second mocked name');
      await mockGetName.mockReturnValueOnce('third mocked name');

      await mockGetName.mockReset();

      const name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBeUndefined();
    });

    it('should reset mockImplementationOnce implementations of an existing mock', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');
      await mockGetName.mockImplementationOnce(() => 'first mocked name');
      await mockGetName.mockImplementationOnce(() => 'second mocked name');
      await mockGetName.mockImplementationOnce(() => 'third mocked name');

      await mockGetName.mockReset();

      const name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBeUndefined();
    });

    it('should clear the history of an existing mock', async () => {
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

      await mockShowOpenDialog.mockReset();

      expect(mockShowOpenDialog.mock.calls).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.instances).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.invocationCallOrder).toStrictEqual([]);
      expect(mockShowOpenDialog.mock.lastCall).toBeUndefined();
      expect(mockShowOpenDialog.mock.results).toStrictEqual([]);
    });
  });

  describe('mockRestore', () => {
    it('should restore an existing mock', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');
      await mockGetName.mockReturnValue('mocked name');

      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('mocked name');

      await mockGetName.mockRestore();

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(pkgAppName);
    });
  });
});
