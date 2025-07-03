export const APP_NOT_FOUND_ERROR =
  'Could not find Electron app built with %s!\nIf the application is not compiled, please do so before running your tests, e.g. via `%s`.';
export const CUSTOM_CAPABILITY_NAME = 'wdio:electronServiceOptions';

export enum Channel {
  Execute = 'wdio-electron.execute',
}
