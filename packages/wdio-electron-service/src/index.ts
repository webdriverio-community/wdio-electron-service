import { browser as wdioBrowser } from '@wdio/globals';

import type { ElectronServiceOptions } from '@wdio/electron-types';

import { init as initSession } from './session.js';
import ElectronLaunchService from './launcher.js';
import ElectronWorkerService from './service.js';

export const launcher = ElectronLaunchService;
export default ElectronWorkerService;

export const browser: WebdriverIO.Browser = wdioBrowser;
export const startElectron: (opts: ElectronServiceOptions) => Promise<WebdriverIO.Browser> = initSession;
