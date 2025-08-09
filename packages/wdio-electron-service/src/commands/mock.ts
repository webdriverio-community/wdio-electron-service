import type { ElectronMock } from '@wdio/electron-types';
import { createLogger } from '@wdio/electron-utils';
import { createMock } from '../mock.js';
import mockStore from '../mockStore.js';

const log = createLogger('mock');

interface ElectronServiceContext {
  browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
}

export async function mock(this: ElectronServiceContext, apiName: string, funcName: string): Promise<ElectronMock> {
  log.debug(`[${apiName}.${funcName}] mock command called`);
  log.debug(
    `[${apiName}.${funcName}] Browser context in mock command: globalThis.browser=`,
    typeof globalThis.browser,
    globalThis.browser?.constructor?.name,
  );
  log.debug(`[${apiName}.${funcName}] 'this' context in mock command:`, typeof this, this?.constructor?.name);
  log.debug(`[${apiName}.${funcName}] 'this' has browser:`, typeof this?.browser, this?.browser?.constructor?.name);

  // Check browser context before proceeding
  if (typeof globalThis.browser === 'undefined' && !this?.browser) {
    log.debug(`[${apiName}.${funcName}] WARNING: No browser context available in mock command`);
  }

  // Prioritize the browser object that has electron capabilities
  let browserContext: WebdriverIO.Browser | null = null;

  // Check if this.browser is a regular Browser with electron capabilities
  if (
    this &&
    this.browser &&
    !this.browser.isMultiremote &&
    this.browser.electron &&
    typeof this.browser.electron.execute === 'function'
  ) {
    browserContext = this.browser as WebdriverIO.Browser;
    log.debug(`[${apiName}.${funcName}] Using 'this.browser' context (has electron capabilities)`);
  } else if (globalThis.browser?.electron && typeof globalThis.browser.electron.execute === 'function') {
    browserContext = globalThis.browser;
    log.debug(`[${apiName}.${funcName}] Using globalThis.browser (has electron capabilities)`);
  } else {
    // Fallback to globalThis.browser if available and is regular browser
    if (globalThis.browser) {
      browserContext = globalThis.browser;
    } else if (this?.browser && !this.browser.isMultiremote) {
      browserContext = this.browser as WebdriverIO.Browser;
    }
    log.debug(`[${apiName}.${funcName}] Using fallback browser context (no electron capabilities detected)`);
  }

  log.debug(
    `[${apiName}.${funcName}] Selected browser context:`,
    typeof browserContext,
    browserContext?.constructor?.name,
  );

  if (!browserContext) {
    log.debug(`[${apiName}.${funcName}] WARNING: No browser context found in mock command`);
    throw new Error(`Browser context not available for mocking ${apiName}.${funcName}`);
  }

  try {
    // retrieve an existing mock from the store
    const existingMock = mockStore.getMock(`electron.${apiName}.${funcName}`);
    log.debug(`[${apiName}.${funcName}] Found existing mock, resetting`);
    await existingMock.mockReset();
    return existingMock;
  } catch (_e) {
    // mock doesn't exist, create a new one and store it
    log.debug(`[${apiName}.${funcName}] Creating new mock`);
    const newMock = await createMock(apiName, funcName, browserContext);
    mockStore.setMock(newMock);
    return newMock;
  }
}
