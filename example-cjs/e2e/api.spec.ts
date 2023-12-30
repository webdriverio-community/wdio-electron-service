import { Mock } from '@vitest/spy';
import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

const { name: appName, version: appVersion } = globalThis.packageJson;

afterEach(async () => {
  await browser.electron.removeMocks();
});

describe('mocking', () => {
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
    it('should mock an electron API function', async () => {
      const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
      let callsCount = 0;
      const mockedShowOpenDialog = await showOpenDialog.mockImplementation(() => callsCount++);
      await browser.electron.execute(
        async (electron) =>
          await electron.dialog.showOpenDialog({
            title: 'my dialog',
            properties: ['openFile', 'openDirectory'],
          }),
      );

      expect(mockedShowOpenDialog).toHaveBeenCalledTimes(1);
      expect(mockedShowOpenDialog).toHaveBeenCalledWith({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      });
      expect(callsCount).toBe(1);
    });
  });

  describe('mockImplementationOnce', () => {
    it('should mock an electron API function', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');
      let callsCount = 0;

      const mockedGetName = await mockGetName.mockImplementationOnce(() => callsCount++);

      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(null);

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(appName);

      expect(mockedGetName).toHaveBeenCalledTimes(1);
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
    it('should mock an electron API function', async () => {
      const mockGetName = await browser.electron.mock('app', 'getName');

      await mockGetName.mockReturnValueOnce('This is a mock');

      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('This is a mock');

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(appName);
    });
  });

  describe('mockRestore', () => {
    it('should remove an existing mock', async () => {
      let name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(appName);

      const mockGetName = await browser.electron.mock('app', 'getName');
      await mockGetName.mockReturnValue('mocked name');

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe('mocked name');

      await mockGetName.mockRestore();

      name = await browser.electron.execute((electron) => electron.app.getName());
      expect(name).toBe(appName);
    });
  });

  // describe('mockAll', () => {
  //   it('should mock all functions on an API', async () => {
  //     const mockedDialog = await browser.electron.mockAll('dialog');
  //     await browser.electron.execute(
  //       async (electron) =>
  //         await electron.dialog.showOpenDialog({
  //           title: 'my dialog',
  //           properties: ['openFile', 'openDirectory'],
  //         }),
  //     );
  //     await browser.electron.execute((electron) =>
  //       electron.dialog.showOpenDialogSync({
  //         title: 'my dialog',
  //         properties: ['openFile', 'openDirectory'],
  //       }),
  //     );

  //     expect(mockedDialog.showOpenDialog).toHaveBeenCalledTimes(1);
  //     expect(mockedDialog.showOpenDialog).toHaveBeenCalledWith({
  //       title: 'my dialog',
  //       properties: ['openFile', 'openDirectory'],
  //     });
  //     expect(mockedDialog.showOpenDialogSync).toHaveBeenCalledTimes(1);
  //     expect(mockedDialog.showOpenDialogSync).toHaveBeenCalledWith({
  //       title: 'my dialog',
  //       properties: ['openFile', 'openDirectory'],
  //     });
  //   });
  // });
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
    ).toEqual([appVersion, 6]);
  });

  it('should execute a string-based function in the main process', async () => {
    expect(await browser.electron.execute('return 1 + 2 + 3')).toBe(6);
  });
});
