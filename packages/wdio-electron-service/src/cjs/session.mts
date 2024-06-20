import { remote } from 'webdriverio';
import type { Options } from '@wdio/types';

import { CJSElectronLauncher, CJSElectronService } from './classes.mjs';
import { CUSTOM_CAPABILITY_NAME } from '@repo/utils';
import type { ElectronServiceOptions } from '@repo/types';
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

  // initialise session
  const browser = await remote({
    capabilities,
  });

  await service.before(capabilities, [], browser);

  return browser;
}
