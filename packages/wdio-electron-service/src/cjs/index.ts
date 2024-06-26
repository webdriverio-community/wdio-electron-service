import { browser as wdioBrowser } from '@wdio/globals';

import type { ElectronServiceOptions } from '@repo/types';

import { init as initSession } from './session.js';
import { CJSElectronLauncher, CJSElectronService } from './classes.js';

exports.default = CJSElectronService;
exports.launcher = CJSElectronLauncher;

export const browser: WebdriverIO.Browser = wdioBrowser;
export const startElectron: (opts: ElectronServiceOptions) => Promise<WebdriverIO.Browser> = initSession;
export * from '@repo/types';
