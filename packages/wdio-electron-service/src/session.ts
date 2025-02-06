import { remote } from 'webdriverio';
import log from '@wdio/electron-utils/log';
import type { Options, Capabilities } from '@wdio/types';
import type { ElectronServiceCapabilities, ElectronServiceGlobalOptions } from '@wdio/electron-types';

import ElectronWorkerService from './service.js';
import ElectronLaunchService from './launcher.js';

export async function init(capabilities: ElectronServiceCapabilities, globalOptions?: ElectronServiceGlobalOptions) {
  const testRunnerOpts: Options.Testrunner = globalOptions?.rootDir ? { rootDir: globalOptions.rootDir } : {};
  const launcher = new ElectronLaunchService(globalOptions || {}, capabilities, testRunnerOpts);
  const service = new ElectronWorkerService(globalOptions);

  await launcher.onPrepare(testRunnerOpts, capabilities);

  await launcher.onWorkerStart('', capabilities as WebdriverIO.Capabilities);

  log.debug('Session capabilities:', JSON.stringify(capabilities, null, 2));

  // initialise session
  const browser = await remote({
    capabilities: (Array.isArray(capabilities)
      ? capabilities[0]
      : capabilities) as Capabilities.RequestedStandaloneCapabilities,
  });
  const cap = (
    Array.isArray(capabilities) ? capabilities[0] : capabilities
  ) as Capabilities.RequestedStandaloneCapabilities;
  await service.before(cap as WebdriverIO.Capabilities, [], browser);

  return browser;
}
