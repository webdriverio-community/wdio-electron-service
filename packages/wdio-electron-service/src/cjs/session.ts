import { remote } from 'webdriverio';
// TODO: Fix CJS import of `log` from '@wdio/electron-utils/log'
// import log from '@wdio/electron-utils/log';
import type { Capabilities, Options } from '@wdio/types';
import type { ElectronServiceCapabilities, ElectronServiceGlobalOptions } from '@wdio/electron-types';

import { CJSElectronLauncher, CJSElectronService } from './classes.js';

export async function init(capabilities: ElectronServiceCapabilities, globalOptions?: ElectronServiceGlobalOptions) {
  // CJS variants of the Launcher and Service classes are needed here
  // - which is why we are not simply doing a dynamic import of `../session.js`
  const testRunnerOpts: Options.Testrunner = globalOptions?.rootDir ? { rootDir: globalOptions.rootDir } : {};
  const launcher = new CJSElectronLauncher(globalOptions || {}, capabilities, testRunnerOpts);
  const service = new CJSElectronService(globalOptions);

  await launcher.onPrepare(testRunnerOpts, capabilities);

  // log.debug('Session capabilities:', capabilities);

  // initialise session
  const browser = await remote({
    capabilities: capabilities as Capabilities.RequestedStandaloneCapabilities,
  });

  await service.before({}, [], browser);

  return browser;
}
