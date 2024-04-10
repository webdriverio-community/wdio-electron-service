import { remote } from 'webdriverio';

import ElectronWorkerService from './service.js';
import ElectronLaunchService from './launcher.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { ElectronServiceOptions } from './types.js';
import { Options } from '@wdio/types';

export async function init(opts: ElectronServiceOptions) {
  const testRunnerOpts = opts as Options.Testrunner;
  let capabilities = {
    browserName: 'electron',
    [CUSTOM_CAPABILITY_NAME]: opts,
  };

  const launcher = new ElectronLaunchService(opts, capabilities, testRunnerOpts);
  const service = new ElectronWorkerService(opts);

  await launcher.onPrepare(testRunnerOpts, [capabilities]);

  console.log('setting caps', capabilities);

  // initialise session
  const browser = await remote({
    capabilities,
  });

  await service.before(capabilities, [], browser);

  return browser;
}
