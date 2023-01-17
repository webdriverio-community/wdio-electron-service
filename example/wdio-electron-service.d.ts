declare namespace WebdriverIO {
  interface Browser {
    electronAPI: (...arg: unknown[]) => Promise<unknown>;
    electronApp: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
    electronMainProcess: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
    electronBrowserWindow: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
  }
}
