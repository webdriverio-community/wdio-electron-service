import { browser as wdioBrowser } from '@wdio/globals';

import { init as initSession } from './session.js';
import { CJSElectronLauncher, CJSElectronService } from './classes.js';

export default CJSElectronService;
export const launcher = CJSElectronLauncher;

export const browser: WebdriverIO.Browser = wdioBrowser;
export const startWdioSession = initSession;
