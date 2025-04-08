// TODO: This file should be remove at V9
import log from '@wdio/electron-utils/log';

/* v8 ignore start */
const yellow = '\u001b[33m';
const reset = '\u001b[0m';

const LINE00 = '* WARNING -------------------------------------------------------------------- *';
const LINE01 = '| You can remove importing main/preload scripts provided by this service.      |';
const LINE02 = '| Because the wdio-electron-service is no longer required the IPC-Bridge.      |';
const LINE03 = '| Those scripts will be completely removed at the next release.                |';
const LINE05 = '* ---------------------------------------------------------------------------- *';

const LINE11 = '| The IPC-Bridge is deprecated.                                                |';
const LINE12 = '| Please consider migrating the new bridge called `CDP-Bridge`                 |';
const LINE13 = '| by changing the value of the `useCdpBridge` to `true` or remove this param.  |';
const LINE14 = '| The old one and related functionality will be removed at the next release.   |';

const colourise = (str: string) => {
  if (str === LINE00 || str === LINE05) {
    return `${yellow}${str}${reset}`;
  } else {
    return str.replace(/\|/g, `${yellow}|${reset}`);
  }
};

async function isActive(browser: WebdriverIO.Browser) {
  return await browser.execute(function executeWithinElectron() {
    return window.wdioElectron !== undefined;
  });
}

export async function ipcBridgeCheck(browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser) {
  const result = browser.isMultiremote
    ? (
        await Promise.all(browser.instances.map(async (mrBrowser) => await isActive(browser.getInstance(mrBrowser))))
      ).filter((result) => result).length > 0
    : await isActive(browser);

  if (result) {
    // for the log file
    log.warn(LINE00);
    log.warn(LINE01);
    log.warn(LINE02);
    log.warn(LINE03);
    log.warn(LINE05);
    // for the console
    console.log(colourise(LINE00));
    console.log(colourise(LINE01));
    console.log(colourise(LINE02));
    console.log(colourise(LINE03));
    console.log(colourise(LINE05));
    console.log();
  }
}

export function ipcBridgeWarning() {
  // for the log file
  log.warn(LINE00);
  log.warn(LINE11);
  log.warn(LINE12);
  log.warn(LINE13);
  log.warn(LINE14);
  log.warn(LINE05);
  // for the console
  console.log(colourise(LINE00));
  console.log(colourise(LINE11));
  console.log(colourise(LINE12));
  console.log(colourise(LINE13));
  console.log(colourise(LINE14));
  console.log(colourise(LINE05));
  console.log();
}
/* v8 ignore stop */
