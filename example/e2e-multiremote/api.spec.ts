import { browser } from 'wdio-electron-service';
import { multiremotebrowser, expect } from '@wdio/globals';

const { name, version } = globalThis.packageJson;

describe('Electron APIs using Multiremote', () => {
  it('should retrieve app metadata through the electron API', async () => {
    const appName = await browser.electron.execute((electron) => electron.app.getName());
    expect(appName).toStrictEqual([name, name]);
    const appVersion = await browser.electron.execute((electron) => electron.app.getVersion());
    expect(appVersion).toStrictEqual([version, version]);
  });

  it('should allow to retrieve API values from single instance', async () => {
    const browserA = multiremotebrowser.getInstance('browserA');
    expect(await browserA.electron.execute((electron) => electron.app.getName())).toStrictEqual([name, name]);
    expect(await browserA.electron.execute((electron) => electron.app.getVersion())).toStrictEqual([version, version]);
    const browserB = multiremotebrowser.getInstance('browserB');
    expect(await browserB.electron.execute((electron) => electron.app.getName())).toStrictEqual([name, name]);
    expect(await browserB.electron.execute((electron) => electron.app.getVersion())).toStrictEqual([version, version]);
  });
});
