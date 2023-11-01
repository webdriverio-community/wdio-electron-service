import { CONTEXT_BRIDGE_NOT_AVAILABLE } from '../constants.js';
import type ElectronWorkerService from '../service.js';

export async function execute<ReturnValue, InnerArguments extends any[]>(
  this: ElectronWorkerService,
  script: string | ((...innerArgs: InnerArguments) => ReturnValue),
  ...args: InnerArguments
): Promise<ReturnValue> {
  /**
   * parameter check
   */
  if (typeof script !== 'string' && typeof script !== 'function') {
    throw new Error('Expecting script to be type of "string" or "function"!');
  }

  const browser = this.browser as WebdriverIO.Browser;
  if (!browser) {
    throw new Error(`browser not yet initiated`);
  }

  if (typeof script === 'string') {
    return browser.execute(script);
  }

  return browser.execute(
    function executeWithinElectron(errMessage, script, ...args) {
      if (window.wdioElectron === undefined) {
        throw new Error(errMessage);
      }
      return window.wdioElectron.execute(script as string, args);
    },
    CONTEXT_BRIDGE_NOT_AVAILABLE,
    `${script}`,
    ...args,
  );
}
