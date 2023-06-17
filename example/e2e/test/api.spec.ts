import fs from 'fs';
import { browser } from 'wdio-electron-service';

const packageJson = JSON.parse(fs.readFileSync('../app/package.json', { encoding: 'utf-8' })) as Partial<{
  name: string;
  version: string;
}>;
const { name, version } = packageJson;

const waitFor = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe('electron APIs', () => {
  describe('custom', () => {
    it('should return the expected response', async () => {
      const result = await browser.electron.api();
      expect(result).toEqual('test');
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
  describe('app', () => {
    it('should retrieve app metadata through the electron API', async () => {
      const appName = await browser.electron.app('getName');
      expect(appName).toEqual(name);
      const appVersion = await browser.electron.app('getVersion');
      expect(appVersion).toEqual(version);
    });
  });
  describe('mainProcess', () => {
    it('should retrieve the process type through the electron API', async () => {
      const processType = await browser.electron.mainProcess('type');
      expect(processType).toEqual('browser');
    });
  });
  describe('browserWindow', () => {
    it('should retrieve the window title through the electron API', async () => {
      const windowTitle = await browser.electron.browserWindow('title');
      // TODO: flaky - might need window load timeout
      await waitFor(20000);
      expect(windowTitle).toEqual('this is the title of the main window');
    });
  });
});
