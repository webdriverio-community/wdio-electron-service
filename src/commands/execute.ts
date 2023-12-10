import { CONTEXT_BRIDGE_NOT_AVAILABLE } from '../constants.js';
import type ElectronWorkerService from '../service.js';

export async function execute<ReturnValue, InnerArguments extends unknown[]>(
  this: ElectronWorkerService,
  script: string | ((...innerArgs: InnerArguments) => ReturnValue),
  ...args: InnerArguments
): Promise<ReturnValue> {
  /**
   * parameter check
   */
  if (typeof script !== 'string' && typeof script !== 'function') {
    throw new Error('Expecting script to be type of "string" or "function"');
  }

  const browser = this.browser as WebdriverIO.Browser;
  if (!browser) {
    throw new Error('WDIO browser is not yet initialised');
  }

  if (typeof script === 'string') {
    return browser.execute(script);
  }

  return browser.execute(
    function executeWithinElectron(errMessage: string, script: string, ...args) {
      if (window.wdioElectron === undefined) {
        throw new Error(errMessage);
      }
      return window.wdioElectron.execute(script, args);
    },
    CONTEXT_BRIDGE_NOT_AVAILABLE,
    `${script}`,
    ...args,
  ) as ReturnValue;
}
