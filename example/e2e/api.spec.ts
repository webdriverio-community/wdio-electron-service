import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' }));
const { name: appName, version: appVersion } = packageJson as { name: string; version: string };

describe('electron APIs', () => {
  describe('app', () => {
    it('should retrieve app metadata through the electron API', async () => {
      const name = await browser.electron.app('getName');
      expect(name).toEqual(appName);
      const version = await browser.electron.app('getVersion');
      expect(version).toEqual(appVersion);
    });
  });

  describe('browserWindow', () => {
    it('should retrieve the window title through the electron API', async () => {
      let windowTitle;
      await browser.waitUntil(
        async () => {
          windowTitle = await browser.electron.browserWindow('title');
          if (windowTitle !== 'this is the title of the main window') {
            return false;
          }

          return windowTitle;
        },
        {
          timeoutMsg: 'Window title not updated',
        },
      );
      expect(windowTitle).toEqual('this is the title of the main window');
    });
  });

  describe('custom', () => {
    it('should return the expected response', async () => {
      const result = await browser.electron.api();
      expect(result).toEqual('test');
    });
  });

  describe('mainProcess', () => {
    it('should retrieve the process type through the electron API', async () => {
      const processType = await browser.electron.mainProcess('type');
      expect(processType).toEqual('browser');
    });
  });
});

describe('mocking', () => {
  afterEach(async () => {
    await browser.electron.removeMocks();
  });

  describe('mock', () => {
    it('should mock an electron API function', async () => {
      const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
      await browser.electron.execute(
        async (electron) =>
          await electron.dialog.showOpenDialog({
            title: 'my dialog',
            properties: ['openFile', 'openDirectory'],
          }),
      );

      const mockedShowOpenDialog = await showOpenDialog.update();
      expect(mockedShowOpenDialog).toHaveBeenCalledTimes(1);
      expect(mockedShowOpenDialog).toHaveBeenCalledWith({
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

      const mockedShowOpenDialogSync = await showOpenDialogSync.update();
      expect(mockedShowOpenDialogSync).toHaveBeenCalledTimes(1);
      expect(mockedShowOpenDialogSync).toHaveBeenCalledWith({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      });
    });

    describe('mockImplementation', () => {
      it('should mock an electron API function', async () => {
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

        const mockedShowOpenDialog = await showOpenDialog.update();
        expect(mockedShowOpenDialog).toHaveBeenCalledTimes(1);
        expect(mockedShowOpenDialog).toHaveBeenCalledWith({
          title: 'my dialog',
          properties: ['openFile', 'openDirectory'],
        });
        expect(callsCount).toBe(1);
      });
    });

    describe('mockReturnValue', () => {
      it('should return the expected value from the mock API', async () => {
        const mockGetName = await browser.electron.mock('app', 'getName');
        await mockGetName.mockReturnValue('This is a mock');

        const name = await browser.electron.execute((electron) => electron.app.getName());

        expect(name).toBe('This is a mock');
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
            properties: ['openFile', 'openDirectory'],
          }),
      );
      await browser.electron.execute((electron) =>
        electron.dialog.showOpenDialogSync({
          title: 'my dialog',
          properties: ['openFile', 'openDirectory'],
        }),
      );

      const mockedShowOpenDialog = await mockedDialog.showOpenDialog.update();
      expect(mockedShowOpenDialog).toHaveBeenCalledTimes(1);
      expect(mockedShowOpenDialog).toHaveBeenCalledWith({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      });
      const mockedShowOpenDialogSync = await mockedDialog.showOpenDialogSync.update();
      expect(mockedShowOpenDialogSync).toHaveBeenCalledTimes(1);
      expect(mockedShowOpenDialogSync).toHaveBeenCalledWith({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      });
    });
  });

  describe('unMock', () => {
    it('should remove an existing mock', async () => {
      const getVersion = await browser.electron.mock('app', 'getVersion', 'mocked version');
      let version = await browser.electron.execute((electron) => electron.app.getVersion());
      expect(version).toBe('mocked version');

      await getVersion.unMock();

      expect(async () => await getVersion.update()).rejects.toThrowError(
        'No mock registered for "electron.app.getVersion"',
      );

      version = await browser.electron.execute((electron) => electron.app.getVersion());
      expect(version).toBe(appVersion);
    });
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
    ).toEqual([appVersion, 6]);
  });

  it('should execute a string-based function in the main process', async () => {
    expect(await browser.electron.execute('return 1 + 2 + 3')).toBe(6);
  });
});
