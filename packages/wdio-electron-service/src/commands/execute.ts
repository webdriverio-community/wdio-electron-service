import log from '@wdio/electron-utils/log';
import type { CDPSession } from 'puppeteer-core';

export async function execute<ReturnValue, InnerArguments extends unknown[]>(
  browser: WebdriverIO.Browser,
  cdp: CDPSession,
  executionContextId: number,
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

  if (typeof script === 'string') {
    return (await browser.execute(script)) ?? undefined;
  }

  log.warn('ZOMG args', args, args.length, typeof args, Array.isArray(args));

  // const mappedArgs = args.map((arg) => (typeof arg !== 'string' ? JSON.stringify(arg) : arg)).join(',');
  const mappedArgs = args.map((arg) => JSON.stringify(arg)).join(',');

  log.warn('ZOMG mappedArgs', mappedArgs);

  const scriptToEvaluate = args.length
    ? `(new Function('return (${script}).apply(this, arguments)'))(electron,${mappedArgs});`
    : `(new Function('return (${script}).apply(this, arguments)'))(electron);`;

  // const scriptToEvaluate = args.length
  //   ? `() => new Function('return (${script}).apply(this, arguments)')(electron,${mappedArgs});`
  //   : `() => new Function('return (${script}).apply(this, arguments)')(electron);`;

  // const scriptToEvaluate = args.length
  //   ? `return (${script}).apply(this, arguments)(electron,${mappedArgs});`
  //   : `return (${script}).apply(this, arguments)(electron);`;

  log.warn(`Executing script: ${scriptToEvaluate}`);

  // const returnValue = await browser.call(async () => {
  // await cdp.send('Runtime.enable');
  //log.warn(`targets: `, targets, backgroundPage, page);
  return (
    ((await cdp.send('Runtime.evaluate', {
      expression: scriptToEvaluate,
      contextId: executionContextId,
      includeCommandLineAPI: true,
    })) as ReturnValue) ?? undefined
  );
  // const pages = await puppeteerBrowser.pages();
  // return ((await pages[0]?.evaluate(scriptToEvaluate)) as ReturnValue) ?? undefined;
  // return (
  //   ((await backgroundPage?.evaluate(() =>
  //     // @ts-expect-error
  //     new Function(`return (${script}).apply(this, arguments)`)(electron, ...mappedArgs),
  //   )) as ReturnValue) ?? undefined
  // );
  // });

  // const returnValue = await browser.execute(
  //   function executeWithinElectron(script: string, ...args) {
  //     if (window.wdioElectron === undefined) {
  //       const errMessage =
  //         'Electron context bridge not available! ' +
  //         'Did you import the service hook scripts into your application via e.g. ' +
  //         "`import('wdio-electron-service/main')` and `import('wdio-electron-service/preload')`?\n\n" +
  //         'Find more information at https://webdriver.io/docs/desktop-testing/electron#api-configuration';
  //       throw new Error(errMessage);
  //     }
  //     return window.wdioElectron.execute(script, args);
  //   },
  //   `${script}`,
  //   ...args,
  // );

  // return (returnValue as ReturnValue) ?? undefined;
}
