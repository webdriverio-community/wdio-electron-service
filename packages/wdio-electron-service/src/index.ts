import { browser as wdioBrowser } from '@wdio/globals';
import ElectronLaunchService from './launcher.js';
import ElectronWorkerService from './service.js';
import { init as initSession } from './session.js';

export const launcher = ElectronLaunchService;
export default ElectronWorkerService;

export const browser: WebdriverIO.Browser = wdioBrowser;
export const startWdioSession = initSession;
