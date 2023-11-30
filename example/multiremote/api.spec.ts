import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { browser } from 'wdio-electron-service';
import { multiremotebrowser, expect } from '@wdio/globals';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' }));
const { name, version } = packageJson;

describe('Electron APIs using Multiremote', () => {
  it('should retrieve app metadata through the electron API', async () => {
    const appName = await browser.electron.execute((electron) => electron.app.getName());
    expect(appName).toBe([name, name]);
    const appVersion = await browser.electron.execute((electron) => electron.app.getVersion());
    expect(appVersion).toBe([version, version]);
  });

  it('should allow to retrieve API values from single instance', async () => {
    const browserA = multiremotebrowser.getInstance('browserA');
    expect(await browserA.electron.execute((electron) => electron.app.getName())).toBe([name, name]);
    expect(await browserA.electron.execute((electron) => electron.app.getVersion())).toBe([version, version]);
    const browserB = multiremotebrowser.getInstance('browserB');
    expect(await browserB.electron.execute((electron) => electron.app.getName())).toBe([name, name]);
    expect(await browserB.electron.execute((electron) => electron.app.getVersion())).toBe([version, version]);
  });
});
