/// <reference types="@wdio/globals/types" />
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { multiremotebrowser, expect } from "@wdio/globals";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' }));
const { name, version } = packageJson;

describe('Electron APIs using Multiremote', () => {
    it('should retrieve app metadata through the electron API', async () => {
        const appName = await multiremotebrowser.electron.app('getName');
        expect(appName).toEqual([name, name]);
        const appVersion = await multiremotebrowser.electron.app('getVersion');
        expect(appVersion).toEqual([version, version]);
    });

    it('should allow to retrieve API values from single instance', async () => {
        const browserA = multiremotebrowser.getInstance('browserA');
        expect(await browserA.electron.app('getName')).toBe(name);
        expect(await browserA.electron.app('getVersion')).toBe(version);
        const browserB = multiremotebrowser.getInstance('browserB');
        expect(await browserB.electron.app('getName')).toBe(name);
        expect(await browserB.electron.app('getVersion')).toBe(version);
    })
});