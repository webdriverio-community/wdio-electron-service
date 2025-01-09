import { browser } from 'wdio-electron-service';
import { multiremotebrowser, expect } from '@wdio/globals';

const { name, version } = globalThis.packageJson;

describe('Electron APIs using Multiremote', () => {
  // TODO We may have to emulate the behavior achieved with IPC Bridge.
  it('should error to access electron api of multiremote browser', () => {
    expect(async () => await browser.electron.execute((electron) => electron.app.getName())).rejects.toThrowError();
  });

  it('should retrieve app metadata through the electron API', async () => {
    const browserA = multiremotebrowser.getInstance('browserA');
    expect(await browserA.electron.execute((electron) => electron.app.getName())).toStrictEqual(name);
    expect(await browserA.electron.execute((electron) => electron.app.getVersion())).toStrictEqual(version);
    const browserB = multiremotebrowser.getInstance('browserB');
    expect(await browserB.electron.execute((electron) => electron.app.getName())).toStrictEqual(name);
    expect(await browserB.electron.execute((electron) => electron.app.getVersion())).toStrictEqual(version);
  });

  it('should retrieve instance-specific values from a single instance', async () => {
    const browserA = multiremotebrowser.getInstance('browserA');
    expect(await browserA.electron.execute(() => process.argv.includes('--browser=A'))).toBe(true);
    expect(await browserA.electron.execute(() => process.argv.includes('--browser=B'))).toBe(false);
    const browserB = multiremotebrowser.getInstance('browserB');
    expect(await browserB.electron.execute(() => process.argv.includes('--browser=A'))).toBe(false);
    expect(await browserB.electron.execute(() => process.argv.includes('--browser=B'))).toBe(true);
  });
});
