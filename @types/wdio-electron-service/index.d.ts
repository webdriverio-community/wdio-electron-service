export type WdioElectronWindowObj = {
  [Key: string]: {
    invoke: (...args: unknown[]) => Promise<unknown>;
  };
};

export declare interface ElectronServiceOptions {
  appName?: string;
  appPath?: string;
  binaryPath?: string;
  customApiBrowserCommand?: string;
}

declare global {
  interface Window {
    wdioElectron?: WdioElectronWindowObj;
  }
}
