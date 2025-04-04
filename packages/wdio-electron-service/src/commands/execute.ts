export async function execute<ReturnValue, InnerArguments extends unknown[]>(
  browser: WebdriverIO.Browser,
  script: string | ((...innerArgs: InnerArguments) => ReturnValue),
  ...args: InnerArguments
): Promise<ReturnValue | undefined> {
  /**
   * parameter check
   */
  if (typeof script !== 'string' && typeof script !== 'function') {
    throw new Error('Expecting script to be type of "string" or "function"');
  }

  if (!browser) {
    throw new Error('WDIO browser is not yet initialised');
  }

  if (!browser.electron.bridgeActive) {
    const errMessage =
      'Electron context bridge not available! ' +
      'Did you import the service hook scripts into your application via e.g. ' +
      "`import('wdio-electron-service/main')` and `import('wdio-electron-service/preload')`?\n\n" +
      'Find more information at https://webdriver.io/docs/desktop-testing/electron#api-configuration';
    throw new Error(errMessage);
  }

  const returnValue = await browser.execute(
    function executeWithinElectron(script: string, ...args) {
      return window.wdioElectron.execute(script, args);
    },
    `${script}`,
    ...args,
  );

  return (returnValue as ReturnValue) ?? undefined;
}
