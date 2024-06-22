export const APP_NOT_FOUND_ERROR =
  'Could not find Electron app at %s built with %s!\n' +
  'If the application is not compiled, please do so before running your tests, e.g. via `%s`.\n' +
  'Otherwise if the application is compiled at a different location, please specify the `appBinaryPath` option in your capabilities.';
export const CUSTOM_CAPABILITY_NAME = 'wdio:electronServiceOptions';

export enum Channel {
  Execute = 'wdio-electron.execute',
}
