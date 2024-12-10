import { remote } from 'webdriverio';
import log from '@wdio/electron-utils/log';
import type { Capabilities, Options } from '@wdio/types';
import type { ElectronServiceCapabilities, ElectronServiceGlobalOptions } from '@wdio/electron-types';

import ElectronWorkerService from './service.js';
import ElectronLaunchService from './launcher.js';

export async function init(capabilities: ElectronServiceCapabilities, globalOptions?: ElectronServiceGlobalOptions) {
  const testRunnerOpts: Options.Testrunner = globalOptions?.rootDir ? { rootDir: globalOptions.rootDir } : {};
  const launcher = new ElectronLaunchService(globalOptions || {}, capabilities, testRunnerOpts);
  const service = new ElectronWorkerService(globalOptions);

  await launcher.onPrepare(testRunnerOpts, capabilities);

  log.debug('Session capabilities:', capabilities);

  // initialise session
  const browser = await remote({
    capabilities: capabilities as Capabilities.RequestedStandaloneCapabilities,
  });

  await service.before({}, [], browser);

  return browser;
}
