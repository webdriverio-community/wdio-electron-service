export type WdioElectronWindowObj = {
  [Key: string]: {
    invoke: (...args: unknown[]) => Promise<unknown>;
  };
};

export declare interface ElectronServiceOptions {
  appName?: string;
  appPath?: string;
  binaryPath?: string;
  chromedriverCustomPath?: string;
  customApiBrowserCommand?: string;
  electronVersion?: string;
}

declare global {
  interface Window {
    wdioElectron?: WdioElectronWindowObj;
  }
}
