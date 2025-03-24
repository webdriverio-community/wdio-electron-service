export const BUILD_TOOL_DETECTION_ERROR =
  'No build tool was detected, if the application is compiled at a different location, please specify the `appBinaryPath` option in your capabilities.';
export const APP_NAME_DETECTION_ERROR =
  'No application name was detected, please set name / productName in your package.json or build tool configuration.';

export const PKG_NAME_ELECTRON = {
  STABLE: 'electron',
  NIGHTLY: 'electron-nightly',
} as const;
export const PNPM_CATALOG_PREFIX = 'catalog:';
export const PNPM_WORKSPACE_YAML = 'pnpm-workspace.yaml';
