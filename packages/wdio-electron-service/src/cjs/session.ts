import { remote } from 'webdriverio';
import log from '@wdio/electron-utils/log';
import type { Options } from '@wdio/types';

import { CJSElectronLauncher, CJSElectronService } from './classes.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import type { ElectronServiceOptions } from '@wdio/electron-types';
export async function init(opts: ElectronServiceOptions) {
  // CJS variants of the Launcher and Service classes are needed here
  // - which is why we are not simply doing a dynamic import of `../session.js`
  const testRunnerOpts = opts as Options.Testrunner;
  let capabilities = {
    browserName: 'electron',
    [CUSTOM_CAPABILITY_NAME]: opts,
  };

  const launcher = new CJSElectronLauncher(opts, capabilities, testRunnerOpts);
  const service = new CJSElectronService(opts);

  await launcher.onPrepare(testRunnerOpts, [capabilities]);

  log.debug('Session capabilities:', capabilities);

  // initialise session
  const browser = await remote({
    capabilities,
  });

  await service.before(capabilities, [], browser);

  return browser;
}
