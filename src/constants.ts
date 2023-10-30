export const APP_NOT_FOUND_ERROR =
  'Could not find Electron app at %s build with %s!\n' +
  'If the application is not compiled, please do so before running your tests, e.g. via `%s`.\n' +
  'Otherwise if the application is compiled at a different location, please specify the `appBinaryPath` option in your capabilities.';
export const MULTIPLE_BUILD_TOOLS_ERROR =
  'Multiple build tools were detected, please remove configuration and dependencies for tools which are not being used to build your application';
export const BUILD_TOOL_DETECTION_ERROR =
  'No build tool was detected, if the application is compiled at a different location, please specify the `appBinaryPath` option in your capabilities.';
export const APP_NAME_DETECTION_ERROR =
  'No application name was detected, please set name / productName in your package.json or build tool configuration';
export const CUSTOM_CAPABILITY_NAME = 'wdio:electronServiceOptions';
