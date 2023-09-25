import ElectronWorkerService from './service.js';
import type { ElectronServiceApi } from './types.js'

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

type WdioElectronWindowObj = {
  [Key: string]: {
    invoke: (...args: unknown[]) => Promise<unknown>
  }
}

declare global {
  namespace WebdriverIO {
    interface Browser extends BrowserExtension {}
    interface MultiRemoteBrowser extends BrowserExtension {}
  }
  interface Window {
    wdioElectron?: WdioElectronWindowObj;
  }
  namespace WebDriver {
    interface Capabilities {
      'wdio:electronServiceOptions': ElectronServiceApi
    }
  }
}

export * from './types.js'