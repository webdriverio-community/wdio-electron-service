import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { multiremotebrowser, expect } from "@wdio/globals";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' }));
const { name, version } = packageJson;

describe('electron APIs', () => {
    describe('app', () => {
      it('should retrieve app metadata through the electron API', async () => {
        const appName = await multiremotebrowser.electron.app('getName');
        expect(appName).toEqual([name, name]);
        const appVersion = await multiremotebrowser.electron.app('getVersion');
        expect(appVersion).toEqual([version, version]);
      });
    });
});