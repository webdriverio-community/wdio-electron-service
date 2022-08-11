export type WdioElectronWindowObj = {
  [Key: string]: {
    invoke: (...args: unknown[]) => Promise<unknown>;
  };
};

declare global {
  interface Window {
    wdioElectron?: WdioElectronWindowObj;
  }
}
