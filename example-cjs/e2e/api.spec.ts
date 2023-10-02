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
    it('should mock the expected electron API function', async () => {
      await browser.electron.mock('dialog', 'showOpenDialog', 'I opened a dialog!');
      const result = await browser.electron.dialog('showOpenDialog');
      expect(result).toEqual('I opened a dialog!');
    });

    it('should mock the expected synchronous electron API function', async () => {
      await browser.electron.mock('dialog', 'showOpenDialogSync', 'I opened a dialog!');
      const result = await browser.electron.dialog('showOpenDialogSync');
      expect(result).toEqual('I opened a dialog!');
    });
  });
});
