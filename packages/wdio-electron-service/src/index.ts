import { browser as wdioBrowser } from '@wdio/globals';
import type { ElectronServiceCapabilities, ElectronServiceGlobalOptions } from '@wdio/electron-types';

import { init as initSession } from './session.js';
import ElectronLaunchService from './launcher.js';
import ElectronWorkerService from './service.js';

export const launcher = ElectronLaunchService;
export default ElectronWorkerService;

export const browser: WebdriverIO.Browser = wdioBrowser;
export const startWdioSession: (
  capabilities: ElectronServiceCapabilities,
  serviceGlobalOptions: ElectronServiceGlobalOptions,
) => Promise<WebdriverIO.Browser> = initSession;
