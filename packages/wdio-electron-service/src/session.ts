import { remote } from 'webdriverio';
import log from '@wdio/electron-utils/log';
import type { Options } from '@wdio/types';
import type { ElectronServiceCapabilities, ElectronServiceGlobalOptions } from '@wdio/electron-types';

import ElectronWorkerService from './service.js';
import ElectronLaunchService from './launcher.js';

export async function init(capabilities: ElectronServiceCapabilities, globalOptions?: ElectronServiceGlobalOptions) {
  const testRunnerOpts: Options.Testrunner = globalOptions?.rootDir ? { rootDir: globalOptions.rootDir } : {};
  const launcher = new ElectronLaunchService(globalOptions || {}, capabilities, testRunnerOpts);

  await launcher.onPrepare(testRunnerOpts, capabilities);

  await launcher.onWorkerStart('', capabilities as WebdriverIO.Capabilities);

  log.debug('Session capabilities:', JSON.stringify(capabilities, null, 2));

  const capability = Array.isArray(capabilities) ? capabilities[0] : capabilities;

  const service = new ElectronWorkerService(globalOptions, capability);

  // initialise session
  const browser = await remote({
    capabilities: capability,
  });

  await service.before(capability, [], browser);

  return browser;
}
