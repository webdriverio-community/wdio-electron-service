declare module 'wdio-electron-service/utils' {
  const binaryPath: string;
  export const getBinaryPath = (appPath: string, appName: string, distDirName?: string) => binaryPath;
}
