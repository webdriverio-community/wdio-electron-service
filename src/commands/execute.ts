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
    function executeWithinElectron(script: string, ...args) {
      if (window.wdioElectron === undefined) {
        const errMessage =
          'Electron context bridge not available! ' +
          'Did you import the service hook scripts into your application via e.g. ' +
          "`import('wdio-electron-service/main')` and `import('wdio-electron-service/preload')`?\n\n" +
          'Find more information at https://webdriver.io/docs/desktop-testing/electron#api-configuration';
        throw new Error(errMessage);
      }
      return window.wdioElectron.execute(script, args);
    },
    `${script}`,
    ...args,
  ) as ReturnValue;
}
