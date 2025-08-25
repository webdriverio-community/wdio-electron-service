import type { BrowserExtension } from '@wdio/electron-types';
import { createLogger } from '@wdio/electron-utils';

const log = createLogger('service');

import type { Browser as PuppeteerBrowser } from 'puppeteer-core';

const puppeteerSessionManager = new Map<string, PuppeteerBrowser>();

export const getActiveWindowHandle = async (puppeteerBrowser: PuppeteerBrowser, currentHandle?: string) => {
  if (!puppeteerBrowser) {
    // puppeteer not ready
    return undefined;
  }

  const handles = puppeteerBrowser
    .targets()
    .filter((target) => target.type() === 'page')
    .map((target) => (target as unknown as { _targetId: string })._targetId);

  // No windows available
  if (handles.length === 0) {
    // no windows available
    return undefined;
  }

  // If we have a current window handle and it's still valid, keep using it
  if (currentHandle && handles.includes(currentHandle)) {
    // keep current handle
    return currentHandle;
  }

  // Otherwise return first available window handle
  // pick first handle
  return handles[0];
};

function hasElectronExtension(
  browser: WebdriverIO.Browser,
): browser is WebdriverIO.Browser & { electron: BrowserExtension['electron'] } {
  return typeof (browser as unknown as Record<string, unknown>).electron !== 'undefined';
}

const switchToActiveWindow = async (browser: WebdriverIO.Browser, puppeteerBrowser: PuppeteerBrowser) => {
  // If this instance doesn't have the electron extension, skip switching
  if (!hasElectronExtension(browser)) {
    return;
  }
  const currentHandle = browser.electron.windowHandle;

  const activeHandle = await getActiveWindowHandle(puppeteerBrowser, currentHandle);

  if (activeHandle && activeHandle !== currentHandle) {
    log.debug('Switching to new active window');
    await browser.switchToWindow(activeHandle);
    browser.electron.windowHandle = activeHandle;
  }
};

export const ensureActiveWindowFocus = async (
  browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  _commandName: string,
) => {
  // ensure focus
  if (browser.isMultiremote) {
    const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;
    for (const instance of mrBrowser.instances) {
      const mrInstance = mrBrowser.getInstance(instance);
      // Skip non-electron instances
      if (!hasElectronExtension(mrInstance)) {
        continue;
      }
      // Safely get Puppeteer for the instance; skip if unavailable
      let mrPuppeteer: PuppeteerBrowser | undefined;
      try {
        mrPuppeteer = await getPuppeteer(mrInstance);
      } catch {
        mrPuppeteer = undefined;
      }
      if (!mrPuppeteer) {
        continue;
      }
      await switchToActiveWindow(mrInstance, mrPuppeteer);
    }
  } else {
    // Skip if this is not an electron instance
    if (!hasElectronExtension(browser)) {
      return;
    }
    const puppeteer = await getPuppeteer(browser);
    await switchToActiveWindow(browser, puppeteer);
  }
  // focus ensured
};

export async function getPuppeteer(browser: WebdriverIO.Browser): Promise<PuppeteerBrowser> {
  const sessionId = browser.sessionId;
  const puppeteer = puppeteerSessionManager.get(sessionId);
  if (puppeteer) {
    // use cached puppeteer browser
    return puppeteer;
  } else {
    // get puppeteer browser
    const puppeteer = await browser.getPuppeteer();
    puppeteerSessionManager.set(sessionId, puppeteer);
    return puppeteer;
  }
}

export function clearPuppeteerSessions() {
  // clear cached puppeteer sessions
  puppeteerSessionManager.clear();
}
