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
  // First try returning an existing mock without requiring a browser context
  try {
    // retrieve an existing mock from the store
    const existingMock = mockStore.getMock(`electron.${apiName}.${funcName}`);
    log.debug(`[${apiName}.${funcName}] Found existing mock, resetting`);
    await existingMock.mockReset();
    return existingMock;
  } catch (_e) {
    // No existing mock, determine browser context now
    log.debug(`[${apiName}.${funcName}] No existing mock found, determining browser context`);
    let browserContext: WebdriverIO.Browser | undefined;
    // Prefer this.browser if it has electron capabilities
    if (
      this &&
      this.browser &&
      !this.browser.isMultiremote &&
      this.browser.electron &&
      typeof this.browser.electron.execute === 'function'
    ) {
      browserContext = this.browser as WebdriverIO.Browser;
    } else if (
      globalThis.browser &&
      (globalThis.browser as WebdriverIO.Browser).electron &&
      typeof (globalThis.browser as WebdriverIO.Browser).electron.execute === 'function'
    ) {
      browserContext = globalThis.browser as WebdriverIO.Browser;
    } else if (globalThis.browser && !(globalThis.browser as unknown as WebdriverIO.MultiRemoteBrowser).isMultiremote) {
      browserContext = globalThis.browser as WebdriverIO.Browser;
    } else if (this?.browser && !this.browser.isMultiremote) {
      browserContext = this.browser as WebdriverIO.Browser;
    }

    // Create a new mock and store it
    log.debug(`[${apiName}.${funcName}] Creating new mock`);
    const newMock = await createMock(apiName, funcName, browserContext);
    mockStore.setMock(newMock);
    return newMock;
  }
}
