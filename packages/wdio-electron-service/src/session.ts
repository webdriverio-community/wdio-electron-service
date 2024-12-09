import { remote } from 'webdriverio';
import type { Options } from '@wdio/types';

import ElectronWorkerService from './service.js';
import ElectronLaunchService from './launcher.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import log from '@wdio/electron-utils/log';
import type { ElectronServiceOptions } from '@wdio/electron-types';

export interface InitSessionParams {
  browserVersion?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

export async function init(opts: ElectronServiceOptions, params?: InitSessionParams) {
  const testRunnerOpts = opts as Options.Testrunner;
  let capabilities = {
    browserName: 'electron',
    browserVersion: params?.browserVersion,
    [CUSTOM_CAPABILITY_NAME]: opts,
  };

  const launcher = new ElectronLaunchService(opts, capabilities, testRunnerOpts);
  const service = new ElectronWorkerService(opts);

  await launcher.onPrepare(testRunnerOpts, [capabilities]);

  log.debug('Session capabilities:', capabilities);

  // initialise session
  const browser = await remote({
    logLevel: params?.logLevel,
    capabilities,
  });

  await service.before(capabilities, [], browser);

  return browser;
}
