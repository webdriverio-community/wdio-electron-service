import { log } from '@wdio/electron-utils';
import type { ElectronServiceGlobalOptions, ExecuteOpts } from '@wdio/electron-types';
import type { Services } from '@wdio/types';

import mockStore from './mockStore.js';
import { clearPuppeteerSessions, ensureActiveWindowFocus } from './window.js';
import * as commands from './commands/index.js';
import { ServiceConfig } from './serviceConfig.js';
import { before } from './serviceCdp.js';

const isInternalCommand = (args: unknown[]) => Boolean((args.at(-1) as ExecuteOpts)?.internal);

export default class ElectronWorkerService extends ServiceConfig implements Services.ServiceInstance {
  constructor(
    globalOptions: ElectronServiceGlobalOptions = {},
    capabilities: WebdriverIO.Capabilities,
    _config?: unknown,
  ) {
    super(globalOptions, capabilities);
  }

  async before(
    capabilities: WebdriverIO.Capabilities,
    _specs: string[],
    instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    log.debug('Using CDP bridge');
    await before.call(this, capabilities, instance);
  }

  async beforeTest() {
    if (this.clearMocks) {
      await commands.clearAllMocks();
    }
    if (this.resetMocks) {
      await commands.resetAllMocks();
    }
    if (this.restoreMocks) {
      await commands.restoreAllMocks();
    }
  }

  async beforeCommand(commandName: string, args: unknown[]) {
    const excludeCommands = ['getWindowHandle', 'getWindowHandles', 'switchToWindow', 'execute'];
    if (!this.browser || excludeCommands.includes(commandName) || isInternalCommand(args)) {
      return;
    }
    await ensureActiveWindowFocus(this.browser, commandName);
  }

  async afterCommand(commandName: string, args: unknown[]) {
    // ensure mocks are updated
    const mocks = mockStore.getMocks();

    // White list of command which will input user actions to electron app.
    const inputCommands = [
      'addValue',
      'clearValue',
      'click',
      'doubleClick',
      'dragAndDrop',
      'execute',
      'executeAsync',
      'moveTo',
      'scrollIntoView',
      'selectByAttribute',
      'selectByIndex',
      'selectByVisibleText',
      'setValue',
      'touchAction',
      'action',
      'actions',
      'emulate',
      'keys',
      'scroll',
      'setWindowSize',
      'uploadFile',
    ];

    if (inputCommands.includes(commandName) && mocks.length > 0 && !isInternalCommand(args)) {
      await Promise.all(mocks.map(async ([_mockId, mock]) => await mock.update()));
    }
  }

  after() {
    clearPuppeteerSessions();
  }
}
