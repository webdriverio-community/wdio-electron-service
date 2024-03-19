import { browser } from 'wdio-electron-service';
import { expect } from '@wdio/globals';

const { name, version } = globalThis.packageJson;

describe('Electron APIs', () => {
  it('should retrieve app metadata through the electron API', async () => {
    const appName = await browser.electron.execute((electron) => electron.app.getName());
    expect(appName).toStrictEqual([name, name]);
    const appVersion = await browser.electron.execute((electron) => electron.app.getVersion());
    expect(appVersion).toStrictEqual([version, version]);
  });
});
