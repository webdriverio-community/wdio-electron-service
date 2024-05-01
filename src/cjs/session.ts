import { remote } from 'webdriverio';
import type { Options } from '@wdio/types';

import { CJSElectronLauncher, CJSElectronService } from './classes.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import type { ElectronServiceOptions } from './types.js';
export async function init(opts: ElectronServiceOptions) {
  const testRunnerOpts = opts as Options.Testrunner;
  let capabilities = {
    browserName: 'electron',
    [CUSTOM_CAPABILITY_NAME]: opts,
  };

  const launcher = new CJSElectronLauncher(opts, capabilities, testRunnerOpts);
  const service = new CJSElectronService(opts);

  await launcher.onPrepare(testRunnerOpts, [capabilities]);

  // initialise session
  const browser = await remote({
    capabilities,
  });

  await service.before(capabilities, [], browser);

  return browser;
}
