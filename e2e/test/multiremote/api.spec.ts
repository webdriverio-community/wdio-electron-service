import { expect, multiremotebrowser } from '@wdio/globals';
import type * as Electron from 'electron';
import { browser } from 'wdio-electron-service';

// Helper function to get the expected app name from globalThis
const getExpectedAppName = (): string => {
  // If running in binary mode, use the package name from globalThis
  if (process.env.BINARY !== 'false' && globalThis.packageJson?.name) {
    return globalThis.packageJson.name;
  }
  // In no-binary mode, the app name will always be "Electron"
  return 'Electron';
};

// Check if we're running in no-binary mode
const isBinary = process.env.BINARY !== 'false';

describe('Electron APIs using Multiremote', () => {
  it('should retrieve app metadata through the electron API', async () => {
    const appName = await browser.electron.execute((electron: typeof Electron) => electron.app.getName());
    const expectedName = getExpectedAppName();

    if (isBinary) {
      // In binary mode, expect the app name to match what's in the package.json
      expect(appName[0]).toBe(expectedName);
      expect(appName[1]).toBe(expectedName);
      expect(appName[0]).toBe(appName[1]); // Both instances should have the same name
    } else {
      // In no-binary mode, the name will always be "Electron"
      expect(appName).toStrictEqual(['Electron', 'Electron']);
    }

    const appVersion = await browser.electron.execute((electron: typeof Electron) => electron.app.getVersion());

    if (isBinary) {
      // In binary mode, both browsers should have the same version, and it should match a semantic version pattern
      expect(appVersion[0]).toBe(appVersion[1]); // Both instances should have the same version
      expect(appVersion[0]).toMatch(/^\d+\.\d+\.\d+/); // Should be a semantic version
    } else {
      // In no-binary mode, the app version should match the Electron version
      const electronVersion = await browser.electron.execute((_electron: typeof Electron) => process.versions.electron);
      expect(appVersion).toStrictEqual([electronVersion[0], electronVersion[0]]);
    }
  });

  it('should retrieve instance-specific values from a single instance', async () => {
    // Add proper type casting for multiremote browser
    const multi = multiremotebrowser as WebdriverIO.MultiRemoteBrowser;

    const browserA = multi.getInstance('browserA');
    expect(await browserA.electron.execute(() => process.argv.includes('--browser=A'))).toBe(true);
    expect(await browserA.electron.execute(() => process.argv.includes('--browser=B'))).toBe(false);

    const browserB = multi.getInstance('browserB');
    expect(await browserB.electron.execute(() => process.argv.includes('--browser=A'))).toBe(false);
    expect(await browserB.electron.execute(() => process.argv.includes('--browser=B'))).toBe(true);
  });
});
