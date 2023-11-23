import fs from 'node:fs';
import path from 'node:path';
import { browser } from '@wdio/globals';

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' }));
const { name, version } = packageJson;

describe('electron APIs', () => {
  describe('app', () => {
    it('should retrieve app metadata through the electron API', async () => {
      const appName = await browser.electron.app('getName');
      expect(appName).toEqual(name);
      const appVersion = await browser.electron.app('getVersion');
      expect(appVersion).toEqual(version);
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

  describe('mock', () => {
    afterEach(async () => {
      await browser.electron.clearMocks();
    });

    it('should mock an electron API function', async () => {
      const dialog = await browser.electron.mock('dialog');
      await dialog.setMock('showOpenDialog');

      await browser.electron.execute(
        async (electron) =>
          await electron.dialog.showOpenDialog({
            title: 'my dialog',
            properties: ['openFile', 'openDirectory'],
          }),
      );
      const mockedShowOpenDialog = await dialog.getMock('showOpenDialog');
      expect(mockedShowOpenDialog).toHaveBeenCalledTimes(1);
      expect(mockedShowOpenDialog).toHaveBeenCalledWith({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      });
    });

    it('should mock a synchronous electron API function', async () => {
      const dialog = await browser.electron.mock('dialog');
      await dialog.setMock('showOpenDialogSync');

      await browser.electron.execute((electron) =>
        electron.dialog.showOpenDialogSync({
          title: 'my dialog',
          properties: ['openFile', 'openDirectory'],
        }),
      );

      const mockedShowOpenDialogSync = await dialog.getMock('showOpenDialogSync');
      expect(mockedShowOpenDialogSync).toHaveBeenCalledTimes(1);
      expect(mockedShowOpenDialogSync).toHaveBeenCalledWith({
        title: 'my dialog',
        properties: ['openFile', 'openDirectory'],
      });
    });

    it('should remove an existing mock', async () => {
      const dialog = await browser.electron.mock('dialog');
      await dialog.setMock('showOpenDialog');
      await dialog.unMock('showOpenDialog');

      const showOpenDialogName = await browser.electron.execute((electron) => electron.dialog.showOpenDialog.name);
      expect(async () => await dialog.getMock('showOpenDialog')).rejects.toThrowError(
        'No mock registered for "electron.dialog.showOpenDialog"',
      );
      expect(showOpenDialogName).toBe('showOpenDialog');
    });
  });

  describe('execute', () => {
    it('should allow to execute an arbitrary function in the main process', async () => {
      expect(
        await browser.electron.execute(
          (electron, a, b, c) => {
            const win = electron.BrowserWindow.getFocusedWindow();
            return [typeof win, a + b + c];
          },
          1,
          2,
          3,
        ),
      ).toEqual(['object', 6]);

      expect(await browser.electron.execute('return 1 + 2 + 3')).toBe(6);
    });
  });
});
