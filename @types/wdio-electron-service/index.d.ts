export type WdioElectronWindowObj = {
  [Key: string]: {
    invoke: (...args: unknown[]) => Promise<unknown>;
  };
};

export declare interface ElectronServiceOptions {
  appBinaryPath?: string;
  customApiBrowserCommand?: string;
}

declare global {
  interface Window {
    wdioElectron?: WdioElectronWindowObj;
  }
}
