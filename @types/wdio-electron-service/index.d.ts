import { fn } from "@vitest/spy";

export type WdioElectronWindowObj = {
  execute: (script: string, args: unknown[]) => any;
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

  var fn: fn
}
