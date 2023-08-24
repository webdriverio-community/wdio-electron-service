import { browser as wdioBrowser } from '@wdio/globals';
import ElectronWorkerService from './service.js';

export default ElectronWorkerService;
export interface BrowserExtension {
  electron: {
    api: (...arg: unknown[]) => Promise<unknown>;
    app: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
    browserWindow: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
    dialog: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
    mainProcess: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
    mock: (apiName: string, funcName: string, mockReturnValue: unknown) => Promise<unknown> | unknown;
  };
}

declare global {
  namespace WebdriverIO {
    interface Browser extends BrowserExtension {}
    interface MultiRemoteBrowser extends BrowserExtension {}
  }
}

export const browser: WebdriverIO.Browser = wdioBrowser;
