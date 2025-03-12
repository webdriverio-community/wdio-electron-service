import { browser } from 'wdio-electron-service';
import { multiremotebrowser, expect } from '@wdio/globals';

const { name, version } = globalThis.packageJson;
// Check if we're running in no-binary mode
const isBinary = process.env.BINARY !== 'false';

describe('Electron APIs using Multiremote', () => {
  it('should retrieve app metadata through the electron API', async () => {
    const appName = await browser.electron.execute((electron) => electron.app.getName());
    // In no-binary mode, the app name will be "Electron" (default)
    const expectedName = isBinary ? name : 'Electron';
    expect(appName).toStrictEqual([expectedName, expectedName]);

    const appVersion = await browser.electron.execute((electron) => electron.app.getVersion());
    // In no-binary mode, the version will be the Electron version
    const electronVersion = await browser.electron.execute((_electron) => process.versions.electron);
    const expectedVersion = isBinary ? version : electronVersion[0];
    expect(appVersion).toStrictEqual([expectedVersion, expectedVersion]);
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
