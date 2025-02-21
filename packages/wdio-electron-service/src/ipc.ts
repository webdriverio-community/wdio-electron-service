// TODO: This file should be remove at V9
import log from '@wdio/electron-utils/log';

/* v8 ignore start */
const yellow = '\u001b[33m';
const reset = '\u001b[0m';

const LINE0 = '* WARNING -------------------------------------------------------------------- *';
const LINE1 = '| You can remove importing main/preload scripts provided by this service.      |';
const LINE2 = '| Because the wdio-electron-service is no longer required the IPC-Bridge .     |';
const LINE3 = '| Those scripts will be completely removed at V9.                              |';
const LINE5 = '* ---------------------------------------------------------------------------- *';

const colourise = (str: string) => {
  if (str === LINE0 || str === LINE5) {
    return `${yellow}${str}${reset}`;
  } else {
    return str.replace(/\|/g, `${yellow}|${reset}`);
  }
};

export async function ipcBridgeCheck(browser: WebdriverIO.Browser) {
  const isActive = await browser.execute(function executeWithinElectron() {
    if ('wdioElectron' in window) {
      return window.wdioElectron.execute();
    } else {
      return false;
    }
  });

  if (isActive) {
    // for the log file
    log.warn(LINE0);
    log.warn(LINE1);
    log.warn(LINE2);
    log.warn(LINE3);
    log.warn(LINE5);
    // for the console
    console.log(colourise(LINE0));
    console.log(colourise(LINE1));
    console.log(colourise(LINE2));
    console.log(colourise(LINE3));
    console.log(colourise(LINE5));
    console.log();
  }
}
/* v8 ignore stop */
